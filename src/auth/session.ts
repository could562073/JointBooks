import { db } from '../db/schema';
import { buildAuthUrl, challengeOf, parseCallback, randomState, randomVerifier, SCOPES } from './pkce';
import { exchangeCode, refreshTokens, shouldRefresh, type TokenSet } from './tokens';

/**
 * §14.2：access token 存記憶體，refresh token 存 IndexedDB（不要放 localStorage）。
 *
 * verifier 與 state 也走 IndexedDB：redirect 流程會整個重新載入頁面，記憶體留不住，
 * 而 localStorage 同源的任何腳本都讀得到。
 */
const K = {
  verifier: 'auth.verifier',
  state: 'auth.state',
  refresh: 'auth.refreshToken',
} as const;

/** access token 只活在記憶體裡 */
let live: TokenSet | null = null;

async function put(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

async function take<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export type SessionConfig = { clientId: string; redirectUri: string };

/** 送使用者去 Google。回來時會落在 /auth/callback */
export async function startSignIn(
  cfg: SessionConfig,
  go: (url: string) => void = (u) => { location.href = u; }
): Promise<void> {
  const verifier = randomVerifier();
  const state = randomState();
  await put(K.verifier, verifier);
  await put(K.state, state);

  go(buildAuthUrl({
    clientId: cfg.clientId,
    redirectUri: cfg.redirectUri,
    challenge: await challengeOf(verifier),
    state,
    scopes: SCOPES,
  }));
}

export type CallbackOutcome =
  | { kind: 'signed-in' }
  | { kind: 'error'; error: string }
  | { kind: 'none' };

/** 處理 /auth/callback。成功後 refresh token 進 IndexedDB，access token 留記憶體 */
export async function completeSignIn(
  cfg: SessionConfig,
  search: string,
  deps: { fetch?: typeof fetch } = {}
): Promise<CallbackOutcome> {
  const expected = (await take<string>(K.state)) ?? null;
  const r = parseCallback(search, expected);
  if (r.kind !== 'code') return r.kind === 'error' ? { kind: 'error', error: r.error } : { kind: 'none' };

  const verifier = await take<string>(K.verifier);
  if (!verifier) return { kind: 'error', error: 'missing_verifier' };

  try {
    const tokens = await exchangeCode({
      code: r.code, verifier,
      clientId: cfg.clientId, redirectUri: cfg.redirectUri,
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
    });
    live = tokens;
    if (tokens.refreshToken) await put(K.refresh, tokens.refreshToken);
    // 用完就丟：留著只是多一份可以被翻出來的一次性密鑰
    await db.meta.bulkDelete([K.verifier, K.state]);
    return { kind: 'signed-in' };
  } catch (e) {
    return { kind: 'error', error: e instanceof Error ? e.message : 'exchange_failed' };
  }
}

/**
 * 取一個可用的 access token，必要時先續期。
 * 續期失敗要讓呼叫端知道（丟出來），§14.2：導回登入頁但保留本地資料。
 */
export async function accessToken(
  cfg: SessionConfig,
  deps: { fetch?: typeof fetch; now?: number } = {}
): Promise<string> {
  const now = deps.now ?? Date.now();
  if (live && !shouldRefresh(live.expiresAt, now)) return live.accessToken;

  const rt = await take<string>(K.refresh);
  if (!rt) throw new Error('not_signed_in');

  const next = await refreshTokens({
    refreshToken: rt, clientId: cfg.clientId,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
    ...(deps.now !== undefined ? { now: deps.now } : {}),
  });
  // 續期回應通常不含新的 refresh token，保留舊的（見 tokens.ts）
  live = { ...next, refreshToken: next.refreshToken ?? rt };
  if (next.refreshToken) await put(K.refresh, next.refreshToken);
  return live.accessToken;
}

export async function hasSession(): Promise<boolean> {
  return (await take<string>(K.refresh)) !== undefined;
}

export async function signOut(): Promise<void> {
  live = null;
  await db.meta.bulkDelete([K.verifier, K.state, K.refresh]);
}

/** 測試用：清掉記憶體裡的 access token */
export function __resetLiveToken(): void {
  live = null;
}
