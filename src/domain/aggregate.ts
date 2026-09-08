import type { IconKey } from '../components/Icon';
import type { Category, Dimension, Range, Txn } from './types';
import {
  addMonths, daysInMonth, eachDay, inRange, isoWeek, parseDate, rangeOf,
  previousRange, toDateString,
} from './date';

export type Totals = { incomeCents: number; expenseCents: number; netCents: number };

export type DayCell = {
  date: string;
  day: number;
  expenseCents: number;
  hasIncome: boolean;
  /** 0–1，供 §4 的底色濃度公式使用 */
  heat: number;
};

export type BudgetRow = {
  categoryId: string;
  name: string;
  icon: IconKey;
  colorSet: number;
  spentCents: number;
  budgetCents: number;
  ratio: number;
  state: 'normal' | 'warn' | 'over';
  overCents: number;
};

export type TrendPoint = { label: string; expenseCents: number; incomeCents: number };

const live = (t: Txn) => !t.deleted;

function kindOf(cats: Category[], t: Txn): 'income' | 'expense' {
  return cats.find((c) => c.id === t.mainId)?.kind ?? 'expense';
}

/**
 * 聚合不傳 cats 時無法判斷收支，因此內部一律要求呼叫端先給分類表。
 * 為了讓 totalsIn 的簽名保持簡單，這裡用 mainName === '收入' 作為 fallback
 * 只在分類表尚未載入時發生（例如第一次冷啟動）。
 */
function isIncome(t: Txn, cats?: Category[]): boolean {
  if (cats) return kindOf(cats, t) === 'income';
  return t.mainName === '收入';
}

export function totalsIn(txns: Txn[], r: Range, cats?: Category[]): Totals {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const t of txns) {
    if (!live(t) || !inRange(t.date, r)) continue;
    if (isIncome(t, cats)) incomeCents += t.actualCadCents;
    else expenseCents += t.actualCadCents;
  }
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

export function dayTotal(txns: Txn[], date: string, cats?: Category[]): Totals {
  return totalsIn(txns, { start: date, end: nextDay(date) }, cats);
}

function nextDay(date: string): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + 1);
  return toDateString(d);
}

/** §4 月曆：每格的支出、有無收入、以及相對當月最大值的熱度 */
export function calendarCells(txns: Txn[], y: number, m: number, cats?: Category[]): DayCell[] {
  const dim = daysInMonth(y, m);
  const cells: DayCell[] = [];

  for (let day = 1; day <= dim; day++) {
    const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let expenseCents = 0;
    let hasIncome = false;
    for (const t of txns) {
      if (!live(t) || t.date !== date) continue;
      if (isIncome(t, cats)) hasIncome = true;
      else expenseCents += t.actualCadCents;
    }
    cells.push({ date, day, expenseCents, hasIncome, heat: 0 });
  }

  const max = Math.max(0, ...cells.map((c) => c.expenseCents));
  if (max > 0) for (const c of cells) c.heat = c.expenseCents / max;

  return cells;
}

/**
 * 增補檔 D-1：週 = 7 / 當月天數、月 = 1、年 = 12。
 * （§6 原本寫 ×0.25 / ×11.4，判定為未經推導的數值，已修正。）
 */
export function budgetMultiplier(dim: Dimension, anchor: string): number {
  if (dim === 'month') return 1;
  if (dim === 'year') return 12;
  const d = parseDate(anchor);
  return 7 / daysInMonth(d.getFullYear(), d.getMonth());
}

export function budgetRows(
  txns: Txn[], cats: Category[], dim: Dimension, anchor: string
): BudgetRow[] {
  const r = rangeOf(dim, anchor);
  const mult = budgetMultiplier(dim, anchor);

  return cats
    .filter((c) => c.kind === 'expense' && c.active && c.budgetCents !== null)
    .sort((a, b) => a.order - b.order)
    .map((c) => {
      let spentCents = 0;
      for (const t of txns) {
        if (live(t) && t.mainId === c.id && inRange(t.date, r)) spentCents += t.actualCadCents;
      }
      const budgetCents = Math.round(c.budgetCents! * mult);
      const ratio = budgetCents > 0 ? spentCents / budgetCents : 0;
      const overCents = Math.max(0, spentCents - budgetCents);
      const state: BudgetRow['state'] =
        overCents > 0 ? 'over' : ratio > 0.85 ? 'warn' : 'normal';
      return {
        categoryId: c.id, name: c.name, icon: c.icon, colorSet: c.colorSet,
        spentCents, budgetCents, ratio, state, overCents,
      };
    });
}

/** §6 趨勢折線的資料點。X 軸標籤依維度變 */
export function trendSeries(
  txns: Txn[], dim: Dimension, anchor: string, cats?: Category[]
): TrendPoint[] {
  const r = rangeOf(dim, anchor);

  if (dim === 'week') {
    return eachDay(r).map((date, i) => ({
      label: ['一', '二', '三', '四', '五', '六', '日'][i]!,
      ...bucketOf(txns, { start: date, end: nextDay(date) }, cats),
    }));
  }

  if (dim === 'year') {
    const y = parseDate(r.start).getFullYear();
    return Array.from({ length: 12 }, (_, m) => {
      const next = addMonths(y, m, 1);
      return {
        label: `${m + 1}月`,
        ...bucketOf(txns, {
          start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
          end: `${next.y}-${String(next.m + 1).padStart(2, '0')}-01`,
        }, cats),
      };
    });
  }

  // month：切成該月涵蓋的 ISO 週
  const byWeek = new Map<number, { start: string; end: string }>();
  for (const date of eachDay(r)) {
    const { week } = isoWeek(parseDate(date));
    const cur = byWeek.get(week);
    if (!cur) byWeek.set(week, { start: date, end: nextDay(date) });
    else cur.end = nextDay(date);
  }
  return [...byWeek.entries()].map(([week, span]) => ({
    label: `W${week}`,
    ...bucketOf(txns, span, cats),
  }));
}

function bucketOf(txns: Txn[], r: Range, cats?: Category[]) {
  const t = totalsIn(txns, r, cats);
  return { expenseCents: t.expenseCents, incomeCents: t.incomeCents };
}

/** §6 總覽卡的「與上期增減」pill */
export function comparePrevious(
  txns: Txn[], dim: Dimension, anchor: string, cats?: Category[]
): { deltaRatio: number; direction: 'up' | 'down' | 'flat' } {
  const cur = totalsIn(txns, rangeOf(dim, anchor), cats).netCents;
  const prev = totalsIn(txns, previousRange(dim, rangeOf(dim, anchor)), cats).netCents;

  if (prev === 0) {
    return {
      deltaRatio: cur === 0 ? 0 : 1,
      direction: cur > 0 ? 'up' : cur < 0 ? 'down' : 'flat',
    };
  }

  const deltaRatio = (cur - prev) / Math.abs(prev);
  return {
    deltaRatio,
    direction: deltaRatio > 0.0001 ? 'up' : deltaRatio < -0.0001 ? 'down' : 'flat',
  };
}

/** §4 明細列表：該日、未刪、依時間升冪 */
export function txnsOn(txns: Txn[], date: string, _cats: Category[]): Txn[] {
  return txns
    .filter((t) => live(t) && t.date === date)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
}
