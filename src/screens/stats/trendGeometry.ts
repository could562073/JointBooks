export type Pt = { x: number; y: number };

/**
 * SVG 的內部座標系，照原型：viewBox 320×130，左右各留 8。
 * 0 落在 y=112，刻度上限落在 y=112-98；支出面積往下收到 y=120。
 */
export const VIEW = { w: 320, h: 130, padX: 8, zeroY: 112, span: 98, areaBase: 120 } as const;

/** 最大值上方留一成空間，最高點不會頂到最上面那條格線（原型 hi = max × 1.1） */
export const HEADROOM = 1.1;

/** 背後三條虛線格線的高度（原型） */
export const GRID_Y = [14, 56, 98] as const;

/**
 * §6 折線的資料點座標。
 *
 * 兩條線共用同一個 y 軸刻度（取兩者的最大值），否則收入與支出各自normalise，
 * 看起來會像收入永遠跟支出一樣高。
 *
 * 只有一個資料點時擺在水平中央——擺在左邊會看起來像圖表畫壞了。
 */
export function chartPoints(values: readonly number[], max: number): Pt[] {
  const n = values.length;
  if (n === 0) return [];

  const usableW = VIEW.w - VIEW.padX * 2;
  // max 為 0（整個期間沒有任何紀錄）時所有點都貼在 0 的位置，不要除以零
  const scale = max > 0 ? VIEW.span / (max * HEADROOM) : 0;

  return values.map((v, i) => ({
    x: n === 1 ? VIEW.w / 2 : VIEW.padX + (usableW * i) / (n - 1),
    y: VIEW.zeroY - v * scale,
  }));
}

/** 兩條線共用的刻度上限 */
export function seriesMax(...series: readonly (readonly number[])[]): number {
  return Math.max(0, ...series.flatMap((s) => [...s]));
}

/** §6 趨勢卡背後的水平淡色格線。純裝飾、與資料無關 */
export function gridLines(): number[] {
  return [...GRID_Y];
}

/** polyline 的 points 屬性 */
export function polyline(pts: readonly Pt[]): string {
  return pts.map((p) => `${round(p.x)},${round(p.y)}`).join(' ');
}

/**
 * §6 支出線下方的淡色面積。沿著折線走一圈再回到底部收尾（原型收在 y=120）。
 * 點數少於 2 時沒有面積可畫（一個點連不成形狀），回空字串。
 */
export function areaPath(pts: readonly Pt[]): string {
  if (pts.length < 2) return '';
  const base = VIEW.areaBase;
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  const line = pts.map((p) => `L${round(p.x)},${round(p.y)}`).join('');
  return `M${round(first.x)},${base}${line}L${round(last.x)},${base}Z`;
}

/** 描線動畫要用的長度。用折線各段的直線距離相加，夠精準也不必碰 DOM */
export function pathLength(pts: readonly Pt[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    total += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return round(total);
}

function round(n: number): number {
  return Number(n.toFixed(2));
}
