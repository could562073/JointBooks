/**
 * §14.2：OAuth 2.0 授權碼流程 + PKCE，redirect 模式
 * （standalone PWA 擋 popup，所以不能用 popup flow）。
 */

/** RFC 7636 的 unreserved 字元集 */
const UNRESERVED = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/** RFC 7636 §4.1：43–128 字。取上限附近，熵越多越好 */
export const VERIFIER_LEN = 96;

/**
 * base64url（無 padding）。
 * 不能用 btoa 的結果直接送出去：`+` `/` `=` 在 query string 裡都有別的意思。
 */
export function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** code_verifier。用 getRandomValues 而不是 Math.random——這是安全性參數 */
export function randomVerifier(len = VERIFIER_LEN): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  // 取模會有極輕微的偏差，但字元集 64 個、位元組 256，256 % 64 === 0，剛好整除沒有偏差
  return [...bytes].map((b) => UNRESERVED[b % UNRESERVED.length]).join('');
}

/** state：防 CSRF，跟 verifier 一樣要不可預測 */
export function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

/** code_challenge = BASE64URL(SHA256(verifier))，method S256 */
export async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export type AuthUrlArgs = {
  clientId: string;
  redirectUri: string;
  challenge: string;
  state: string;
  scopes: readonly string[];
};

/**
 * §14.2 的 scope：只要 drive.file（只能存取本 App 建立的檔案）+ openid email profile。
 * 不要求整個雲端硬碟權限，這是刻意的——使用者看到的授權畫面差很多。
 */
export const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
] as const;

export const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';

export function buildAuthUrl(a: AuthUrlArgs): string {
  const q = new URLSearchParams({
    client_id: a.clientId,
    redirect_uri: a.redirectUri,
    response_type: 'code',
    scope: a.scopes.join(' '),
    code_challenge: a.challenge,
    code_challenge_method: 'S256',
    state: a.state,
    // refresh token 只在第一次同意時發；offline + consent 確保拿得到
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${AUTH_ENDPOINT}?${q}`;
}

export type CallbackResult =
  | { kind: 'code'; code: string; state: string }
  | { kind: 'error'; error: string }
  | { kind: 'none' };

/**
 * 解析導回來的 query string。
 * state 不符一律當錯誤——那表示這個回呼不是我們發起的（CSRF）。
 */
export function parseCallback(search: string, expectedState: string | null): CallbackResult {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  const error = q.get('error');
  if (error) return { kind: 'error', error };

  const code = q.get('code');
  if (!code) return { kind: 'none' };

  const state = q.get('state');
  if (!expectedState || state !== expectedState) return { kind: 'error', error: 'state_mismatch' };

  return { kind: 'code', code, state };
}
