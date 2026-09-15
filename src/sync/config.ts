import type { LedgerEnv } from '../sheets/ledgerSheet';

/**
 * §14.2 需要的設定：Google 用戶端 ID，以及這一份 App 屬於哪個環境。
 *
 * 登入改走 Google Identity Services 的 token model（全在瀏覽器完成），不再需要
 * 重新導向網址，也不需要用戶端密碼。
 *
 * 沒設定 client id 時整個同步層處於「未設定」狀態：App 照常以本機模式運作，
 * 不會嘗試登入也不會報錯。這讓專案在拿到 OAuth 憑證之前仍然可以開發與測試。
 *
 * 環境看 Vite 的 MODE：只有 `vite build`（MODE＝production）出來的才是正式版，
 * `npm run dev` 與測試都是開發版。開發版只建立、加入開發帳本，正式版只碰正式帳本。
 */
export type SyncConfig = {
  clientId: string | null;
  ledgerEnv: LedgerEnv;
  /**
   * 登入端點的網址（Cloudflare Worker，見 worker/README.md）。
   * 有填就走授權碼流程：登入一次之後用 refresh token 自動續期，不必每小時點一下。
   * 沒填就維持 token model（一小時後要點一下重新連線）。
   */
  authProxyUrl: string | null;
};

export function readConfig(env: Record<string, string | undefined>): SyncConfig {
  return {
    clientId: env.VITE_GOOGLE_CLIENT_ID?.trim() || null,
    ledgerEnv: env.MODE === 'production' ? 'prod' : 'dev',
    authProxyUrl: env.VITE_AUTH_PROXY_URL?.trim().replace(/\/$/, '') || null,
  };
}

export function isConfigured(c: SyncConfig): boolean {
  return c.clientId !== null;
}
