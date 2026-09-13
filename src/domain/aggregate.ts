import type { IconKey } from '../components/Icon';
import type { Category, Dimension, Range, Txn } from './types';
import {
  daysInMonth, inRange, isoWeek, parseDate, rangeOf, previousRange, toDateString,
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
 * 收支判定一律以 id 查分類表的 kind 為準，不可退回名稱比對。
 * 增補檔 §B-2 允許使用者自建收入分類（例如「副業」），改名 collision 也可能發生在
 * 預設的「收入」分類上——任何 mainName === '收入' 的 fallback 都會在這兩種情況下
 * 把使用者自建的收入分類誤判為支出。呼叫端一律要先備妥分類表。
 */
function isIncome(cats: Category[], t: Txn): boolean {
  return kindOf(cats, t) === 'income';
}

export function totalsIn(txns: Txn[], r: Range, cats: Category[]): Totals {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const t of txns) {
    if (!live(t) || !inRange(t.date, r)) continue;
    if (isIncome(cats, t)) incomeCents += t.actualCadCents;
    else expenseCents += t.actualCadCents;
  }
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

export function dayTotal(txns: Txn[], date: string, cats: Category[]): Totals {
  return totalsIn(txns, { start: date, end: nextDay(date) }, cats);
}

function nextDay(date: string): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + 1);
  return toDateString(d);
}

/** §4 月曆：每格的支出、有無收入、以及相對當月最大值的熱度 */
export function calendarCells(txns: Txn[], y: number, m: number, cats: Category[]): DayCell[] {
  const dim = daysInMonth(y, m);
  const cells: DayCell[] = [];

  for (let day = 1; day <= dim; day++) {
    const date = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let expenseCents = 0;
    let hasIncome = false;
    for (const t of txns) {
      if (!live(t) || t.date !== date) continue;
      if (isIncome(cats, t)) hasIncome = true;
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
 *
 * 週倍率的「當月天數」要以該週週一所在的月份為準，不能用 anchor（被點的那一天）：
 * 同一個顯示週跨月時，anchor 落在月初或月底會算出不同天數，同一條預算條就會因為
 * 使用者點了哪一天而顯示不同數字。倍率是這個「週」的屬性，不是「點擊」的屬性。
 */
export function budgetMultiplier(dim: Dimension, anchor: string): number {
  if (dim === 'month') return 1;
  if (dim === 'year') return 12;
  const monday = parseDate(rangeOf('week', anchor).start);
  return 7 / daysInMonth(monday.getFullYear(), monday.getMonth());
}

export function budgetRows(
  txns: Txn[], cats: Category[], dim: Dimension, anchor: string, cycleDay = 1
): BudgetRow[] {
  const r = rangeOf(dim, anchor, cycleDay);
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

/** 趨勢圖看最近幾期（原型：週看 8 週、月看 6 個月、年看 4 年） */
export const TREND_PERIODS: Readonly<Record<Dimension, number>> = { week: 8, month: 6, year: 4 };

/**
 * §6 趨勢折線的資料點：一期一個點，由舊到新，最後一點就是 anchor 所在、總覽卡正在看的那一期。
 *
 * 照原型的邏輯：週維度比的是「這幾週各花多少」，不是一週裡的七天；月、年同理。
 * 標籤也照原型：週寫 ISO 週次（W36）、月寫「9月」、年寫「2026」。
 */
export function trendSeries(
  txns: Txn[], dim: Dimension, anchor: string, cats: Category[], cycleDay = 1
): TrendPoint[] {
  const ranges: Range[] = [rangeOf(dim, anchor, cycleDay)];
  while (ranges.length < TREND_PERIODS[dim]) {
    ranges.unshift(previousRange(dim, ranges[0]!, cycleDay));
  }
  return ranges.map((r) => ({ label: trendLabel(dim, r), ...bucketOf(txns, r, cats) }));
}

function trendLabel(dim: Dimension, r: Range): string {
  const s = parseDate(r.start);
  if (dim === 'week') return `W${isoWeek(s).week}`;
  if (dim === 'month') return `${s.getMonth() + 1}月`;
  return String(s.getFullYear());
}

function bucketOf(txns: Txn[], r: Range, cats: Category[]) {
  const t = totalsIn(txns, r, cats);
  return { expenseCents: t.expenseCents, incomeCents: t.incomeCents };
}

/** §6 總覽卡的「與上期增減」pill */
export function comparePrevious(
  txns: Txn[], dim: Dimension, anchor: string, cats: Category[], cycleDay = 1
): { deltaRatio: number; direction: 'up' | 'down' | 'flat' } {
  const r = rangeOf(dim, anchor, cycleDay);
  const cur = totalsIn(txns, r, cats).netCents;
  const prev = totalsIn(txns, previousRange(dim, r, cycleDay), cats).netCents;

  if (prev === 0) {
    // 前期為零時比例無意義，但符號仍要跟方向一致，不可一律 +1
    // （否則本期由零轉虧損也會顯示「▼ +100%」這種矛盾的正負號）
    return {
      deltaRatio: cur === 0 ? 0 : cur > 0 ? 1 : -1,
      direction: cur > 0 ? 'up' : cur < 0 ? 'down' : 'flat',
    };
  }

  const deltaRatio = (cur - prev) / Math.abs(prev);
  return {
    deltaRatio,
    direction: deltaRatio > 0.0001 ? 'up' : deltaRatio < -0.0001 ? 'down' : 'flat',
  };
}

/**
 * §4 明細列表：該日、未刪、依「新增時間」**降冪**——最新記的那筆在最上面。
 *
 * §4 原文寫升冪、§5 寫「新紀錄出現在最前」，兩者互斥；使用者裁決取後者。
 * 排序鍵用 createdAt 而不是 updatedAt：用後者的話，改一筆舊帳會讓它跳到
 * 最上面，使用者剛編輯完就找不到自己原本在看的位置。
 */
export function txnsOn(txns: Txn[], date: string): Txn[] {
  return txns
    .filter((t) => live(t) && t.date === date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
