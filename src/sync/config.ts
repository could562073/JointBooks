/**
 * §14.2 需要的設定：只有 Google 用戶端 ID。
 *
 * 登入改走 Google Identity Services 的 token model（全在瀏覽器完成），不再需要
 * 重新導向網址，也不需要用戶端密碼。
 *
 * 沒設定 client id 時整個同步層處於「未設定」狀態：App 照常以本機模式運作，
 * 不會嘗試登入也不會報錯。這讓專案在拿到 OAuth 憑證之前仍然可以開發與測試。
 */
export type SyncConfig = {
  clientId: string | null;
};

export function readConfig(env: Record<string, string | undefined>): SyncConfig {
  return { clientId: env.VITE_GOOGLE_CLIENT_ID?.trim() || null };
}

export function isConfigured(c: SyncConfig): boolean {
  return c.clientId !== null;
}
