import { Mantou } from '../components/Mantou';
import type { JoinState } from './joinFlow';
import styles from './JoinPage.module.css';

type Props = {
  state: JoinState;
  /** 主 CTA：用 Google 登入並加入 */
  onJoin(): void;
  /** 「先看看，暫不加入」→ 唯讀試用 */
  onBrowse(): void;
  onHome(): void;
  /** 連線 Google、確認讀得到帳本中 */
  busy?: boolean;
  /** 例如「對方還沒把帳本分享給你」 */
  error?: string | null;
};

/** §8.3 接受邀請頁。四個分支的文案都在這裡，狀態由 joinFlow 算好 */
export function JoinPage({ state, onJoin, onBrowse, onHome, busy = false, error = null }: Props) {
  if (state.kind === 'expired' || state.kind === 'invalid') {
    return (
      <div className={styles.page} data-testid="join-page" data-state={state.kind}>
        <span className={styles.decor} aria-hidden="true" />
        <div className={styles.main}>
          <Mantou variant="empty" width={96} />
          <h1 className={styles.title}>這個邀請已失效</h1>
          <p className={styles.body}>請對方重新產生一條邀請連結。</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cta} onClick={onHome} data-testid="join-home">
            回首頁
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === 'browsing') {
    return (
      <div className={styles.page} data-testid="join-page" data-state="browsing">
        <span className={styles.decor} aria-hidden="true" />
        <div className={styles.main}>
          <Mantou variant="empty" width={96} />
          <h1 className={styles.title}>你正在試用</h1>
          <p className={styles.body}>目前沒有加入任何帳本，看到的資料只存在這支手機上。</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.cta} onClick={onJoin} data-testid="join-cta">
            用 Google 登入並加入
          </button>
        </div>
      </div>
    );
  }

  const already = state.kind === 'already';
  const preview = state.kind === 'invite' && state.preview === true;

  return (
    <div className={styles.page} data-testid="join-page" data-state={state.kind}>
      <span className={styles.decor} aria-hidden="true" />
      {preview && (
        <p className={styles.previewNote} data-testid="join-preview-note">
          預覽 · 這是對方點開邀請連結後看到的畫面
        </p>
      )}
      <div className={styles.main}>
        <div className={styles.card} data-testid="join-card">
          <div className={styles.pair} aria-hidden="true">
            <Mantou variant="full" width={44} minimal />
            <Mantou
              variant="partner" width={44} minimal ring="var(--c-card)" ringWidth={3}
              className={styles.partner}
            />
          </div>
          <p className={styles.from}>你受邀一起記帳</p>
          <p className={styles.ledger}>饅頭共享記帳</p>
          <span className={styles.role}>
            <span className={styles.roleDot} />
            加入後可新增與編輯所有紀錄
          </span>
        </div>

        {already ? (
          <p className={styles.body} data-testid="join-already">你已在這本帳裡。</p>
        ) : (
          <div className={styles.facts}>
            <p className={styles.factsHeading}>加入後會發生的事</p>
            <ol className={styles.factsList}>
              <li>
                <span className={styles.factNumber}>1</span>
                <span className={styles.factText}>你的 Google 帳號成為帳本成員</span>
              </li>
              <li>
                <span className={styles.factNumber}>2</span>
                <span className={styles.factText}>同時被加為那份 Sheet 的編輯者</span>
              </li>
              <li>
                <span className={styles.factNumber}>3</span>
                <span className={styles.factText}>加入之後，大家看到的都是同一份資料</span>
              </li>
            </ol>
          </div>
        )}
      </div>

      {state.kind === 'invite' && state.switching && (
        <p className={styles.switchNote} role="note" data-testid="join-switch-note">
          這台裝置目前記的是另一本帳。加入後會改記這一本；你原本的紀錄還在你自己的 Google 試算表裡，不會搬進來。
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button" className={styles.cta} onClick={onJoin} disabled={busy}
          data-testid="join-cta"
        >
          {busy ? '連線中…' : preview ? '結束預覽' : already ? '進入帳本' : '用 Google 登入並加入'}
        </button>

        {error && <p className={styles.error} role="alert" data-testid="join-error">{error}</p>}

        {!already && !preview && (
          <button type="button" className={styles.ghost} onClick={onBrowse} data-testid="join-browse">
            先看看，暫不加入
          </button>
        )}
      </div>
    </div>
  );
}
