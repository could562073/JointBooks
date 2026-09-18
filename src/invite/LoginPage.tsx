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
  /** 不登入也能用：帳只存在這台手機，之後可以在配置頁登入（使用者要求） */
  onUseLocally?(): void;
};

/**
 * §8.3 登入頁：大饅頭（有腳）+ 標語 + 兩條路。
 *
 * 沒有後端，App 不知道「是不是已經有人建過帳本」，所以讓使用者自己選（使用者裁決）：
 *   - 建立自己的帳本：成為主帳號，之後可以在配置頁邀請別人。按下去先確認一次，
 *     免得對方已經建好、自己又建一本，變成兩本分開的帳。
 *   - 我收到了邀請連結：貼上連結加入別人的帳本。
 */
export function LoginPage({ onSignIn, disabled = false, busy = false, error = null, onJoinLink, onUseLocally }: Props) {
  const [joining, setJoining] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [link, setLink] = useState('');

  return (
    <div className={styles.page} data-testid="login-page">
      <span className={styles.decorA} aria-hidden="true" />
      <span className={styles.decorB} aria-hidden="true" />

      <div className={styles.hero}>
        <span className={styles.mantouWrapper}>
          <Mantou variant="full" width={104} breathing data-testid="login-mantou" />
        </span>

        <h1 className={styles.tagline}>饅頭共享，<br />生活記帳本</h1>

        <p className={styles.description}>
          用 Google 登入，帳本會建在你的雲端硬碟上；資料就是那份 Sheet，你隨時能自己打開看。
        </p>
      </div>

      <div className={styles.actions}>
        {confirming && !busy ? (
          <div className={styles.confirm} role="group" aria-label="建立帳本" data-testid="login-create-confirm">
            <p className={styles.confirmTitle}>建立你自己的帳本？</p>
            <p className={styles.confirmBody}>
              你會是這本帳的主帳號，可以自己記，之後也能在配置頁邀請別人一起記。
              這個 Google 帳號之前建過的話，會直接接回那一本。
            </p>
            <p className={styles.confirmBody}>
              <strong>對方已經建好帳本的話</strong>，請改用他傳給你的邀請連結加入，不然會變成兩本分開的帳。
            </p>
            {/* connect 必須在這個點擊事件裡同步呼叫，瀏覽器才不會擋掉 Google 視窗 */}
            <button
              type="button" className={styles.google}
              onClick={() => { setConfirming(false); onSignIn(); }}
              data-testid="login-create-go"
            >
              <span className={styles.googleIcon} aria-hidden="true" />
              <span>用 Google 建立帳本</span>
            </button>
            <div className={styles.confirmRow}>
              {onJoinLink && (
                <button
                  type="button" className={styles.textBtn}
                  onClick={() => { setConfirming(false); setJoining(true); }}
                  data-testid="login-create-has-link"
                >我有邀請連結</button>
              )}
              <button
                type="button" className={styles.textBtn}
                onClick={() => setConfirming(false)}
                data-testid="login-create-cancel"
              >取消</button>
            </div>
          </div>
        ) : (
          <button
            type="button" className={styles.google} onClick={() => setConfirming(true)}
            disabled={disabled || busy} data-testid="login-google"
          >
            <span className={styles.googleIcon} aria-hidden="true" />
            <span>{busy ? '連線中…' : '用 Google 建立我的帳本'}</span>
          </button>
        )}

        {/* §8.3：權限說明小字。要跟實際請求的範圍一致（使用者裁決：試算表＋本 App 建立的檔案） */}
        <p className={styles.scope} data-testid="login-scope">
          會請你授權讀寫 Google 試算表，用來存放與同步這本帳
        </p>

        {onUseLocally && !(confirming && !busy) && (
          <>
            <button
              type="button" className={styles.localBtn} onClick={onUseLocally}
              disabled={busy} data-testid="login-local"
            >先不登入，直接使用</button>
            <p className={styles.localHint} data-testid="login-local-hint">
              帳只存在這台手機，之後可以在配置頁登入
            </p>
          </>
        )}

        {error && <p className={styles.error} role="alert" data-testid="login-error">{error}</p>}

        {onJoinLink && !joining && !confirming && (
          <button
            type="button" className={styles.joinToggle} onClick={() => setJoining(true)}
            disabled={busy} data-testid="login-join-toggle"
          >我收到了邀請連結，要加入別人的帳本</button>
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
