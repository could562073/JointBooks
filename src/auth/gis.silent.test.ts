import { describe, it, expect, vi } from 'vitest';
import {
  createTokenProvider, GRANTED_KEY, RENEW_THROTTLE_MS, SCOPES,
  type Oauth2Api, type TokenResponse, type TokenStore,
} from './gis';

/** 假的 google.accounts.oauth2：按下 requestAccessToken 就同步回應 */
function fakeApi(reply: TokenResponse | { popupError: string }) {
  const calls: { prompt?: string }[] = [];
  const api: Oauth2Api = {
    initTokenClient(cfg) {
      return {
        requestAccessToken(o) {
          calls.push({ prompt: o?.prompt });
          if ('popupError' in reply) cfg.error_callback?.({ type: reply.popupError });
          else cfg.callback(reply);
        },
      };
    },
    hasGrantedAllScopes: () => true,
    revoke: vi.fn((_t: string, done: () => void) => done()),
  };
  return { api, calls };
}

function memoryStore(seed: Record<string, string> = {}): TokenStore {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

const OK: TokenResponse = { access_token: 'tok-new', expires_in: 3599, scope: SCOPES.join(' ') };

describe('不打擾使用者的續期（token 一小時就過期）', () => {
  it('這台裝置沒同意過：連試都不試，也不會跳出視窗', async () => {
    const { api, calls } = fakeApi(OK);
    const p = createTokenProvider({ clientId: 'cid', load: async () => api, now: () => 0, store: memoryStore() });
    expect(await p.renewSilently()).toBe(false);
    expect(calls).toEqual([]);
  });

  it('同意過、token 過期了：靜默換到新的，prompt 是空字串（不強迫再同意）', async () => {
    const { api, calls } = fakeApi(OK);
    const store = memoryStore({ [GRANTED_KEY]: '1' });
    const p = createTokenProvider({ clientId: 'cid', load: async () => api, now: () => 0, store });
    expect(p.isConnected()).toBe(false);

    expect(await p.renewSilently()).toBe(true);
    expect(p.isConnected()).toBe(true);
    expect(await p.token()).toBe('tok-new');
    expect(calls).toEqual([{ prompt: '' }]);
  });

  it('連線成功會記下「這台裝置同意過」，之後才有機會靜默續期', async () => {
    const store = memoryStore();
    const p = createTokenProvider({ clientId: 'cid', load: async () => fakeApi(OK).api, now: () => 0, store });
    await p.connect();
    expect(store.getItem(GRANTED_KEY)).toBe('1');
  });

  it('需要使用者操作（彈出視窗被擋、要重新同意）：安靜失敗，不丟例外', async () => {
    const { api } = fakeApi({ popupError: 'popup_failed' });
    const store = memoryStore({ [GRANTED_KEY]: '1' });
    const p = createTokenProvider({ clientId: 'cid', load: async () => api, now: () => 0, store });
    expect(await p.renewSilently()).toBe(false);
    expect(p.isConnected()).toBe(false);
  });

  it('失敗後一分鐘內不再打 Google（回到前景就試一次會太頻繁）', async () => {
    const { api, calls } = fakeApi({ popupError: 'popup_failed' });
    const store = memoryStore({ [GRANTED_KEY]: '1' });
    let clock = 0;
    const p = createTokenProvider({ clientId: 'cid', load: async () => api, now: () => clock, store });

    expect(await p.renewSilently()).toBe(false);
    clock = RENEW_THROTTLE_MS - 1;
    expect(await p.renewSilently()).toBe(false);
    expect(calls).toHaveLength(1);

    clock = RENEW_THROTTLE_MS + 1;
    expect(await p.renewSilently()).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it('還連著的時候直接回 true，不去打 Google', async () => {
    const { api, calls } = fakeApi(OK);
    const p = createTokenProvider({ clientId: 'cid', load: async () => api, now: () => 0, store: memoryStore() });
    await p.connect();
    expect(calls).toHaveLength(1);
    expect(await p.renewSilently()).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
