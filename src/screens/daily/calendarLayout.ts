/**
 * §4 月曆的版面與底色計算。
 *
 * 抽成純函式的理由跟手勢那組一樣：格子座標與熱度色是唯一有邏輯的部分，
 * 用 Vitest 逐條驗；真正需要版面的部分（滑塊實際滑到哪）jsdom 量不到，
 * 列在 docs/MANUAL-TESTS.md 手動驗。
 */

/** 一格的實際高度（px），與 MonthCalendar.module.css 的 grid-auto-rows 同一個數字 */
export const CELL_CONTENT_H = 50;

/** 格與格之間的間距，與 CSS 的 gap 同一個數字 */
export const CELL_GAP = 3;

/**
 * 一列佔的高度 = 格高 + 間距。滑塊要用它算 top，兩邊必須是同一個數字，
 * 分開寫遲早會對不上。
 */
export const CELL_H = CELL_CONTENT_H + CELL_GAP;

/** 選中滑塊與格子共用的座標。`offset` 來自 domain/date.ts 的 firstCellOffset */
export function cellPosition(offset: number, day: number): { col: number; row: number } {
  const index = offset + day - 1;
  return { col: index % 7, row: Math.floor(index / 7) };
}

/** 一個月最多會佔幾列（6 列的月份存在，版面不能寫死 5） */
export function rowCount(offset: number, daysInMonth: number): number {
  return Math.ceil((offset + daysInMonth) / 7);
}

/**
 * §4：格底色濃度依當天支出／當月最大值 → `rgba(183,166,229, .14 + ratio*.44)`。
 * ratio 夾在 0–1，避免資料異常時算出超出範圍的 alpha。
 */
export function heatColor(ratio: number): string {
  const r = Math.min(1, Math.max(0, ratio));
  const alpha = 0.14 + r * 0.44;
  return `rgba(183,166,229,${Number(alpha.toFixed(4))})`;
}

/**
 * MOTION #6 的滑塊落點。
 *
 * 水平位置不能只用 col * 100/7%：格線有 3px 的 gap，欄寬其實是
 * (100% - 6×gap) / 7，所以每往右一欄，實際左緣會比純百分比多 gap×col/7 個 px。
 * 少了這一項，滑塊在第 6、7 欄會偏掉約 2.5px——剛好是一眼看得出來的量。
 */
export function sliderOffset(pos: { col: number; row: number }): { left: string; top: string } {
  const pct = ((pos.col * 100) / 7).toFixed(4);
  const px = ((pos.col * CELL_GAP) / 7).toFixed(5);
  return {
    left: pos.col === 0 ? '0%' : `calc(${pct}% + ${px}px)`,
    top: `${pos.row * CELL_H}px`,
  };
}

/** 滑塊的寬度：跟一格等寬，同樣要扣掉 gap 攤到每欄的量 */
export const SLIDER_WIDTH = `calc(${(100 / 7).toFixed(4)}% - ${((CELL_GAP * 6) / 7).toFixed(5)}px)`;

/**
 * §10 #4：儲存後月曆該格的金額 scale 1→1.12→1。
 *
 * 只回報「金額真的變了」的那幾天。prev 為 null（第一次渲染、或剛換月）時回空陣列
 * ——換月時每一格的值都跟上個月不一樣，不擋掉的話整排會一起跳，看起來像出錯。
 */
export function changedDays(
  prev: readonly { day: number; expenseCents: number }[] | null,
  next: readonly { day: number; expenseCents: number }[]
): number[] {
  if (!prev) return [];
  const before = new Map(prev.map((c) => [c.day, c.expenseCents]));
  return next
    .filter((c) => before.has(c.day) && before.get(c.day) !== c.expenseCents)
    .map((c) => c.day);
}
