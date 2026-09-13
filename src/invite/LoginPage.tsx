import { useState } from 'react';
import { Mantou } from '../components/Mantou';
import styles from './LoginPage.module.css';

type Props = {
  onSignIn(): void;
  disabled?: boolean;
  /** 連線 Google 或建立帳本中 */
  busy?: boolean;
  error?: string | null;
  /**
   * 用邀請連結加入。iPhone 加到主畫面的 App 跟 Safari 不共用儲存空間：她在 Safari
   * 點開連結、再加到主畫面之後，主畫面上的 App 不會知道那條連結，所以要能在這裡貼上。
   */
  onJoinLink?(link: string): void;
};

/** §8.3 登入頁：大饅頭（有腳）+ 標語 + Google 登入按鈕 + 權限說明小字 */
export function LoginPage({ onSignIn, disabled = false, busy = false, error = null, onJoinLink }: Props) {
  const [joining, setJoining] = useState(false);
  const [link, setLink] = useState('');

  return (
    <div className={styles.page} data-testid="login-page">
      <span className={styles.decorA} aria-hidden="true" />
      <span className={styles.decorB} aria-hidden="true" />

      <div className={styles.hero}>
        <span className={styles.mantouWrapper}>
          <Mantou variant="full" width={104} breathing data-testid="login-mantou" />
        </span>

        <h1 className={styles.tagline}>兩人一本，<br />加拿大生活記帳</h1>

        <p className={styles.description}>
          用 Google 登入，帳本會建在你的雲端硬碟上；資料就是那份 Sheet，你隨時能自己打開看。
        </p>
      </div>

      <div className={styles.actions}>
        <button
          type="button" className={styles.google} onClick={onSignIn}
          disabled={disabled || busy} data-testid="login-google"
        >
          <span className={styles.googleIcon} aria-hidden="true" />
          <span>{busy ? '連線中…' : '使用 Google 登入'}</span>
        </button>

        {/* §8.3：權限說明小字。要跟實際請求的範圍一致（使用者裁決：試算表＋本 App 建立的檔案） */}
        <p className={styles.scope} data-testid="login-scope">
          會請你授權讀寫 Google 試算表，用來存放與同步這本帳
        </p>

        {error && <p className={styles.error} role="alert" data-testid="login-error">{error}</p>}

        {onJoinLink && !joining && (
          <button
            type="button" className={styles.joinToggle} onClick={() => setJoining(true)}
            disabled={busy} data-testid="login-join-toggle"
          >我收到了邀請連結</button>
        )}

        {onJoinLink && joining && (
          <form
            className={styles.joinRow}
            onSubmit={(e) => {
              e.preventDefault();
              const v = link.trim();
              if (v) onJoinLink(v);
            }}
            data-testid="login-join-form"
          >
            <input
              className={styles.joinInput}
              type="url"
              inputMode="url"
              autoCapitalize="none"
              placeholder="貼上對方傳來的邀請連結"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              aria-label="邀請連結"
              data-testid="login-join-input"
            />
            <button type="submit" className={styles.joinBtn} disabled={busy} data-testid="login-join-submit">
              加入
            </button>
          </form>
        )}

        {disabled && (
          <p className={styles.unconfigured} data-testid="login-unconfigured">
            尚未設定 Google 用戶端 ID，目前以純本機模式運作。
          </p>
        )}
      </div>
    </div>
  );
}
