import { useMemo, useState } from 'react';
import { DUR, EASE } from '../../lib/motion';
import { useDragGesture, type DragHandlers } from '../../lib/useDragGesture';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { cardX, shiftBounds, snapToOpen } from './cardSwipe';

export type CardSwipe = {
  open: boolean;
  style: { transform: string; transition: string };
  handlers: DragHandlers;
  touchAction: 'none' | 'pan-y';
  dragging: boolean;
  close(): void;
};

/**
 * §7.2／MOTION #15：分類卡左滑露出刪除鍵。
 *
 * 10px 的接管門檻在 preset 裡，不在這支——沒過門檻就不算接管，卡內的
 * 圖示鍵、分類名、金額 pill 才收得到 click（§7.2 明列的衝突條件）。
 */
export function useCardSwipe(): CardSwipe {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState(0);
  const reduced = useReducedMotion();

  // 邊界跟著目前位置平移，卡片已展開時往右拖才不會被誤判成越界
  const preset = useMemo(() => shiftBounds(open ? cardX(true, 0) : 0), [open]);

  const cb = useMemo(
    () => ({
      onMove: setOffset,
      onSnap: (direction: -1 | 1) => { setOpen(snapToOpen(direction)); setOffset(0); },
      onReturn: () => setOffset(0),
    }),
    []
  );

  const { handlers, dragging, touchAction } = useDragGesture(preset, cb);
  const x = cardX(open, dragging ? offset : 0);

  return {
    open,
    style: {
      transform: `translate3d(${x}px, 0, 0)`,
      // 拖曳中關掉 transition，否則每次 onMove 都在追一個 380ms 的動畫
      transition: dragging || reduced ? 'none' : `transform ${DUR.cardSnap}ms ${EASE.move}`,
    },
    handlers,
    touchAction,
    dragging,
    close: () => { setOpen(false); setOffset(0); },
  };
}
