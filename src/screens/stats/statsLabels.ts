import { parseDate, type WeekStart } from '../../domain/date';
import type { Dimension, Range } from '../../domain/types';

/**
 * §6 總覽卡的期間標籤。
 *
 * 月維度在月結日是 1 號時只寫「9月」，不是 1 號才寫成 `9/15 – 10/14`（§6）——
 * 區間結束是 range.end 的前一天，因為 Range 是半開區間 [start, end)。
 */
export function periodLabel(dim: Dimension, r: Range): string {
  const s = parseDate(r.start);
  const end = parseDate(r.end);
  // 半開區間的最後一天
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);

  if (dim === 'year') return `${s.getFullYear()}年`;

  if (dim === 'month') {
    // 1 號開始、且結束日落在同一個月 → 就是一個完整月份
    const wholeMonth = s.getDate() === 1 && last.getMonth() === s.getMonth();
    if (wholeMonth) return `${s.getFullYear()}年${s.getMonth() + 1}月`;
  }

  return `${s.getMonth() + 1}/${s.getDate()} – ${last.getMonth() + 1}/${last.getDate()}`;
}

/** §6 與上期增減 pill 的文字。方向由 comparePrevious 決定，這裡只管排版 */
export function deltaLabel(deltaRatio: number, direction: 'up' | 'down' | 'flat'): string {
  if (direction === 'flat') return '持平';
  const arrow = direction === 'up' ? '▲' : '▼';
  return `${arrow} ${Math.round(Math.abs(deltaRatio) * 100)}%`;
}

/**
 * §6 收入／支出比例條。回傳支出佔的比例（0–1）。
 *
 * 兩邊都是 0 時給 0 而不是 0.5：沒有任何紀錄時應該是一條空的軌道，
 * 不是一半一半——那看起來像「收支剛好打平」，是不一樣的意思。
 */
export function expenseShare(incomeCents: number, expenseCents: number): number {
  const total = incomeCents + expenseCents;
  if (total <= 0) return 0;
  return expenseCents / total;
}

/** §6 折線 X 軸的說明：週維度的星期跟著「週起始」設定走 */
export function trendAxisNote(dim: Dimension, weekStart: WeekStart = 'mon'): string {
  if (dim === 'week') return weekStart === 'sun' ? '日–六' : '一–日';
  if (dim === 'month') return '本月各週';
  return '1–12月';
}
