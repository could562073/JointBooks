import { useMemo, useState } from 'react';
import { GESTURE } from '../../lib/gesture';
import { DUR, EASE } from '../../lib/motion';
import { useDragGesture, type DragHandlers } from '../../lib/useDragGesture';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { collapseStyle, handleHint, snapToCollapsed } from './collapse';

export type CalendarCollapse = {
  collapsed: boolean;
  /** 直接套在月曆外層 div 上 */
  style: { maxHeight: string; opacity: number; overflow: 'hidden'; transition: string };
  hint: string;
  handlers: DragHandlers;
  touchAction: 'none' | 'pan-y';
  dragging: boolean;
};

/**
 * §4 把手：把 Plan 03 的手勢引擎接到月曆收合上。
 * 這支是薄殼——門檻判定在 gestureMath、高度換算在 collapse.ts，這裡只有 state
 * 與 DOM 樣式（專案分層規則 R1）。
 */
export function useCalendarCollapse(
  initialCollapsed = false,
  /**
   * 外部強制收起（§4：年月選擇器展開時，收支三卡與月曆先收起）。
   * 這不會動到 collapsed 本身——選擇器收掉之後要回到使用者原本的收展狀態，
   * 不是一律變成展開。
   */
  forced = false
): CalendarCollapse {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [offset, setOffset] = useState(0);
  const reduced = useReducedMotion();

  const cb = useMemo(
    () => ({
      onMove: setOffset,
      onSnap: (direction: -1 | 1) => {
        setCollapsed(snapToCollapsed(direction));
        setOffset(0);
      },
      onReturn: () => setOffset(0),
      // 位移 <6px 視為點擊，直接切換（§4）
      onTap: () => {
        setCollapsed((c) => !c);
        setOffset(0);
      },
    }),
    []
  );

  const { handlers, dragging, touchAction } = useDragGesture(GESTURE.calendarHandle, cb);
  const { maxHeight, opacity } = forced
    ? { maxHeight: 0, opacity: 0 }
    : collapseStyle(collapsed, dragging ? offset : 0);

  const noTransition = dragging || reduced;

  return {
    collapsed,
    style: {
      maxHeight: `${maxHeight}px`,
      opacity,
      overflow: 'hidden',
      // 拖曳中必須關掉 transition，否則每次 onMove 都在追一個 260ms 的動畫，跟手會拖泥帶水
      transition: noTransition
        ? 'none'
        : `max-height ${DUR.calSnap}ms ${EASE.move}, opacity ${DUR.calSnap}ms ${EASE.move}`,
    },
    hint: handleHint(collapsed),
    handlers,
    touchAction,
    dragging,
  };
}
