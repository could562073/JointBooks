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
};

/** §8.3 接受邀請頁。四個分支的文案都在這裡，狀態由 joinFlow 算好 */
export function JoinPage({ state, onJoin, onBrowse, onHome }: Props) {
  if (state.kind === 'expired' || state.kind === 'invalid') {
    return (
      <div className={styles.page} data-testid="join-page" data-state={state.kind}>
        <Mantou variant="empty" width={96} />
        <h1 className={styles.title}>這個邀請已失效</h1>
        <p className={styles.body}>請對方重新產生一條邀請連結。</p>
        <button type="button" className={styles.cta} onClick={onHome} data-testid="join-home">
          回首頁
        </button>
      </div>
    );
  }

  if (state.kind === 'browsing') {
    return (
      <div className={styles.page} data-testid="join-page" data-state="browsing">
        <Mantou variant="empty" width={96} />
        <h1 className={styles.title}>你正在試用</h1>
        <p className={styles.body}>目前沒有加入任何帳本，看到的資料只存在這支手機上。</p>
        <button type="button" className={styles.cta} onClick={onJoin} data-testid="join-cta">
          用 Google 登入並加入
        </button>
      </div>
    );
  }

  const already = state.kind === 'already';

  return (
    <div className={styles.page} data-testid="join-page" data-state={state.kind}>
      <div className={styles.card} data-testid="join-card">
        <div className={styles.pair} aria-hidden="true">
          <Mantou variant="full" width={54} />
          <Mantou variant="full" width={54} />
        </div>
        <p className={styles.from}>對方邀請你一起記帳</p>
        <p className={styles.ledger}>加拿大共用記帳</p>
        <span className={styles.role}>可編輯</span>
      </div>

      {already ? (
        <p className={styles.body} data-testid="join-already">你已在這本帳裡。</p>
      ) : (
        <ul className={styles.facts}>
          <li>你會拿到這本帳的編輯權限，可以新增與修改紀錄。</li>
          <li>只會取得建立與編輯這一份試算表的權限。</li>
          <li>兩人看到的是同一份資料，改動會互相同步。</li>
        </ul>
      )}

      <button type="button" className={styles.cta} onClick={onJoin} data-testid="join-cta">
        {already ? '進入帳本' : '用 Google 登入並加入'}
      </button>

      {!already && (
        <button type="button" className={styles.ghost} onClick={onBrowse} data-testid="join-browse">
          先看看，暫不加入
        </button>
      )}
    </div>
  );
}
