import { inRange, parseDate, type WeekStart } from '../../domain/date';
import type { BudgetRow } from '../../domain/aggregate';
import type { Dimension, Range } from '../../domain/types';

const CURRENT = { week: '本週', month: '本月', year: '今年' } as const;
const OTHER = { week: '當週', month: '當月', year: '當年' } as const;

/**
 * §6 總覽卡標題（使用者要求）：「本週結餘」「本月結餘」「今年結餘」。
 * 看的不是目前這一期（在日常頁選了別的日子）時寫「當週／當月／當年」，
 * 免得標題寫本月、數字卻是上個月的。
 */
export function balanceTitle(dim: Dimension, r: Range, today: string): string {
  return `${(inRange(today, r) ? CURRENT : OTHER)[dim]}結餘`;
}

/**
 * 標題旁的期間，一律寫成「9/8 ~ 9/14」（使用者要求）。
 * 區間結束是 range.end 的前一天，因為 Range 是半開區間 [start, end)。
 */
export function periodSpan(r: Range): string {
  const s = parseDate(r.start);
  const end = parseDate(r.end);
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
  return `${s.getMonth() + 1}/${s.getDate()} ~ ${last.getMonth() + 1}/${last.getDate()}`;
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

/**
 * 原型的總覽卡：支出欄下方那條進度條表示「這期花掉了收入的幾成」，
 * 收入欄下方是固定滿版的裝飾色條（原型如此，不隨資料變動）。
 *
 * 跟 expenseShare（支出佔收支合計的比例）是不同的量——這裡刻意換成
 * 「支出 / 收入」，收入為 0 但仍有支出時視覺上灌滿（能花的都花了）。
 */
export function expenseOfIncomeRatio(incomeCents: number, expenseCents: number): number {
  if (incomeCents <= 0) return expenseCents > 0 ? 1 : 0;
  return Math.min(1, expenseCents / incomeCents);
}

/** §6 預算區標題右邊「月額度」合計：每一列已依維度換算過的預算金額加總 */
export function budgetTotal(rows: readonly BudgetRow[]): number {
  return rows.reduce((sum, r) => sum + r.budgetCents, 0);
}
