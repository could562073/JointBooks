import { GESTURE } from '../../lib/gesture';

export type PullPhase = 'idle' | 'pulling' | 'spinning';

/**
 * §10 #27 下拉重整的守門條件。
 *
 * pullRefresh preset 的 takeoverPx 是 0——按下去第一個 move 就接管並
 * setPointerCapture。直接掛在明細的捲動容器上，會把原生捲動整個吃掉。
 * 所以要先在這裡確認兩件事都成立，才把事件轉給手勢引擎：
 *   1. 明細已經捲到頂（scrollTop <= 0），不然使用者是在捲動不是在下拉
 *   2. 手指確實往下移動，往上是要捲動內容，不該被攔截
 */
export function shouldArmPull(atTop: boolean, dy: number): boolean {
  return atTop && dy > 0;
}

/** 饅頭跟手下移的距離上限就是 preset 的 max，兩邊共用同一個數字 */
export const PULL_MAX = GESTURE.pullRefresh.max ?? 64;

/**
 * 下拉指示器的樣式。高度就是位移本身（饅頭跟著手指下來），
 * opacity 隨距離長出來，讓「還沒拉到位」看得出來。
 */
export function pullStyle(offset: number): { height: number; opacity: number } {
  const h = Math.min(PULL_MAX, Math.max(0, offset));
  return { height: h, opacity: h / PULL_MAX };
}
