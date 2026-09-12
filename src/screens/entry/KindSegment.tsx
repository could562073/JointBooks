import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import type { CategoryKind } from '../../domain/types';
import styles from './KindSegment.module.css';

/** 順序就是滑塊的座標 */
const SEGMENTS: { key: CategoryKind; label: string }[] = [
  { key: 'expense', label: '支出' },
  { key: 'income', label: '收入' },
];

/** MOTION #36：滑塊底色支出紫、收入粉 */
const FILL: Record<CategoryKind, string> = {
  expense: '#B7A6E5',
  income: '#DDA6D0',
};

export function segmentLeft(index: number): string {
  return `${((index * 100) / SEGMENTS.length).toFixed(4)}%`;
}

type Props = {
  kind: CategoryKind;
  onChange(k: CategoryKind): void;
};

/**
 * §5 頂部的支出／收入分段控制（MOTION #36）。
 * 選中框是一塊獨立滑塊，按鈕本身不各自變底色——跟月曆與分頁列同一個做法。
 */
export function KindSegment({ kind, onChange }: Props) {
  const reduced = useReducedMotion();
  const index = Math.max(0, SEGMENTS.findIndex((s) => s.key === kind));

  return (
    <div className={styles.wrap} data-testid="kind-segment">
      <span
        className={styles.slider}
        style={{
          left: segmentLeft(index),
          width: `${(100 / SEGMENTS.length).toFixed(4)}%`,
          background: FILL[kind],
          transition: reduced
            ? 'none'
            // 位移與變色是兩段不同的時長：滑塊要滑得慢一點才看得出來在移動，
            // 顏色跟太久反而像沒跟上
            : `left ${DUR.slide}ms ${EASE.move}, background ${DUR.kindColor}ms ${EASE.exit}`,
        }}
        aria-hidden="true"
        data-testid="kind-slider"
      />

      {SEGMENTS.map((s) => {
        const active = s.key === kind;
        return (
          <button
            key={s.key}
            type="button"
            className={styles.seg}
            onClick={() => onChange(s.key)}
            aria-pressed={active}
            data-active={active ? '' : undefined}
            data-testid={`kind-${s.key}`}
            style={{
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
