import {
  expiresAtFrom, loadGis, NeedsConnectError, SCOPES, tokenUsable,
  type ConnectPrompt, type Oauth2Api, type TokenProvider, type TokenStore,
} from './gis';

/**
 * 登入端點版的 token 提供者：登入一次之後就不用再點（使用者回報「過一小時還是要點一次」）。
 *
 * token model 沒有 refresh token，access token 一小時就過期，而續期要叫 Google 的視窗，
 * Safari 只在使用者剛點過畫面時才允許。授權碼模式改由 worker/ 那支端點用用戶端密碼換 token：
 * 續期只是一個普通的網路請求，不需要視窗、不需要點擊，背景就能完成。
 *
 * refresh token 跟 access token 一樣存在 localStorage（同網域的程式讀得到；權限只到試算表與
 * 這支 App 建的檔案）。Google 撤銷或過期時端點會回 invalid_grant，這裡就清掉、要求重新登入。
 */
export const PROXY_TOKEN_KEY = 'jb.google-proxy-token.v1';

type Saved = { refreshToken: string; accessToken: string; expiresAt: number; scope: string };

type ProxyReply = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  error?: string;
};

export function createProxyTokenProvider(opts: {
  clientId: string;
  proxyUrl: string;
  scopes?: readonly string[];
  store?: TokenStore | null;
  now?: () => number;
  load?: () => Promise<Oauth2Api>;
  fetchImpl?: typeof fetch;
}): TokenProvider {
  const now = opts.now ?? Date.now;
  const scopes = opts.scopes ?? SCOPES;
  const store = opts.store ?? null;
  const load = opts.load ?? (() => loadGis());
  const http = opts.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  let api: Oauth2Api | null = null;

  const read = (): Saved | null => {
    try {
      const raw = store?.getItem(PROXY_TOKEN_KEY);
      if (!raw) return null;
      const v = JSON.parse(raw) as Partial<Saved>;
      const granted = (v.scope ?? '').split(' ');
      if (typeof v.refreshToken !== 'string' || !scopes.every((s) => granted.includes(s))) return null;
      return {
        refreshToken: v.refreshToken,
        accessToken: typeof v.accessToken === 'string' ? v.accessToken : '',
        expiresAt: typeof v.expiresAt === 'number' ? v.expiresAt : 0,
        scope: v.scope ?? '',
      };
    } catch {
      return null;
    }
  };

  let current: Saved | null = read();
  const listeners = new Set<(connected: boolean) => void>();

  const write = () => {
    try {
      if (current) store?.setItem(PROXY_TOKEN_KEY, JSON.stringify(current));
      else store?.removeItem(PROXY_TOKEN_KEY);
    } catch { /* 存不了就只放記憶體 */ }
  };
  const isConnected = () => current !== null && current.accessToken !== '' && tokenUsable(current.expiresAt, now());
  const emit = () => { const c = isConnected(); for (const l of listeners) l(c); };

  async function call(path: string, body: Record<string, string>): Promise<ProxyReply> {
    const res = await http(`${opts.proxyUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const reply = (await res.json()) as ProxyReply;
    if (!res.ok || !reply.access_token) throw new Error(reply.error ?? `proxy_${res.status}`);
    return reply;
  }

  function keep(reply: ProxyReply, refreshToken: string) {
    current = {
      refreshToken,
      accessToken: reply.access_token!,
      expiresAt: expiresAtFrom(reply.expires_in, now()),
      scope: reply.scope || scopes.join(' '),
    };
    write();
    emit();
  }

  /** 叫出 Google 的視窗拿授權碼。要在使用者的點擊裡呼叫，視窗才不會被擋 */
  function requestCode(a: Oauth2Api, prompt: ConnectPrompt): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const client = a.initCodeClient({
        client_id: opts.clientId,
        scope: scopes.join(' '),
        ux_mode: 'popup',
        // 重新登入時強迫選帳號：Google 對已經同意過的請求可能不再發 refresh token
        select_account: prompt === 'select_account',
        callback: (r) => {
          if (r.error || !r.code) { reject(new Error(r.error ?? 'no_code')); return; }
          resolve(r.code);
        },
        error_callback: (e) => reject(new Error(e.type ?? 'popup_failed')),
      });
      client.requestCode();
    });
  }

  return {
    async preload() { api = await load(); },

    async connect(prompt: ConnectPrompt = '') {
      const a = api ?? (api = await load());
      const code = await requestCode(a, prompt);
      const reply = await call('/auth/exchange', { code });
      if (!reply.refresh_token) {
        // 沒拿到 refresh token 就沒有永續登入。先用這一小時的 token，並讓呼叫端知道
        keep(reply, current?.refreshToken ?? '');
        if (!current?.refreshToken) throw new Error('no_refresh_token');
        return;
      }
      keep(reply, reply.refresh_token);
    },

    async renewSilently() {
      const saved = current;
      if (!saved?.refreshToken) return false;
      if (isConnected()) return true;
      try {
        // 純網路請求：不開視窗、不需要使用者的點擊，背景也能換
        keep(await call('/auth/refresh', { refresh_token: saved.refreshToken }), saved.refreshToken);
        return true;
      } catch (e) {
        // 撤銷或過期：清掉，畫面回到「點一下連線 Google」
        if (String(e).includes('invalid_grant')) { current = null; write(); emit(); }
        return false;
      }
    },

    expiresInMs: () => (current ? Math.max(0, current.expiresAt - now()) : 0),

    async token() {
      if (isConnected()) return current!.accessToken;
      if (current?.refreshToken) {
        try {
          keep(await call('/auth/refresh', { refresh_token: current.refreshToken }), current.refreshToken);
          return current!.accessToken;
        } catch (e) {
          if (String(e).includes('invalid_grant')) { current = null; write(); emit(); }
        }
      }
      throw new NeedsConnectError();
    },

    isConnected,

    async disconnect() {
      const saved = current;
      current = null;
      write();
      emit();
      if (!saved) return;
      // 撤銷 Google 的授權：授權碼流程只有顯示同意畫面時才發 refresh token，
      // 只清本機的話下次登入拿不到，登入會失敗（no_refresh_token）
      try {
        let token = saved.accessToken;
        if (!tokenUsable(saved.expiresAt, now()) && saved.refreshToken) {
          token = (await call('/auth/refresh', { refresh_token: saved.refreshToken })).access_token!;
        }
        if (!token) return;
        const a = api ?? (api = await load());
        await new Promise<void>((done) => a.revoke(token, done));
      } catch {
        // 離線等原因撤銷不了：本機已經清掉；下次登入若拿不到續期憑證，錯誤訊息會教使用者到 Google 帳號移除授權
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
