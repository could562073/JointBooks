import type { GesturePreset } from './gesture';

export type Sample = { pos: number; t: number };

/**
 * §11-15：門檻之前絕對不可接管手勢，否則日期格與卡內按鈕收不到 click。
 * 嚴格大於，讓「剛好 10px」仍屬於點擊。
 */
export function shouldTakeOver(dMain: number, _dCross: number, p: GesturePreset): boolean {
  return Math.abs(dMain) > p.takeoverPx;
}

/** §10 #7：另一軸超出主軸 abandonPx 就放棄，把捲動還給頁面 */
export function shouldAbandon(dMain: number, dCross: number, p: GesturePreset): boolean {
  if (p.abandonPx === null) return false;
  return Math.abs(dCross) - Math.abs(dMain) > p.abandonPx;
}

/** §10 通則：超出邊界的部分乘上阻尼，不可硬止 */
export function applyBounds(raw: number, p: GesturePreset): number {
  if (p.max !== null && raw > p.max) return p.max + (raw - p.max) * p.damping;
  if (p.min !== null && raw < p.min) return p.min + (raw - p.min) * p.damping;
  return raw;
}

/**
 * 取最近 windowMs 內的取樣算平均速度（px/ms）。
 * 只看時間窗而不是全部取樣，否則手指停頓一秒再快速甩出會被平均掉。
 */
export function velocityOf(samples: readonly Sample[], windowMs = 100): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1]!;
  let first = samples[0]!;
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i]!;
    if (last.t - s.t > windowMs) break;
    first = s;
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return (last.pos - first.pos) / dt;
}

export type SnapDecision =
  | { kind: 'tap' }
  | { kind: 'snap'; direction: -1 | 1 }
  | { kind: 'return' };

/**
 * 放手判定。位移與速度取「或」——任一超過門檻即吸附。
 * 速度方向與位移相反時以速度為準：使用者往回甩就是要取消。
 */
export function decideSnap(
  offset: number, velocity: number, p: GesturePreset
): SnapDecision {
  if (p.tapPx > 0 && Math.abs(offset) < p.tapPx) return { kind: 'tap' };

  const byDistance = Math.abs(offset) > p.snapDistancePx;
  const byVelocity = Math.abs(velocity) > p.snapVelocity;
  if (!byDistance && !byVelocity) return { kind: 'return' };

  const source = byVelocity ? velocity : offset;
  return { kind: 'snap', direction: source > 0 ? 1 : -1 };
}
