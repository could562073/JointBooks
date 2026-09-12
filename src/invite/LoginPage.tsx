import { Mantou } from '../components/Mantou';
import styles from './LoginPage.module.css';

type Props = { onSignIn(): void; disabled?: boolean };

/** §8.3 登入頁：大饅頭（有腳）+ 標語 + Google 登入按鈕 + 權限說明小字 */
export function LoginPage({ onSignIn, disabled = false }: Props) {
  return (
    <div className={styles.page} data-testid="login-page">
      <Mantou variant="full" width={112} breathing data-testid="login-mantou" />

      <h1 className={styles.tagline}>兩人一本，加拿大生活記帳</h1>

      <button
        type="button" className={styles.google} onClick={onSignIn}
        disabled={disabled} data-testid="login-google"
      >
        <span className={styles.dots} aria-hidden="true">
          <i style={{ background: '#4285F4' }} />
          <i style={{ background: '#EA4335' }} />
          <i style={{ background: '#FBBC05' }} />
          <i style={{ background: '#34A853' }} />
        </span>
        使用 Google 登入
      </button>

      {/* §8.3：權限說明小字。scope 只有 drive.file，這句話要跟實際請求一致 */}
      <p className={styles.scope} data-testid="login-scope">
        只會取得建立與編輯這一份試算表的權限
      </p>

      {disabled && (
        <p className={styles.unconfigured} data-testid="login-unconfigured">
          尚未設定 Google 用戶端 ID，目前以純本機模式運作。
        </p>
      )}
    </div>
  );
}
