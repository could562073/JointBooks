import { useCallback, useMemo, useRef, useState } from 'react';
import { GESTURE } from '../../lib/gesture';
import { useDragGesture } from '../../lib/useDragGesture';
import { PULL_MAX, shouldArmPull, type PullPhase } from './pullRefresh';

export type PullRefresh = {
  phase: PullPhase;
  /** 跟手位移（0–64） */
  offset: number;
  /** 掛在明細捲動容器上的 pointer 事件 */
  handlers: {
    onPointerDown(e: React.PointerEvent): void;
    onPointerMove(e: React.PointerEvent): void;
    onPointerUp(e: React.PointerEvent): void;
    onPointerCancel(e: React.PointerEvent): void;
  };
};

/**
 * §4／§10 #27 下拉重新整理。
 *
 * 這支比其他手勢殼厚一點，因為它掛在「同時要能原生捲動」的容器上：
 * pullRefresh preset 的 takeoverPx 是 0，無條件轉發事件會讓第一個 move
 * 就 setPointerCapture，明細直接捲不動。所以先過 shouldArmPull——捲到頂
 * 且手指往下，才把事件交給手勢引擎。
 *
 * 也因此不套用引擎回傳的 touchAction：那是 'none'，會把捲動一起關掉。
 */
export function usePullRefresh(onRefresh: () => Promise<void> | void): PullRefresh {
  const [offset, setOffset] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const armed = useRef(false);
  const start = useRef({ y: 0, atTop: true });

  const run = useCallback(async () => {
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      setSpinning(false);
      setOffset(0);
    }
  }, [onRefresh]);

  const cb = useMemo(
    () => ({
      onMove: setOffset,
      onSnap: () => { void run(); },
      onReturn: () => setOffset(0),
    }),
    [run]
  );

  const inner = useDragGesture(GESTURE.pullRefresh, cb);

  const handlers = useMemo(
    () => ({
      onPointerDown(e: React.PointerEvent) {
        const el = e.currentTarget as HTMLElement;
        start.current = { y: e.clientY, atTop: el.scrollTop <= 0 };
        armed.current = false;
        // pointerDown 轉過去是安全的：引擎只是記下起點，不會在這一步捕捉指標
        inner.handlers.onPointerDown(e);
      },
      onPointerMove(e: React.PointerEvent) {
        if (!armed.current) {
          if (!shouldArmPull(start.current.atTop, e.clientY - start.current.y)) return;
          armed.current = true;
        }
        inner.handlers.onPointerMove(e);
      },
      onPointerUp(e: React.PointerEvent) {
        if (armed.current) inner.handlers.onPointerUp(e);
        armed.current = false;
      },
      onPointerCancel(e: React.PointerEvent) {
        if (armed.current) inner.handlers.onPointerCancel(e);
        armed.current = false;
      },
    }),
    [inner.handlers]
  );

  const phase: PullPhase = spinning ? 'spinning' : offset > 0 ? 'pulling' : 'idle';

  return { phase, offset: Math.min(PULL_MAX, Math.max(0, offset)), handlers };
}
