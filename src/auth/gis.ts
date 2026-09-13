/**
 * Google Identity Services 的 token model：純瀏覽器端取得 access token，不需要
 * client secret，也不需要後端。
 *
 * 原本用的授權碼＋PKCE＋refresh token 在 Google 行不通：實測 token 端點對這個
 * 網頁應用程式用戶端，交換授權碼與續期都回 400「client_secret is missing」，而
 * GitHub Pages 是純靜態網站，沒有地方能藏 secret（使用者裁決改走這條）。
 *
 * 代價：沒有 refresh token。access token 只放記憶體，過期後要由使用者點一下
 * 重新連線（Google 文件要求 requestAccessToken 由使用者操作觸發）。
 */
export const GIS_SRC = 'https://accounts.google.com/gsi/client';

/**
 * 使用者裁決的權限範圍：
 *   - spreadsheets：讀寫帳本，包含對方分享過來的那一份（drive.file 讀不到別人建的檔）
 *   - drive.file：把自己這支 App 建立的帳本分享給對方（permissions.create）
 */
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
] as const;

/** 過期前 2 分鐘就當作過期，避開「檢查時還有效、送到 Google 時剛好過期」的空窗 */
export const EXPIRY_MARGIN_MS = 2 * 60 * 1000;

export type TokenResponse = {
  access_token?: string;
  expires_in?: number | string;
  scope?: string;
  error?: string;
  error_description?: string;
};

export type TokenClientConfig = {
  client_id: string;
  scope: string;
  callback(r: TokenResponse): void;
  error_callback?(e: { type?: string; message?: string }): void;
};

export type TokenClient = { requestAccessToken(override?: { prompt?: string }): void };

export type Oauth2Api = {
  initTokenClient(cfg: TokenClientConfig): TokenClient;
  hasGrantedAllScopes(r: TokenResponse, first: string, ...rest: string[]): boolean;
  revoke(token: string, done: () => void): void;
};

/** 需要使用者點一下重新連線。同步層看到它就停下來，不算失敗 */
export class NeedsConnectError extends Error {
  constructor() {
    super('needs_connect');
    this.name = 'NeedsConnectError';
  }
}

export function tokenUsable(expiresAt: number, now: number): boolean {
  return expiresAt - now > EXPIRY_MARGIN_MS;
}

/** Google 回的是秒；缺值或亂值時保守當作一小時（token model 的預設壽命） */
export function expiresAtFrom(expiresIn: number | string | undefined, now: number): number {
  const sec = Number(expiresIn);
  return now + (Number.isFinite(sec) && sec > 0 ? sec : 3600) * 1000;
}

type GisWindow = Window & { google?: { accounts?: { oauth2?: Oauth2Api } } };

let loading: Promise<Oauth2Api> | null = null;

/** 載入官方 script，同一頁只插一次；載入失敗後允許再試 */
export function loadGis(doc: Document = document, win: GisWindow = window): Promise<Oauth2Api> {
  const ready = () => win.google?.accounts?.oauth2;
  const existing = ready();
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;

  loading = new Promise<Oauth2Api>((resolve, reject) => {
    const s = doc.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => {
      const api = ready();
      if (api) resolve(api);
      else { loading = null; reject(new Error('gis_unavailable')); }
    };
    s.onerror = () => { loading = null; reject(new Error('gis_load_failed')); };
    doc.head.appendChild(s);
  });
  return loading;
}

/** 測試用：清掉 loader 的快取 */
export function __resetGisLoader(): void {
  loading = null;
}

export type ConnectPrompt = '' | 'consent' | 'select_account';

export type TokenProvider = {
  /** 先把 script 載好。連線要在使用者點擊的同一個事件裡呼叫才不會被擋彈出視窗 */
  preload(): Promise<void>;
  connect(prompt?: ConnectPrompt): Promise<void>;
  /** 取可用的 token；沒有或快過期就丟 NeedsConnectError */
  token(): Promise<string>;
  isConnected(): boolean;
  disconnect(): Promise<void>;
  subscribe(listener: (connected: boolean) => void): () => void;
};

export function createTokenProvider(opts: {
  clientId: string;
  scopes?: readonly string[];
  load?: () => Promise<Oauth2Api>;
  now?: () => number;
}): TokenProvider {
  const now = opts.now ?? Date.now;
  const load = opts.load ?? (() => loadGis());
  const scopes = opts.scopes ?? SCOPES;
  let api: Oauth2Api | null = null;
  let current: { token: string; expiresAt: number } | null = null;
  const listeners = new Set<(connected: boolean) => void>();

  const isConnected = () => current !== null && tokenUsable(current.expiresAt, now());
  const emit = () => { const c = isConnected(); for (const l of listeners) l(c); };

  function request(a: Oauth2Api, prompt: ConnectPrompt): Promise<void> {
    // Promise 的 executor 是同步執行的：script 已經載好時，requestAccessToken
    // 會在使用者點擊的同一個事件裡被呼叫，瀏覽器才不會把彈出視窗擋掉
    return new Promise<void>((resolve, reject) => {
      const client = a.initTokenClient({
        client_id: opts.clientId,
        scope: scopes.join(' '),
        callback: (r) => {
          if (r.error || !r.access_token) { reject(new Error(r.error ?? 'no_token')); return; }
          // 使用者可以在同意畫面取消勾選個別權限；少任何一個，之後的 API 呼叫都會 403
          const [first, ...rest] = scopes;
          if (first && !a.hasGrantedAllScopes(r, first, ...rest)) {
            reject(new Error('scopes_not_granted'));
            return;
          }
          current = { token: r.access_token, expiresAt: expiresAtFrom(r.expires_in, now()) };
          emit();
          resolve();
        },
        error_callback: (e) => reject(new Error(e.type ?? 'popup_failed')),
      });
      client.requestAccessToken({ prompt });
    });
  }

  return {
    async preload() { api = await load(); },

    connect(prompt = '') {
      if (api) return request(api, prompt);
      return load().then((a) => { api = a; return request(a, prompt); });
    },

    async token() {
      if (current && tokenUsable(current.expiresAt, now())) return current.token;
      const had = current !== null;
      current = null;
      if (had) emit();
      throw new NeedsConnectError();
    },

    isConnected,

    async disconnect() {
      const t = current?.token;
      current = null;
      if (t && api) await new Promise<void>((done) => api!.revoke(t, done));
      emit();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
