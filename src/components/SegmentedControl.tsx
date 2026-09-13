import { DUR, EASE } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import styles from './SegmentedControl.module.css';

export type Segment<T extends string> = { key: T; label: string };

/** 滑塊落點。跟月曆與分頁列同一套：算好百分比，不寫 CSS calc */
export function segmentLeft(index: number, count: number): string {
  return `${((index * 100) / count).toFixed(4)}%`;
}

type Props<T extends string> = {
  segments: readonly Segment<T>[];
  value: T;
  onChange(v: T): void;
  /** 滑塊底色；預設白色（MOTION #32 的統計頁分段） */
  fill?: string;
  /** 選中時的文字色 */
  activeColor?: string;
  /**
   * 不撐滿整列、按鈕照字寬排。記一筆面板頂部那顆是這樣（原型 padding 7px 16px），
   * 統計頁的週／月／年則是撐滿整列。
   */
  compact?: boolean;
  testId: string;
};

/**
 * §5 支出／收入（MOTION #36）與 §6 週／月／年（MOTION #32）共用的分段控制。
 *
 * 兩者的規格是同一件事：選中框是一塊獨立滑塊、位移 420ms、文字淡轉、
 * 按鈕本身不各自變底色。差別只有滑塊顏色，所以做成 prop 而不是兩份元件。
 */
export function SegmentedControl<T extends string>({
  segments, value, onChange, fill = '#FFFFFF', activeColor, compact = false, testId,
}: Props<T>) {
  const reduced = useReducedMotion();
  const index = Math.max(0, segments.findIndex((s) => s.key === value));

  return (
    <div className={compact ? `${styles.wrap} ${styles.compact}` : styles.wrap} data-testid={testId}>
      <span
        className={styles.slider}
        style={{
          left: segmentLeft(index, segments.length),
          width: `${(100 / segments.length).toFixed(4)}%`,
          background: fill,
          transition: reduced
            ? 'none'
            // 位移與變色是兩段不同的時長：滑塊要滑得慢一點才看得出來在移動，
            // 顏色跟太久反而像沒跟上（MOTION #36）
            : `left ${DUR.slide}ms ${EASE.move}, background ${DUR.kindColor}ms ${EASE.exit}`,
        }}
        aria-hidden="true"
        data-testid={`${testId}-slider`}
      />

      {segments.map((s) => {
        const active = s.key === value;
        return (
          <button
            key={s.key}
            type="button"
            className={styles.seg}
            onClick={() => onChange(s.key)}
            aria-pressed={active}
            data-active={active ? '' : undefined}
            data-testid={`${testId}-${s.key}`}
            style={{
              ...(active && activeColor ? { color: activeColor } : {}),
              transition: reduced ? 'none' : `color ${DUR.popIn}ms ${EASE.exit}`,
            }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
