import type { ReactNode } from 'react';
import { DUR, EASE } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import styles from './ConfirmDialog.module.css';

type Props = {
  title: string;
  /** 被刪的東西是什麼，例如「外食 · 飲料　-$12.50」 */
  subject?: ReactNode;
  description: string;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
  testId?: string;
};

/**
 * §0 的兩個刪除確認視窗（刪紀錄 §5、刪分類 §7）共用同一個彈窗（MOTION #37）。
 *
 * 遮罩點下去等同取消——誤開時最自然的退出動作是點旁邊，逼使用者找「取消」
 * 鈕只會讓人下意識按到「刪除」。
 */
export function ConfirmDialog({
  title, subject, description, confirmLabel, onConfirm, onCancel, testId = 'confirm',
}: Props) {
  const reduced = useReducedMotion();

  return (
    <div
      className={reduced ? styles.scrim : `${styles.scrim} ${styles.scrimIn}`}
      style={{ ['--scrim' as string]: `${DUR.scrimIn}ms`, ['--dialog' as string]: `${DUR.dialogIn}ms` }}
      onClick={onCancel}
      data-testid={`${testId}-scrim`}
    >
      <div
        className={reduced ? styles.box : `${styles.box} ${styles.boxIn}`}
        // 點窗內不該關掉整個彈窗
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
      >
        <h2 className={styles.title}>{title}</h2>
        {subject && <div className={styles.subject} data-testid={`${testId}-subject`}>{subject}</div>}
        <p className={styles.desc}>{description}</p>

        <div className={styles.actions}>
          <button
            type="button" className={styles.cancel} onClick={onCancel}
            data-testid={`${testId}-cancel`}
          >取消</button>
          <button
            type="button" className={styles.confirm} onClick={onConfirm}
            data-testid={`${testId}-confirm`}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

/** 給外層用：關閉動畫的時長，確認後面板要等它演完再收（MOTION #37） */
export const CONFIRM_OUT_MS = DUR.rowCollapse;
export const CONFIRM_EASE = EASE.enter;
