import { DUR, EASE } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import { isBusy, type SyncState } from '../sync/state';
import { syncLabel } from '../sync/syncLabels';
import styles from './SyncStatus.module.css';

type Props = {
  state: SyncState;
  lastSyncAt: number | null;
  /** 點一下手動重試 */
  onRetry?(): void;
  /** 外殼頂端的膠囊（原型：6px 圓點、10.5px 粗體綠字） */
  tone?: 'pill';
};

/**
 * MOTION #26：同步中把綠點換成 1.5px 圓環 spin 900ms linear 無限；
 * 完成縮回圓點 200ms，文字改「已同步 · 剛剛」。
 */
export function SyncStatus({ state, lastSyncAt, onRetry, tone }: Props) {
  const reduced = useReducedMotion();
  const busy = isBusy(state);
  const pill = tone === 'pill';
  const rowClass = pill ? `${styles.row} ${styles.rowPill}` : styles.row;

  const content = (
    <>
      <span
        className={[styles.dot, pill ? styles.dotPill : '', busy && !reduced ? styles.spinning : '']
          .filter(Boolean).join(' ')}
        style={{
          ['--spin' as string]: `${DUR.syncSpin}ms`,
          transition: reduced ? 'none' : `all ${DUR.syncSettle}ms ${EASE.exit}`,
        }}
        data-state={state}
        data-testid="sync-dot"
        aria-hidden="true"
      />
      <span
        className={pill ? `${styles.text} ${styles.textPill}` : styles.text}
        data-state={state}
        data-testid="sync-text"
      >
        {syncLabel(state, lastSyncAt)}
      </span>
    </>
  );

  // 失敗時點一下重試；需要重新連線、或還沒登入時點一下就是連線（Google 要求由使用者操作觸發）。
  // 其他狀態點下去沒有意義，做成按鈕只會誤導
  if ((state === 'error' || state === 'needs-auth' || state === 'local') && onRetry) {
    return (
      <button type="button" className={rowClass} onClick={onRetry} data-testid="sync-status">
        {content}
      </button>
    );
  }

  return (
    <span className={rowClass} role="status" data-testid="sync-status">{content}</span>
  );
}
