/**
 * §14.2／§14.3 需要的設定。
 *
 * 沒設定 client id 時整個同步層處於「未設定」狀態：App 照常以本機模式運作，
 * 不會嘗試登入也不會報錯。這讓專案在拿到 OAuth 憑證之前仍然可以開發與測試。
 */
export type SyncConfig = {
  clientId: string | null;
  redirectUri: string;
};

export function readConfig(env: Record<string, string | undefined>, origin: string): SyncConfig {
  const clientId = env.VITE_GOOGLE_CLIENT_ID?.trim() || null;
  return {
    clientId,
    // redirect_uri 必須與 Google Cloud Console 上登記的完全一致
    redirectUri: `${origin}/auth/callback`,
  };
}

export function isConfigured(c: SyncConfig): boolean {
  return c.clientId !== null;
}
