import { Mantou } from './Mantou';
import { SyncStatus } from './SyncStatus';
import type { SyncState } from '../sync/state';
import styles from './ShellHeader.module.css';

type Props = {
  syncState: SyncState;
  lastSyncAt: number | null;
  onRetrySync?(): void;
};

/**
 * 原型外殼最上面那一列：兩人的頭像、同步狀態藥丸、右邊的 our book，
 * 外加右上與左側兩顆裝飾圓。三個主畫面共用，所以掛在外殼而不是各畫面裡。
 *
 * 裝飾圓放在這裡（而不是各畫面）是因為它們要被外殼的 overflow: hidden 切掉，
 * 且不能跟著分頁的進場動畫一起位移——原型裡它們是靜止的背景。
 */
export function ShellHeader({ syncState, lastSyncAt, onRetrySync }: Props) {
  return (
    <>
      <span className={`${styles.decor} ${styles.decorA}`} aria-hidden="true" />
      <span className={`${styles.decor} ${styles.decorB}`} aria-hidden="true" />

      <header className={styles.bar} data-testid="shell-header">
        <div className={styles.left}>
          <span className={styles.avatars}>
            <Mantou variant="full" width={30} />
            {/* 第二顆往左疊，靠底色描邊把兩顆分開 */}
            <Mantou variant="partner" width={30} className={styles.second} />
          </span>

          <span className={styles.pill}>
            <SyncStatus state={syncState} lastSyncAt={lastSyncAt} {...(onRetrySync ? { onRetry: onRetrySync } : {})} />
          </span>
        </div>

        <span className={styles.brand}>our book</span>
      </header>
    </>
  );
}
