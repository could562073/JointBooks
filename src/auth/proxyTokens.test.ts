import { describe, expect, it, vi } from 'vitest';
import { NeedsConnectError, SCOPES, type CodeClientConfig, type CodeResponse, type Oauth2Api } from './gis';
import { createProxyTokenProvider, PROXY_TOKEN_KEY } from './proxyTokens';

const SCOPE = SCOPES.join(' ');

/** 假的 Google 視窗：按下就同步回一個授權碼（或錯誤） */
function fakeCodeApi(reply: CodeResponse) {
  const calls: { selectAccount?: boolean }[] = [];
  const api = {
    initTokenClient: () => ({ requestAccessToken: () => {} }),
    initCodeClient: (cfg: CodeClientConfig) => ({
      requestCode: () => { calls.push({ selectAccount: cfg.select_account }); cfg.callback(reply); },
    }),
    hasGrantedAllScopes: () => true,
    revoke: (_t: string, done: () => void) => done(),
  } as unknown as Oauth2Api;
  return { api, calls };
}

/** 假的登入端點 */
function fakeProxy(replies: { status: number; body: unknown }[]) {
  const sent: { path: string; body: Record<string, string> }[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    sent.push({ path: new URL(String(url)).pathname, body: JSON.parse(String(init?.body ?? '{}')) });
    const r = replies[sent.length - 1] ?? replies[replies.length - 1]!;
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, sent };
}

function memoryStore(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    map,
  };
}

const OK_EXCHANGE = { status: 200, body: { access_token: 'at', expires_in: 3599, refresh_token: 'rt', scope: SCOPE } };

function provider(over: Partial<Parameters<typeof createProxyTokenProvider>[0]> = {}) {
  const store = over.store ?? memoryStore();
  return {
    store: store as ReturnType<typeof memoryStore>,
    p: createProxyTokenProvider({
      clientId: 'cid', proxyUrl: 'https://auth.example.workers.dev',
      now: () => 0, load: async () => fakeCodeApi({ code: 'the-code', scope: SCOPE }).api,
      fetchImpl: fakeProxy([OK_EXCHANGE]).fetchImpl,
      ...over, store,
    }),
  };
}

describe('用登入端點的授權碼流程', () => {
  it('第一次登入：拿授權碼換 token，refresh token 存起來', async () => {
    const proxy = fakeProxy([OK_EXCHANGE]);
    const { p, store } = provider({ fetchImpl: proxy.fetchImpl });

    await p.connect();
    expect(p.isConnected()).toBe(true);
    expect(await p.token()).toBe('at');
    expect(proxy.sent[0]).toEqual({ path: '/auth/exchange', body: { code: 'the-code' } });
    expect(JSON.parse(store.map.get(PROXY_TOKEN_KEY)!)).toMatchObject({ refreshToken: 'rt', accessToken: 'at' });
  });

  it('過期後續期：只打端點，不開任何視窗、也不需要使用者點畫面', async () => {
    const proxy = fakeProxy([
      OK_EXCHANGE,
      { status: 200, body: { access_token: 'at2', expires_in: 3599, scope: SCOPE } },
    ]);
    let clock = 0;
    const { p } = provider({ fetchImpl: proxy.fetchImpl, now: () => clock });

    await p.connect();
    clock = 3_600_000;                       // 一小時後：舊的 token 過期
    expect(p.isConnected()).toBe(false);

    expect(await p.renewSilently()).toBe(true);
    expect(p.isConnected()).toBe(true);
    expect(await p.token()).toBe('at2');
    expect(proxy.sent[1]).toEqual({ path: '/auth/refresh', body: { refresh_token: 'rt' } });
  });

  it('重開 App：從存下來的 refresh token 直接續期，不必重新登入', async () => {
    const saved = JSON.stringify({ refreshToken: 'rt', accessToken: 'old', expiresAt: 0, scope: SCOPE });
    const proxy = fakeProxy([{ status: 200, body: { access_token: 'at3', expires_in: 3599, scope: SCOPE } }]);
    const { p } = provider({ store: memoryStore({ [PROXY_TOKEN_KEY]: saved }), fetchImpl: proxy.fetchImpl });

    expect(p.isConnected()).toBe(false);
    expect(await p.token()).toBe('at3');
    expect(proxy.sent[0]!.path).toBe('/auth/refresh');
  });

  it('refresh token 被撤銷：清掉並要求重新登入', async () => {
    const saved = JSON.stringify({ refreshToken: 'dead', accessToken: '', expiresAt: 0, scope: SCOPE });
    const store = memoryStore({ [PROXY_TOKEN_KEY]: saved });
    const proxy = fakeProxy([{ status: 502, body: { error: 'invalid_grant' } }]);
    const { p } = provider({ store, fetchImpl: proxy.fetchImpl });

    expect(await p.renewSilently()).toBe(false);
    expect(store.map.has(PROXY_TOKEN_KEY)).toBe(false);
    await expect(p.token()).rejects.toBeInstanceOf(NeedsConnectError);
  });

  it('端點沒回 refresh token：不假裝成功，讓呼叫端知道沒有永續登入', async () => {
    const proxy = fakeProxy([{ status: 200, body: { access_token: 'at', expires_in: 3599, scope: SCOPE } }]);
    const { p } = provider({ fetchImpl: proxy.fetchImpl });
    await expect(p.connect()).rejects.toThrow('no_refresh_token');
  });

  it('還沒登入過：要 token 就丟 NeedsConnectError，不會偷偷開視窗', async () => {
    const proxy = fakeProxy([]);
    const { p } = provider({ fetchImpl: proxy.fetchImpl });
    await expect(p.token()).rejects.toBeInstanceOf(NeedsConnectError);
    expect(await p.renewSilently()).toBe(false);
  });

  it('要求重新選帳號時才帶 select_account（重新拿 refresh token 用）', async () => {
    const code = fakeCodeApi({ code: 'c', scope: SCOPE });
    const { p } = provider({ load: async () => code.api, fetchImpl: fakeProxy([OK_EXCHANGE]).fetchImpl });

    await p.connect();
    await p.connect('select_account');
    expect(code.calls.map((c) => c.selectAccount)).toEqual([false, true]);
  });
});

describe('登出：撤銷 Google 的授權', () => {
  it('登入成功後登出：用現有的 access token 撤銷，並清掉本機狀態', async () => {
    const revoke = vi.fn((_t: string, done: () => void) => done());
    const code = fakeCodeApi({ code: 'the-code', scope: SCOPE });
    const api = { ...code.api, revoke };
    const proxy = fakeProxy([OK_EXCHANGE]);
    const { p, store } = provider({ load: async () => api, fetchImpl: proxy.fetchImpl });

    await p.connect();
    await p.disconnect();

    expect(revoke).toHaveBeenCalledWith('at', expect.any(Function));
    expect(p.isConnected()).toBe(false);
    expect(store.map.has(PROXY_TOKEN_KEY)).toBe(false);
  });

  it('存的 access token 已過期：先打 /auth/refresh 換新的，再撤銷新的', async () => {
    const revoke = vi.fn((_t: string, done: () => void) => done());
    const code = fakeCodeApi({ code: 'x', scope: SCOPE });
    const api = { ...code.api, revoke };
    const saved = JSON.stringify({ refreshToken: 'rt', accessToken: 'old', expiresAt: 0, scope: SCOPE });
    const proxy = fakeProxy([{ status: 200, body: { access_token: 'fresh', expires_in: 3599, scope: SCOPE } }]);
    const { p } = provider({
      store: memoryStore({ [PROXY_TOKEN_KEY]: saved }), load: async () => api, fetchImpl: proxy.fetchImpl, now: () => 0,
    });

    await p.disconnect();

    expect(proxy.sent[0]).toEqual({ path: '/auth/refresh', body: { refresh_token: 'rt' } });
    expect(revoke).toHaveBeenCalledWith('fresh', expect.any(Function));
  });

  it('撤銷或續期失敗（例如離線）：disconnect 仍然完成，本機狀態已經清掉', async () => {
    const code = fakeCodeApi({ code: 'x', scope: SCOPE });
    const api = { ...code.api, revoke: vi.fn(() => { throw new Error('offline'); }) };
    const proxy = fakeProxy([OK_EXCHANGE]);
    const { p, store } = provider({ load: async () => api, fetchImpl: proxy.fetchImpl });

    await p.connect();
    await expect(p.disconnect()).resolves.toBeUndefined();

    expect(p.isConnected()).toBe(false);
    expect(store.map.has(PROXY_TOKEN_KEY)).toBe(false);
  });
});
