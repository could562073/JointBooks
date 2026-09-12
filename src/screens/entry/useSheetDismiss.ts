import { useMemo, useState } from 'react';
import { GESTURE } from '../../lib/gesture';
import { DUR, EASE } from '../../lib/motion';
import { useDragGesture, type DragHandlers } from '../../lib/useDragGesture';
import { useReducedMotion } from '../../lib/useReducedMotion';

export type SheetDismiss = {
  /** 直接套在面板外層 */
  style: { transform: string | undefined; transition: string };
  handlers: DragHandlers;
  touchAction: 'none' | 'pan-y';
  dragging: boolean;
};

/**
 * §5／MOTION #35：把手下滑關閉面板。
 *
 * 「不往上超過 0」是 GESTURE.panelDismiss 的 min: 0 在管，這裡不重複夾一次。
 * 放手判定（>110px 或 >0.4px/ms）也在 preset 裡，這支只負責 state 與樣式。
 */
export function useSheetDismiss(onDismiss: () => void): SheetDismiss {
  const [offset, setOffset] = useState(0);
  const reduced = useReducedMotion();

  const cb = useMemo(
    () => ({
      onMove: setOffset,
      onSnap: (direction: -1 | 1) => {
        // direction 1 是往下（正位移）；min:0 讓往上根本走不到這裡
        if (direction === 1) onDismiss();
        setOffset(0);
      },
      onReturn: () => setOffset(0),
    }),
    [onDismiss]
  );

  const { handlers, dragging, touchAction } = useDragGesture(GESTURE.panelDismiss, cb);

  return {
    style: {
      transform: dragging && offset ? `translateY(${offset}px)` : undefined,
      // 拖曳中關掉 transition，否則每次 onMove 都在追一個 260ms 的動畫
      transition: dragging || reduced ? 'none' : `transform ${DUR.panelSnap}ms ${EASE.move}`,
    },
    handlers,
    touchAction,
    dragging,
  };
}
