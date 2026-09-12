/**
 * §4 年月快速選擇器（MOTION #33、#34）的純邏輯。
 * 選擇器有自己的「錨點年」，跟目前看的月份分開：翻年份 pill 時只動錨點，
 * 還沒真的換月，所以標題與月曆都不該跟著動。
 */

/**
 * 四個年份 pill 的內容。原型用 [-2,-1,0,1]，也就是錨點年排在第三格，
 * 左邊留兩年、右邊留一年——回頭查舊帳的次數比預先記未來多。
 */
export function pickerYears(anchor: number): number[] {
  return [-2, -1, 0, 1].map((d) => anchor + d);
}

/**
 * 選完月份後滑入的方向。往未來是 1（新內容從右邊進來），往過去是 -1。
 * 用「年*12+月」的絕對月序比大小，跨年才不會把 2025年12月 → 2026年1月
 * 誤判成往回走。選到同一個月時回 1，方向不重要但要有個確定值。
 */
export function monthSlideDirection(
  fromY: number,
  fromM: number,
  toY: number,
  toM: number
): -1 | 1 {
  return toY * 12 + toM < fromY * 12 + fromM ? -1 : 1;
}

/** 月方格要不要標成目前選中：錨點年得跟真正在看的年份一致才算 */
export function isCurrentMonthCell(
  anchor: number,
  viewY: number,
  viewM: number,
  cell: number
): boolean {
  return anchor === viewY && viewM === cell;
}
