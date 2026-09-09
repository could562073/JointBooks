import { useEffect, useRef, useState } from 'react';
import { countUpValue } from './countUpMath';
import { useReducedMotion } from './useReducedMotion';

/**
 * MOTION #31／#11：數字從 0（或上一個值）滾到目標值。
 *
 * 取值邏輯在 countUpMath.ts，這裡只負責 rAF 與 state。目標值中途改變時，
 * 從「目前顯示的數字」接著跑而不是從 0 重來 —— 使用者點了另一天，數字應該
 * 從現在的位置移過去，不是先歸零再衝上來。
 *
 * reduced-motion 直接顯示目標值，不排任何 frame（§10 通則）。
 */
export function useCountUp(target: number, duration: number): number {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(() => (reduced ? target : 0));
  const fromRef = useRef(display);

  useEffect(() => {
    if (reduced) {
      fromRef.current = target;
      setDisplay(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;

    let raf = 0;
    // t0 取自第一個 frame 的時戳，不用 performance.now()：兩者在 jsdom 下不同
    // 時基，混用會讓 now - t0 變成負數，取值永遠停在起點、rAF 無限排下去。
    // 真實瀏覽器同源所以碰巧會動，但不該賭這件事。
    let t0: number | null = null;
    const step = (now: number) => {
      if (t0 === null) t0 = now;
      const v = countUpValue(from, target, now - t0, duration);
      fromRef.current = v;
      setDisplay(v);
      if (v !== target) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);

  return display;
}
