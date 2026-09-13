import { SegmentedControl, type Segment } from '../../components/SegmentedControl';
import type { CategoryKind } from '../../domain/types';

/** 順序就是滑塊的座標 */
const SEGMENTS: readonly Segment<CategoryKind>[] = [
  { key: 'expense', label: '支出' },
  { key: 'income', label: '收入' },
];

/** MOTION #36：滑塊底色支出紫、收入粉 */
const FILL: Record<CategoryKind, string> = {
  expense: '#B7A6E5',
  income: '#DDA6D0',
};

type Props = {
  kind: CategoryKind;
  onChange(k: CategoryKind): void;
};

/** §5 頂部的支出／收入分段控制（MOTION #36）。版面行為在 SegmentedControl 裡 */
export function KindSegment({ kind, onChange }: Props) {
  return (
    <SegmentedControl
      segments={SEGMENTS}
      value={kind}
      onChange={onChange}
      fill={FILL[kind]}
      // 原型：選中字是深咖啡，不是白字——白字在淡紫滑塊上對比不夠
      activeColor="var(--c-text)"
      compact
      testId="kind"
    />
  );
}
