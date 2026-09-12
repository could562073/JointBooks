/** §4 把手：月曆區收起／展開的高度區間 */
export const CALENDAR_MAX_H = 460;

/**
 * 收合區的即時樣式。`offset` 是把手的跟手位移，往上為負（y 軸）。
 * 高度夾在 0–460 之間，所以「已收起還往上拖」或「已展開還往下拉」都不會過頭；
 * 這也是為什麼 calendarHandle preset 的 min/max 是 null —— 越界處理放在這裡，
 * 手勢層只負責回報位移。
 */
export function collapseStyle(
  collapsed: boolean,
  offset: number
): { maxHeight: number; opacity: number } {
  const base = collapsed ? 0 : CALENDAR_MAX_H;
  const h = Math.min(CALENDAR_MAX_H, Math.max(0, base + offset));
  // opacity 跟著高度同步，不另外做曲線（§4：「opacity 同步」）
  return { maxHeight: h, opacity: h / CALENDAR_MAX_H };
}

/**
 * 放手吸附的目標狀態。direction 來自 decideSnap：
 * -1 是往上（收起月曆、明細補滿），1 是往下（月曆回來）。
 */
export function snapToCollapsed(direction: -1 | 1): boolean {
  return direction === -1;
}

/** §4：提示文字隨狀態變 */
export function handleHint(collapsed: boolean): string {
  return collapsed ? '往下拉看月曆' : '往上滑看更多明細';
}
