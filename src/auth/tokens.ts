/** §14.2：過期前 5 分鐘自動續期 */
export const REFRESH_MARGIN_MS = 5 * 60 * 1000;

export type TokenSet = {
  accessToken: string;
  /** epoch ms */
  expiresAt: number;
  /** 只有第一次同意時 Google 才會發；續期的回應不含它 */
  refreshToken: string | null;
};

/**
 * 該不該先續期再打 API。
 * 提前 5 分鐘是為了避開「檢查時還沒過期、送出時已經過期」的那段空窗。
 */
export function shouldRefresh(expiresAt: number, now: number = Date.now()): boolean {
  return expiresAt - now <= REFRESH_MARGIN_MS;
}

/** Google 回的是 expires_in（秒），存成絕對時間才不會因為存放時間變長而算錯 */
export function expiryFrom(expiresInSec: number, now: number = Date.now()): number {
  return now + expiresInSec * 1000;
}

export const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

export type ExchangeArgs = {
  code: string;
  verifier: string;
  clientId: string;
  redirectUri: string;
  fetch?: typeof fetch;
  now?: number;
};

/** 授權碼換 token。PKCE 沒有 client_secret，verifier 就是證明 */
export async function exchangeCode(a: ExchangeArgs): Promise<TokenSet> {
  const r = await post(a.fetch ?? fetch, {
    client_id: a.clientId,
    code: a.code,
    code_verifier: a.verifier,
    grant_type: 'authorization_code',
    redirect_uri: a.redirectUri,
  });
  return {
    accessToken: r.access_token,
    expiresAt: expiryFrom(r.expires_in, a.now),
    refreshToken: r.refresh_token ?? null,
  };
}

export type RefreshArgs = {
  refreshToken: string;
  clientId: string;
  fetch?: typeof fetch;
  now?: number;
};

/**
 * 續期。回應通常不含新的 refresh token，所以這裡回 null，由呼叫端保留舊的
 * ——把 null 寫回去會讓使用者下次開 App 就得重新登入。
 */
export async function refreshTokens(a: RefreshArgs): Promise<TokenSet> {
  const r = await post(a.fetch ?? fetch, {
    client_id: a.clientId,
    refresh_token: a.refreshToken,
    grant_type: 'refresh_token',
  });
  return {
    accessToken: r.access_token,
    expiresAt: expiryFrom(r.expires_in, a.now),
    refreshToken: r.refresh_token ?? null,
  };
}

async function post(f: typeof fetch, params: Record<string, string>): Promise<TokenResponse> {
  const res = await f(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  if (!res.ok) throw new Error(`token endpoint ${res.status}`);
  return (await res.json()) as TokenResponse;
}
