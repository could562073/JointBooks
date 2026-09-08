import { describe, it, expect } from 'vitest';
import {
  totalsIn, dayTotal, calendarCells, budgetMultiplier, budgetRows,
  trendSeries, comparePrevious, txnsOn,
} from './aggregate';
import { defaultCategories, makeCategory, nextColorSet, nextOrder } from './categories';
import { rangeOf } from './date';
import type { Category, Txn } from './types';

let seq = 0;
const CATS: Category[] = defaultCategories(() => `c${++seq}`);
const cat = (name: string) => CATS.find((c) => c.name === name)!;

function txn(over: Partial<Txn> & { date: string; actualCadCents: number }): Txn {
  const c = over.mainId ? CATS.find((x) => x.id === over.mainId)! : cat('超市');
  return {
    id: crypto.randomUUID(),
    mainId: c.id, subId: c.subs[0]!.id, mainName: c.name, subName: c.subs[0]!.name,
    amountCents: over.actualCadCents, currency: 'CAD',
    by: '我', note: '',
    createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', deleted: false,
    ...over,
  };
}

describe('totalsIn / dayTotal', () => {
  const txns = [
    txn({ date: '2026-09-01', actualCadCents: 205_000, mainId: cat('租屋').id }),
    txn({ date: '2026-09-05', actualCadCents: 520, mainId: cat('外食').id }),
    txn({ date: '2026-09-05', actualCadCents: 1_675 }),
    txn({ date: '2026-09-15', actualCadCents: 312_000, mainId: cat('收入').id }),
    txn({ date: '2026-10-01', actualCadCents: 9_999 }),      // 區間外
    txn({ date: '2026-09-20', actualCadCents: 5_000, deleted: true }),  // 軟刪不計
  ];

  it('依 kind 分收支，一律用 actualCadCents（§1、§11-4）', () => {
    const t = totalsIn(txns, rangeOf('month', '2026-09-06'), CATS);
    expect(t.incomeCents).toBe(312_000);
    expect(t.expenseCents).toBe(205_000 + 520 + 1_675);
    expect(t.netCents).toBe(312_000 - (205_000 + 520 + 1_675));
  });

  it('軟刪與區間外都不計入', () => {
    const t = totalsIn(txns, rangeOf('month', '2026-09-06'), CATS);
    // 若把 10/1 的 9,999 或軟刪的 5,000 算進去就不會是這個數
    expect(t.expenseCents).toBe(207_195);
  });

  it('dayTotal 只算單日', () => {
    expect(dayTotal(txns, '2026-09-05', CATS).expenseCents).toBe(2_195);
    expect(dayTotal(txns, '2026-09-06', CATS).expenseCents).toBe(0);
  });

  it('I1：使用者自建的第二個收入分類，即使名稱不是「收入」也照樣算收入', () => {
    // 增補檔 §B-2 允許自建收入分類；kindOf 必須看 id → kind，不是看名字
    const sideJob = makeCategory({
      kind: 'income', name: '副業', colorSet: nextColorSet(CATS), order: nextOrder(CATS),
    });
    const catsWithSideJob = [...CATS, sideJob];
    const t: Txn = {
      id: 'side-job-1', date: '2026-09-10', mainId: sideJob.id, subId: sideJob.subs[0]!.id,
      mainName: '副業', subName: '副業', amountCents: 50_000, currency: 'CAD',
      actualCadCents: 50_000, by: '我', note: '',
      createdAt: '2026-09-10T00:00:00.000Z', updatedAt: '2026-09-10T00:00:00.000Z', deleted: false,
    };
    const totals = totalsIn([t], rangeOf('month', '2026-09-06'), catsWithSideJob);
    expect(totals.incomeCents).toBe(50_000);
    expect(totals.expenseCents).toBe(0);
  });
});

describe('calendarCells（§4）', () => {
  const txns = [
    txn({ date: '2026-09-01', actualCadCents: 220_000, mainId: cat('租屋').id }),
    txn({ date: '2026-09-02', actualCadCents: 2_900 }),
    txn({ date: '2026-09-15', actualCadCents: 6_000, mainId: cat('收入').id }),
  ];

  it('格數等於當月天數', () => {
    expect(calendarCells(txns, 2026, 8, CATS)).toHaveLength(30);
    expect(calendarCells(txns, 2026, 1, CATS)).toHaveLength(28);
  });

  it('熱度以當月最大支出為分母，範圍 0–1', () => {
    const cells = calendarCells(txns, 2026, 8, CATS);
    expect(cells[0]!.heat).toBe(1);                     // 9/1 是最大值
    expect(cells[1]!.heat).toBeCloseTo(2_900 / 220_000, 6);
    expect(cells[2]!.heat).toBe(0);
  });

  it('有收入的那天標記 hasIncome', () => {
    const cells = calendarCells(txns, 2026, 8, CATS);
    expect(cells[14]!.hasIncome).toBe(true);            // 9/15
    expect(cells[14]!.expenseCents).toBe(0);            // 收入不算進支出
    expect(cells[0]!.hasIncome).toBe(false);
  });

  it('當月完全沒支出時熱度一律 0，不可除以零', () => {
    const cells = calendarCells([], 2026, 8, CATS);
    expect(cells.every((c) => c.heat === 0)).toBe(true);
  });
});

describe('budgetMultiplier（增補檔 D-1）', () => {
  it('月 ×1', () => {
    expect(budgetMultiplier('month', '2026-09-06')).toBe(1);
  });

  it('年 ×12', () => {
    expect(budgetMultiplier('year', '2026-09-06')).toBe(12);
  });

  it('週 = 7 / 當月天數', () => {
    // 用不跨月的錨點（該週週一與錨點同月）；跨月案例見 I6 測試
    expect(budgetMultiplier('week', '2026-09-10')).toBeCloseTo(7 / 30, 6);
    expect(budgetMultiplier('week', '2026-02-10')).toBeCloseTo(7 / 28, 6);
  });

  it('I6：跨月的同一週，倍率不能因為點哪一天而不同', () => {
    // 2026-08-31（一）～2026-09-07（一）是同一個顯示週，週一落在 8 月
    const fromMonthEnd = budgetMultiplier('week', '2026-08-31');  // 點到月底那天
    const fromMonthStart = budgetMultiplier('week', '2026-09-01'); // 點到隔月第一天
    expect(fromMonthEnd).toBe(fromMonthStart);
    expect(fromMonthEnd).toBeCloseTo(7 / 31, 6);  // 週一（8/31）所在的 8 月有 31 天
  });
});

describe('budgetRows（§6）', () => {
  const txns = [
    txn({ date: '2026-09-01', actualCadCents: 205_000, mainId: cat('租屋').id }),  // 預算 210_000 → 97.6% warn
    txn({ date: '2026-09-03', actualCadCents:  30_000, mainId: cat('保險').id }),  // 預算 26_000 → 超支 4_000
    txn({ date: '2026-09-04', actualCadCents:  10_000, mainId: cat('外食').id }),  // 預算 45_000 → 22% normal
    txn({ date: '2026-09-15', actualCadCents: 312_000, mainId: cat('收入').id }),
  ];

  it('只列 kind==="expense" 且 active 的分類（增補檔 B-2）', () => {
    const rows = budgetRows(txns, CATS, 'month', '2026-09-06');
    expect(rows.map((r) => r.name)).not.toContain('收入');
    expect(rows).toHaveLength(6);
  });

  it('三段狀態：normal / warn(>85%) / over', () => {
    const rows = budgetRows(txns, CATS, 'month', '2026-09-06');
    const by = Object.fromEntries(rows.map((r) => [r.name, r]));
    expect(by['外食']!.state).toBe('normal');
    expect(by['租屋']!.state).toBe('warn');
    expect(by['保險']!.state).toBe('over');
    expect(by['保險']!.overCents).toBe(4_000);
  });

  it('§11-1：換維度時倍率跟著換', () => {
    const y = budgetRows(txns, CATS, 'year', '2026-09-06');
    expect(y.find((r) => r.name === '租屋')!.budgetCents).toBe(210_000 * 12);
    const w = budgetRows(txns, CATS, 'week', '2026-09-10');  // 不跨月的錨點
    expect(w.find((r) => r.name === '租屋')!.budgetCents)
      .toBe(Math.round(210_000 * (7 / 30)));
  });

  it('ratio 上限不夾，超支要能大於 1（畫面才畫得出超支）', () => {
    const rows = budgetRows(txns, CATS, 'month', '2026-09-06');
    expect(rows.find((r) => r.name === '保險')!.ratio).toBeGreaterThan(1);
  });
});

describe('trendSeries（§6）', () => {
  it('週維度給 7 個點，標籤是星期', () => {
    const s = trendSeries([], 'week', '2026-09-06', CATS);
    expect(s).toHaveLength(7);
    expect(s[0]!.label).toBe('一');
    expect(s[6]!.label).toBe('日');
  });

  it('月維度給當月的 ISO 週，標籤是 W##', () => {
    const s = trendSeries([], 'month', '2026-09-06', CATS);
    expect(s.every((p) => /^W\d+$/.test(p.label))).toBe(true);
    expect(s.length).toBeGreaterThanOrEqual(4);
    expect(s.length).toBeLessThanOrEqual(6);
  });

  it('年維度給 12 個月，標籤是 N月', () => {
    const s = trendSeries([], 'year', '2026-09-06', CATS);
    expect(s).toHaveLength(12);
    expect(s[0]!.label).toBe('1月');
    expect(s[11]!.label).toBe('12月');
  });

  it('金額被分進正確的點', () => {
    const txns = [
      txn({ date: '2026-03-10', actualCadCents: 5_000 }),
      txn({ date: '2026-03-20', actualCadCents: 3_000 }),
      txn({ date: '2026-07-01', actualCadCents: 100_000, mainId: cat('收入').id }),
    ];
    const s = trendSeries(txns, 'year', '2026-09-06', CATS);
    expect(s[2]!.expenseCents).toBe(8_000);   // 3 月
    expect(s[6]!.incomeCents).toBe(100_000);  // 7 月
  });

  it('I10：月維度依 ISO 週分桶，金額落在正確的桶（含只有 6 天的首週與 3 天的末週）', () => {
    const txns = [
      txn({ date: '2026-09-02', actualCadCents: 1_000 }),                        // W36（9/1–9/6）
      txn({ date: '2026-09-05', actualCadCents:   500 }),                        // W36
      txn({ date: '2026-09-10', actualCadCents: 2_000 }),                        // W37（9/7–9/13）
      txn({ date: '2026-09-15', actualCadCents: 5_000, mainId: cat('收入').id }), // W38（9/14–9/20），收入
      txn({ date: '2026-09-22', actualCadCents: 3_000 }),                        // W39（9/21–9/27）
      txn({ date: '2026-09-29', actualCadCents:   700 }),                        // W40（9/28–9/30，只有 3 天）
    ];
    const s = trendSeries(txns, 'month', '2026-09-06', CATS);
    const by = Object.fromEntries(s.map((p) => [p.label, p]));

    expect(by['W36']!.expenseCents).toBe(1_500);
    expect(by['W37']!.expenseCents).toBe(2_000);
    expect(by['W38']!.incomeCents).toBe(5_000);
    expect(by['W38']!.expenseCents).toBe(0);
    expect(by['W39']!.expenseCents).toBe(3_000);
    expect(by['W40']!.expenseCents).toBe(700);

    // 這是正確行為、不是 bug：9 月的 W36 桶只涵蓋 9/1–9/6（該 ISO 週的週一其實是
    // 8/31，不屬於 9 月），所以每一桶加總起來剛好等於整月合計，不多不少、不重疊。
    const sumExpense = s.reduce((a, p) => a + p.expenseCents, 0);
    const sumIncome = s.reduce((a, p) => a + p.incomeCents, 0);
    const monthTotal = totalsIn(txns, rangeOf('month', '2026-09-06'), CATS);
    expect(sumExpense).toBe(monthTotal.expenseCents);
    expect(sumIncome).toBe(monthTotal.incomeCents);
  });
});

describe('comparePrevious（§6 增減 pill）', () => {
  const txns = [
    txn({ date: '2026-08-10', actualCadCents: 100_000 }),
    txn({ date: '2026-09-10', actualCadCents:  50_000 }),
  ];

  it('本期支出較少 → 結餘上升', () => {
    const c = comparePrevious(txns, 'month', '2026-09-06', CATS);
    expect(c.direction).toBe('up');
  });

  it('前期為零時不回傳 Infinity', () => {
    const c = comparePrevious([txn({ date: '2026-09-10', actualCadCents: 5_000 })],
      'month', '2026-09-06', CATS);
    expect(Number.isFinite(c.deltaRatio)).toBe(true);
  });

  it('Minor 4：前期為零、本期轉虧損時，deltaRatio 要是負的（不能顯示「▼ +100%」）', () => {
    // 純支出（沒有收入分類），本期淨額為負；前期沒有任何紀錄，淨額為零
    const c = comparePrevious([txn({ date: '2026-09-10', actualCadCents: 5_000 })],
      'month', '2026-09-06', CATS);
    expect(c.direction).toBe('down');
    expect(c.deltaRatio).toBe(-1);
  });
});

describe('txnsOn（§4 明細列表）', () => {
  it('依新增時間（createdAt）升冪排序，軟刪不列', () => {
    const txns = [
      txn({ date: '2026-09-05', actualCadCents: 2_900, createdAt: '2026-09-05T20:30:00.000Z' }),
      txn({ date: '2026-09-05', actualCadCents: 520,  createdAt: '2026-09-05T08:40:00.000Z' }),
      txn({ date: '2026-09-05', actualCadCents: 999,  createdAt: '2026-09-05T09:00:00.000Z', deleted: true }),
    ];
    const list = txnsOn(txns, '2026-09-05');
    expect(list).toHaveLength(2);
    expect(list[0]!.actualCadCents).toBe(520);
    expect(list[1]!.actualCadCents).toBe(2_900);
  });

  it('編輯備註（更新 updatedAt）不會改變排序位置（I8）', () => {
    const txns = [
      txn({
        date: '2026-09-05', actualCadCents: 520, createdAt: '2026-09-05T08:00:00.000Z',
        updatedAt: '2026-09-05T23:00:00.000Z',   // 剛編輯過，updatedAt 很晚
      }),
      txn({
        date: '2026-09-05', actualCadCents: 2_900, createdAt: '2026-09-05T18:00:00.000Z',
        updatedAt: '2026-09-05T18:00:00.000Z',
      }),
    ];
    const list = txnsOn(txns, '2026-09-05');
    // 若誤用 updatedAt 排序，520 那筆會被排到後面
    expect(list[0]!.actualCadCents).toBe(520);
    expect(list[1]!.actualCadCents).toBe(2_900);
  });
});
