import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  __resetGisLoader, createTokenProvider, EXPIRY_MARGIN_MS, expiresAtFrom, GIS_SRC, loadGis,
  NeedsConnectError, SCOPES, tokenUsable, type Oauth2Api, type TokenResponse,
} from './gis';

afterEach(() => { __resetGisLoader(); vi.restoreAllMocks(); });

/** 假的 google.accounts.oauth2：按下 requestAccessToken 就同步回應 */
function fakeApi(reply: TokenResponse | { popupError: string }, granted = true) {
  const calls: { prompt?: string; scope: string; clientId: string }[] = [];
  const revoke = vi.fn((_t: string, done: () => void) => done());
  const api: Oauth2Api = {
    initTokenClient(cfg) {
      return {
        requestAccessToken(o) {
          calls.push({ prompt: o?.prompt, scope: cfg.scope, clientId: cfg.client_id });
          if ('popupError' in reply) cfg.error_callback?.({ type: reply.popupError });
          else cfg.callback(reply);
        },
      };
    },
    // 這組測試只走 token model；授權碼流程另有 proxyTokens.test.ts
    initCodeClient: () => ({ requestCode: () => {} }),
    hasGrantedAllScopes: () => granted,
    revoke,
  };
  return { api, calls, revoke };
}

const OK: TokenResponse = { access_token: 'tok-1', expires_in: 3599, scope: SCOPES.join(' ') };

describe('tokenUsable／expiresAtFrom', () => {
  it('離過期還超過 2 分鐘才算可用', () => {
    expect(tokenUsable(10_000 + EXPIRY_MARGIN_MS + 1, 10_000)).toBe(true);
    expect(tokenUsable(10_000 + EXPIRY_MARGIN_MS, 10_000)).toBe(false);
  });

  it('秒數轉成絕對時間；字串也吃；缺值當一小時', () => {
    expect(expiresAtFrom(60, 1_000)).toBe(61_000);
    expect(expiresAtFrom('60', 1_000)).toBe(61_000);
    expect(expiresAtFrom(undefined, 0)).toBe(3_600_000);
  });
});

describe('createTokenProvider', () => {
  it('連線成功後拿得到 token，並要求 spreadsheets 與 drive.file 兩個權限', async () => {
    const { api, calls } = fakeApi(OK);
    const p = createTokenProvider({ clientId: 'cid', load: async () => api, now: () => 0 });
    await p.connect();
    expect(await p.token()).toBe('tok-1');
    expect(p.isConnected()).toBe(true);
    expect(calls[0]).toEqual({ prompt: '', scope: SCOPES.join(' '), clientId: 'cid' });
    expect(calls[0]!.scope).toContain('auth/spreadsheets');
    expect(calls[0]!.scope).toContain('auth/drive.file');
  });

  it('還沒連線就要 token：丟 NeedsConnectError', async () => {
    const p = createTokenProvider({ clientId: 'cid', load: async () => fakeApi(OK).api });
    await expect(p.token()).rejects.toBeInstanceOf(NeedsConnectError);
  });

  it('token 快過期時丟 NeedsConnectError，並通知訂閱者已斷線', async () => {
    let t = 0;
    const p = createTokenProvider({ clientId: 'cid', load: async () => fakeApi(OK).api, now: () => t });
    const seen: boolean[] = [];
    p.subscribe((c) => seen.push(c));
    await p.connect();
    t = 3599 * 1000 - EXPIRY_MARGIN_MS;
    await expect(p.token()).rejects.toBeInstanceOf(NeedsConnectError);
    expect(p.isConnected()).toBe(false);
    expect(seen).toEqual([true, false]);
  });

  it('Google 回錯誤時連線失敗，不留下 token', async () => {
    const p = createTokenProvider({ clientId: 'cid', load: async () => fakeApi({ error: 'access_denied' }).api });
    await expect(p.connect()).rejects.toThrow('access_denied');
    expect(p.isConnected()).toBe(false);
  });

  it('使用者在同意畫面取消勾選任一權限：視為失敗', async () => {
    const p = createTokenProvider({ clientId: 'cid', load: async () => fakeApi(OK, false).api });
    await expect(p.connect()).rejects.toThrow('scopes_not_granted');
    expect(p.isConnected()).toBe(false);
  });

  it('彈出視窗開不起來：把原因丟出去', async () => {
    const p = createTokenProvider({ clientId: 'cid', load: async () => fakeApi({ popupError: 'popup_failed_to_open' }).api });
    await expect(p.connect()).rejects.toThrow('popup_failed_to_open');
  });

  it('預先載好 script 時，connect 會在同一個呼叫裡立刻要 token（保住使用者手勢）', async () => {
    const { api, calls } = fakeApi(OK);
    const p = createTokenProvider({ clientId: 'cid', load: async () => api });
    await p.preload();
    const pending = p.connect();
    // 還沒有任何 await：若中間多等一個 microtask，瀏覽器會把彈出視窗當成非使用者觸發而擋掉
    expect(calls).toHaveLength(1);
    await pending;
  });

  it('中斷連線會撤銷 token', async () => {
    const { api, revoke } = fakeApi(OK);
    const p = createTokenProvider({ clientId: 'cid', load: async () => api, now: () => 0 });
    await p.preload();
    await p.connect();
    await p.disconnect();
    expect(revoke).toHaveBeenCalledWith('tok-1', expect.any(Function));
    expect(p.isConnected()).toBe(false);
  });
});

describe('loadGis', () => {
  it('只插一次官方 script，載好後回傳 oauth2 物件', async () => {
    const win = {} as Window & { google?: { accounts?: { oauth2?: Oauth2Api } } };
    const first = loadGis(document, win);
    const second = loadGis(document, win);
    const scripts = [...document.head.querySelectorAll(`script[src="${GIS_SRC}"]`)] as HTMLScriptElement[];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.async).toBe(true);

    const { api } = fakeApi(OK);
    win.google = { accounts: { oauth2: api } };
    scripts[0]!.onload?.(new Event('load'));
    await expect(first).resolves.toBe(api);
    await expect(second).resolves.toBe(api);
    scripts[0]!.remove();
  });

  it('載入失敗後可以再試一次', async () => {
    const win = {} as Window & { google?: { accounts?: { oauth2?: Oauth2Api } } };
    const attempt = loadGis(document, win);
    const s = document.head.querySelector(`script[src="${GIS_SRC}"]`) as HTMLScriptElement;
    s.onerror?.(new Event('error'));
    await expect(attempt).rejects.toThrow('gis_load_failed');
    s.remove();

    void loadGis(document, win);
    expect(document.head.querySelectorAll(`script[src="${GIS_SRC}"]`)).toHaveLength(1);
    document.head.querySelector(`script[src="${GIS_SRC}"]`)!.remove();
  });
});
