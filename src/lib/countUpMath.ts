/**
 * MOTION #31／#11 的 count-up 取值。
 *
 * 跟手勢那組一樣，決策留在純函式裡、rAF 副作用留在 hook 裡（Plan 03 的 R1）：
 * 逐格取值是這裡唯一有邏輯的部分，用 Vitest 逐條驗比在 jsdom 裡跟 rAF 搏鬥可靠得多。
 */
import { easeOutCubic } from './motion';

/**
 * 從 `from` 走到 `to`，在 `elapsed` 這一格該顯示的整數值。
 *
 * - `elapsed <= 0` 回 `from`，`elapsed >= duration` 回 `to`（保證一定收在目標值上，
 *   不會因為浮點誤差停在 9,999 這種讓人以為算錯的數字）。
 * - `duration <= 0` 直接回 `to`，讓 reduced-motion 走同一條路徑。
 * - 回傳一律取整：呼叫端是金額（cents），小數沒有意義。
 */
export function countUpValue(from: number, to: number, elapsed: number, duration: number): number {
  if (duration <= 0 || elapsed >= duration) return to;
  if (elapsed <= 0) return from;
  return Math.round(from + (to - from) * easeOutCubic(elapsed / duration));
}
