import { useMemo, useState } from 'react';
import { GESTURE } from '../../lib/gesture';
import { useDragGesture, type DragHandlers } from '../../lib/useDragGesture';

/**
 * §10 #7：拖曳中 opacity 隨距離降至 .5。
 * 以吸附門檻（56px）當作走完的距離——手指滑到「放手就會換月」的位置時，
 * 舊月份剛好淡到最淡，視覺上的回饋跟判定門檻是同一件事。
 */
export function swipeOpacity(offset: number): number {
  const ratio = Math.min(1, Math.abs(offset) / GESTURE.monthSwipe.snapDistancePx);
  return 1 - ratio * 0.5;
}

export type MonthSwipe = {
  /** 跟手的水平位移（已含 followRatio 與阻尼），直接拿去做 translateX */
  offset: number;
  /** 跟手中的透明度；沒在拖就是 1 */
  opacity: number;
  dragging: boolean;
  handlers: DragHandlers;
  touchAction: 'none' | 'pan-y';
};

/**
 * §4 月曆左右滑換月（MOTION #7）。
 *
 * 方向換算：往右拖（offset 為正）是把左邊的內容拉進來，也就是回到上個月，
 * 所以 goMonth 的 delta 是 -direction。這跟一般輪播的物理直覺一致。
 *
 * 10px 的接管門檻在 GESTURE.monthSwipe 裡，不在這支——沒過門檻就不算接管，
 * 日期格的 click 才不會被攔掉（§11-15）。
 */
export function useMonthSwipe(goMonth: (delta: number) => void): MonthSwipe {
  const [offset, setOffset] = useState(0);

  const cb = useMemo(
    () => ({
      onMove: setOffset,
      onSnap: (direction: -1 | 1) => {
        goMonth(-direction);
        setOffset(0);
      },
      onReturn: () => setOffset(0),
    }),
    [goMonth]
  );

  const { handlers, dragging, touchAction } = useDragGesture(GESTURE.monthSwipe, cb);

  const live = dragging ? offset : 0;
  return { offset: live, opacity: swipeOpacity(live), dragging, handlers, touchAction };
}
