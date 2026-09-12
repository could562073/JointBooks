import type { ReactNode } from 'react';
import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import styles from './FieldRow.module.css';

type Props = {
  /** 左側小標，例如「日期」「分類」 */
  label: string;
  /** 右側目前值；可以是文字，也可以是圖示 + 文字 */
  value: ReactNode;
  open: boolean;
  onToggle(): void;
  /** 展開後的內容 */
  children: ReactNode;
  testId: string;
};

/**
 * §5 日期欄與增補檔 B-3 分類區共用的收合列。
 *
 * B-3 明說分類摘要列「樣式比照既有的日期欄」，動畫也沿用 MOTION #38，
 * 所以做成同一個元件而不是兩份各自演化的複製品。
 */
export function FieldRow({ label, value, open, onToggle, children, testId }: Props) {
  const reduced = useReducedMotion();

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.row}
        onClick={onToggle}
        aria-expanded={open}
        data-open={open ? '' : undefined}
        data-testid={testId}
      >
        <span className={styles.label}>{label}</span>
        <span className={styles.value}>{value}</span>
        {/* MOTION #38：▾ 轉 180°，不是換成 ▴ */}
        <span
          className={styles.chevron}
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: reduced ? 'none' : `transform ${DUR.chevron}ms ${EASE.exit}`,
          }}
          data-testid={`${testId}-chevron`}
          aria-hidden="true"
        >▾</span>
      </button>

      {open && (
        <div
          className={reduced ? undefined : styles.panelIn}
          style={{ ['--pop' as string]: `${DUR.popIn}ms` }}
          data-testid={`${testId}-panel`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
