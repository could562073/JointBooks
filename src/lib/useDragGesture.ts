import { useRef, useState, useCallback } from 'react';
import type React from 'react';
import type { GesturePreset } from './gesture';
import {
  shouldTakeOver, shouldAbandon, applyBounds, velocityOf, decideSnap,
  type Sample,
} from './gestureMath';
import { useReducedMotion } from './useReducedMotion';

export type DragCallbacks = {
  onMove(offset: number): void;
  onSnap(direction: -1 | 1): void;
  onReturn(): void;
  onTap?(): void;
};

export type DragHandlers = {
  onPointerDown(e: React.PointerEvent): void;
  onPointerMove(e: React.PointerEvent): void;
  onPointerUp(e: React.PointerEvent): void;
  onPointerCancel(e: React.PointerEvent): void;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  taken: boolean;
  abandoned: boolean;
  samples: Sample[];
};

export function useDragGesture(
  preset: GesturePreset, cb: DragCallbacks
): { handlers: DragHandlers; dragging: boolean; touchAction: 'none' | 'pan-y' } {
  const st = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();

  const mainOf = (e: React.PointerEvent, s: DragState) =>
    preset.axis === 'x' ? e.clientX - s.startX : e.clientY - s.startY;
  const crossOf = (e: React.PointerEvent, s: DragState) =>
    preset.axis === 'x' ? e.clientY - s.startY : e.clientX - s.startX;

  const finish = useCallback((s: DragState) => {
    st.current = null;
    setDragging(false);
    return s;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    st.current = {
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      taken: false, abandoned: false,
      samples: [{ pos: 0, t: e.timeStamp }],
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = st.current;
    if (!s || s.pointerId !== e.pointerId || s.abandoned) return;

    const main = mainOf(e, s);
    const cross = crossOf(e, s);

    if (!s.taken) {
      if (shouldAbandon(main, cross, preset)) { s.abandoned = true; return; }
      if (!shouldTakeOver(main, cross, preset)) return;
      // §11-15：接管之後才捕捉指標。提早捕捉會讓底下的可點元素完全收不到 click。
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      s.taken = true;
      setDragging(true);
    }

    s.samples.push({ pos: main, t: e.timeStamp });
    if (s.samples.length > 24) s.samples.shift();

    cb.onMove(applyBounds(main * preset.followRatio, preset));
  }, [preset, cb]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const s = st.current;
    if (!s || s.pointerId !== e.pointerId) return;

    const main = mainOf(e, s);
    const taken = s.taken;
    if (taken && (e.currentTarget as Element).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    }
    // reduced-motion 時速度不參與判定：使用者要的是直接到位，不是慣性
    const v = reduced ? 0 : velocityOf(s.samples);
    finish(s);

    if (!taken && preset.tapPx === 0) return;   // 沒接管也沒有點擊語意，交給原生 click

    const d = decideSnap(applyBounds(main * preset.followRatio, preset), v, preset);
    if (d.kind === 'tap') cb.onTap?.();
    else if (d.kind === 'snap') cb.onSnap(d.direction);
    else cb.onReturn();
  }, [preset, cb, reduced, finish]);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    const s = st.current;
    if (!s || s.pointerId !== e.pointerId) return;
    const taken = s.taken;
    if (taken && (e.currentTarget as Element).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    }
    finish(s);
    cb.onReturn();
  }, [cb, finish]);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    dragging,
    // §10 通則：垂直拖曳吃掉所有原生手勢，水平拖曳保留垂直捲動
    touchAction: preset.axis === 'y' ? 'none' : 'pan-y',
  };
}
