/**
 * Google Identity Services 的 token model：純瀏覽器端取得 access token，不需要
 * client secret，也不需要後端。
 *
 * 原本用的授權碼＋PKCE＋refresh token 在 Google 行不通：實測 token 端點對這個
 * 網頁應用程式用戶端，交換授權碼與續期都回 400「client_secret is missing」，而
 * GitHub Pages 是純靜態網站，沒有地方能藏 secret（使用者裁決改走這條）。
 *
 * 代價：沒有 refresh token。access token 約一小時過期，過期後要由使用者點一下
 * 重新連線（Google 文件要求 requestAccessToken 由使用者操作觸發）。
 *
 * 為了不要每次重整、切回 App 都重新連線，token 連同到期時間存在 localStorage，
 * 到期前重開都直接沿用（使用者要求）。取捨：同網域的程式讀得到它；但它一小時內
 * 就失效、權限只到試算表，而且能在頁面上執行程式的人本來就能用記憶體裡的 token。
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

/** access token 存在 localStorage 的鍵（本機資料依網址分開，開發版與正式版各存各的） */
export const TOKEN_KEY = 'jb.google-token.v1';

/**
 * 這台裝置在 Google 同意過權限沒有。同意紀錄留在 Google 帳號上（跨 token、跨分頁都在），
 * 同意過的話續期時 Google 通常不必再問，可以不打擾使用者就換到新的 token。
 */
export const GRANTED_KEY = 'jb.google-granted.v1';

/** 靜默續期失敗後至少隔這麼久才再試一次，免得每次回到前景都打一輪 */
export const RENEW_THROTTLE_MS = 60_000;

/** 只用到這三個方法；測試傳假的，拿不到 localStorage 時是 null */
export type TokenStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function browserTokenStore(): TokenStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

type SavedToken = { token: string; expiresAt: number; scope: string };

/** 讀回存著的 token；壞掉、權限不齊、快過期的都不要，順手清掉 */
function readSaved(
  store: TokenStore,
  scopes: readonly string[],
  now: number
): { token: string; expiresAt: number } | null {
  try {
    const raw = store.getItem(TOKEN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<SavedToken> | null;
    const granted = typeof v?.scope === 'string' ? v.scope.split(' ') : [];
    if (
      v && typeof v.token === 'string' && typeof v.expiresAt === 'number'
      && scopes.every((s) => granted.includes(s)) && tokenUsable(v.expiresAt, now)
    ) {
      return { token: v.token, expiresAt: v.expiresAt };
    }
    store.removeItem(TOKEN_KEY);
  } catch {
    // 存取被擋（私密模式）或內容壞掉：當作沒有
  }
  return null;
}

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
  /**
   * 試著不打擾使用者就換到新的 token（同意紀錄還在時 Google 多半不會再問）。
   * 需要使用者操作時安靜失敗回 false，畫面維持「點一下連線 Google」。
   */
  renewSilently(): Promise<boolean>;
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
  /** 存 token 的地方；不給就只放記憶體 */
  store?: TokenStore | null;
}): TokenProvider {
  const now = opts.now ?? Date.now;
  const load = opts.load ?? (() => loadGis());
  const scopes = opts.scopes ?? SCOPES;
  const store = opts.store ?? null;
  let api: Oauth2Api | null = null;
  // 上次連線拿到、還沒過期的 token 直接沿用：重整或重開 App 不必再叫 Google 視窗
  let current: { token: string; expiresAt: number } | null = store ? readSaved(store, scopes, now()) : null;

  const save = (scope: string) => {
    if (!store || !current) return;
    try { store.setItem(TOKEN_KEY, JSON.stringify({ ...current, scope })); } catch { /* 存不了就只放記憶體 */ }
  };
  const forget = () => {
    try { store?.removeItem(TOKEN_KEY); } catch { /* 同上 */ }
  };
  // 同意紀錄不隨 token 一起清掉：token 過期不代表使用者收回了權限
  const markGranted = () => {
    try { store?.setItem(GRANTED_KEY, '1'); } catch { /* 同上 */ }
  };
  const grantedBefore = () => {
    try { return store?.getItem(GRANTED_KEY) === '1'; } catch { return false; }
  };
  // 還沒試過：起始值不能是 0，否則第一次就被自己的節流擋掉（單元測試抓到）
  let lastRenewAt = Number.NEGATIVE_INFINITY;
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
          save(r.scope ?? scopes.join(' '));
          markGranted();
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

    async renewSilently() {
      if (isConnected()) return true;
      // 沒在這台裝置同意過就別試：一定會跳視窗，而且沒有使用者的點擊會被瀏覽器擋掉
      if (!grantedBefore()) return false;
      if (now() - lastRenewAt < RENEW_THROTTLE_MS) return false;
      lastRenewAt = now();
      try {
        const a = api ?? (api = await load());
        await request(a, '');
        return isConnected();
      } catch {
        return false;
      }
    },

    async token() {
      if (current && tokenUsable(current.expiresAt, now())) return current.token;
      const had = current !== null;
      current = null;
      forget();
      if (had) emit();
      throw new NeedsConnectError();
    },

    isConnected,

    async disconnect() {
      const t = current?.token;
      current = null;
      forget();
      if (t && api) await new Promise<void>((done) => api!.revoke(t, done));
      emit();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}
