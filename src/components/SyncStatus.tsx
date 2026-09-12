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
};

/**
 * MOTION #26：同步中把綠點換成 1.5px 圓環 spin 900ms linear 無限；
 * 完成縮回圓點 200ms，文字改「已同步 · 剛剛」。
 */
export function SyncStatus({ state, lastSyncAt, onRetry }: Props) {
  const reduced = useReducedMotion();
  const busy = isBusy(state);

  const content = (
    <>
      <span
        className={busy && !reduced ? `${styles.dot} ${styles.spinning}` : styles.dot}
        style={{
          ['--spin' as string]: `${DUR.syncSpin}ms`,
          transition: reduced ? 'none' : `all ${DUR.syncSettle}ms ${EASE.exit}`,
        }}
        data-state={state}
        data-testid="sync-dot"
        aria-hidden="true"
      />
      <span className={styles.text} data-testid="sync-text">
        {syncLabel(state, lastSyncAt)}
      </span>
    </>
  );

  // 失敗時才給點擊重試；其他狀態點下去沒有意義，做成按鈕只會誤導
  if (state === 'error' && onRetry) {
    return (
      <button type="button" className={styles.row} onClick={onRetry} data-testid="sync-status">
        {content}
      </button>
    );
  }

  return (
    <span className={styles.row} role="status" data-testid="sync-status">{content}</span>
  );
}
