import { describe, expect, it } from 'vitest';
import type { Category, Txn } from '../../domain/types';
import { groupLabel, highlight, matches, searchTxns, shortDate } from './searchTxns';

const CATS: Category[] = [
  {
    id: 'food', kind: 'expense', name: '餐飲', icon: 'cup', budgetCents: 60_000,
    subs: [{ id: 'food-cafe', name: '咖啡' }, { id: 'food-in', name: '內用' }], colorSet: 0, order: 0, active: true,
  },
  {
    id: 'mart', kind: 'expense', name: '超市', icon: 'basket', budgetCents: 80_000,
    subs: [{ id: 'mart-food', name: '食材' }], colorSet: 1, order: 1, active: true,
  },
  {
    id: 'inc', kind: 'income', name: '收入', icon: 'coin', budgetCents: null,
    subs: [{ id: 'inc-tax', name: '退稅' }], colorSet: 2, order: 2, active: true,
  },
];

let seq = 0;
function txn(over: Partial<Txn>): Txn {
  seq += 1;
  return {
    id: `t${seq}`, date: '2026-09-04', mainId: 'mart', subId: 'mart-food',
    mainName: '超市', subName: '食材',
    amountCents: 1_000, currency: 'CAD', actualCadCents: 1_000,
    by: '我', note: '',
    createdAt: '2026-09-04T10:00:00.000Z', updatedAt: '2026-09-04T10:00:00.000Z', deleted: false,
    ...over,
  };
}

const ids = (r: ReturnType<typeof searchTxns>) => r!.groups.flatMap((g) => g.hits.map((h) => h.txn.id));

describe('searchTxns：閒置狀態', () => {
  it('沒有關鍵字、篩選是全部 → null（只顯示最近搜尋）', () => {
    expect(searchTxns([txn({})], CATS, '', 'all')).toBeNull();
  });

  it('關鍵字只有空白也算閒置', () => {
    expect(searchTxns([txn({})], CATS, '   ', 'all')).toBeNull();
  });
});

describe('searchTxns：比對', () => {
  it('不分大小寫比對備註：costco 找得到 Costco', () => {
    const a = txn({ note: 'Costco' });
    const b = txn({ note: 'T&T' });
    expect(ids(searchTxns([a, b], CATS, 'costco', 'all'))).toEqual([a.id]);
  });

  it('比對品項與分類名稱（以 id 解析的目前名稱為準）', () => {
    const cafe = txn({ mainId: 'food', subId: 'food-cafe', mainName: '舊名', subName: '舊品項' });
    const mart = txn({});
    expect(ids(searchTxns([cafe, mart], CATS, '咖啡', 'all'))).toEqual([cafe.id]);
    expect(ids(searchTxns([cafe, mart], CATS, '超市', 'all'))).toEqual([mart.id]);
  });

  it('分類刪掉後退回紀錄上的名稱快照', () => {
    const orphan = txn({ mainId: 'gone', subId: 'gone-s', mainName: '寵物', subName: '飼料' });
    expect(ids(searchTxns([orphan], CATS, '飼料', 'all'))).toEqual([orphan.id]);
  });

  it('金額用 toFixed(2) 字串包含比對：12.3 找得到 12.30', () => {
    const a = txn({ actualCadCents: 1_230 });
    const b = txn({ actualCadCents: 1_200 });
    expect(ids(searchTxns([a, b], CATS, '12.3', 'all'))).toEqual([a.id]);
  });

  it('金額是包含比對，不只是開頭：18 找得到 186.40、18.90，也找得到 118.00', () => {
    const a = txn({ actualCadCents: 18_640 });
    const b = txn({ actualCadCents: 1_890 });
    const c = txn({ actualCadCents: 11_800 });
    const d = txn({ actualCadCents: 2_000 });
    expect(new Set(ids(searchTxns([a, b, c, d], CATS, '18', 'all')))).toEqual(new Set([a.id, b.id, c.id]));
  });

  it('已刪除的紀錄不會出現', () => {
    expect(searchTxns([txn({ note: 'Costco', deleted: true })], CATS, 'costco', 'all')!.count).toBe(0);
  });
});

describe('searchTxns：篩選', () => {
  const food = txn({ mainId: 'food', subId: 'food-in', note: 'Brunch' });
  const mart = txn({ note: 'Costco' });
  const income = txn({ mainId: 'inc', subId: 'inc-tax', note: 'GST credit', actualCadCents: 18_640 });

  it('只選分類不輸入關鍵字，列出那個分類的全部紀錄', () => {
    expect(ids(searchTxns([food, mart, income], CATS, '', { mainId: 'food' }))).toEqual([food.id]);
  });

  it('收入篩選只看收入紀錄', () => {
    expect(ids(searchTxns([food, mart, income], CATS, '', 'income'))).toEqual([income.id]);
  });

  it('關鍵字與篩選同時成立（AND）', () => {
    expect(searchTxns([food, mart, income], CATS, 'costco', { mainId: 'food' })!.count).toBe(0);
    expect(ids(searchTxns([food, mart, income], CATS, 'c', { mainId: 'mart' }))).toEqual([mart.id]);
  });

  it('結果都是收入時支出合計為 0（畫面不顯示）', () => {
    expect(searchTxns([food, mart, income], CATS, '', 'income')!.expenseCents).toBe(0);
  });
});

describe('searchTxns：分組與排序', () => {
  it('依月份新到舊分組，組內日期新到舊、同一天再依時間新到舊，各組小計只加支出', () => {
    const aug = txn({ date: '2026-08-30', actualCadCents: 9_640, note: 'x' });
    const sep1 = txn({ date: '2026-09-04', createdAt: '2026-09-04T09:00:00.000Z', actualCadCents: 2_180, note: 'x' });
    const sep2 = txn({ date: '2026-09-04', createdAt: '2026-09-04T18:00:00.000Z', actualCadCents: 11_240, note: 'x' });
    const sep3 = txn({ date: '2026-09-22', mainId: 'inc', subId: 'inc-tax', actualCadCents: 18_640, note: 'x' });
    const r = searchTxns([aug, sep1, sep2, sep3], CATS, 'x', 'all')!;

    expect(r.groups.map((g) => g.key)).toEqual(['2026-09', '2026-08']);
    expect(r.groups[0]!.hits.map((h) => h.txn.id)).toEqual([sep3.id, sep2.id, sep1.id]);
    expect(r.groups[0]!.expenseCents).toBe(2_180 + 11_240);
    expect(r.groups[1]!.expenseCents).toBe(9_640);
    expect(r.count).toBe(4);
    expect(r.expenseCents).toBe(2_180 + 11_240 + 9_640);
  });

  it('跨年的同月份分成兩組', () => {
    const r = searchTxns(
      [txn({ date: '2025-09-01', note: 'x' }), txn({ date: '2026-09-01', note: 'x' })], CATS, 'x', 'all',
    )!;
    expect(r.groups.map((g) => g.key)).toEqual(['2026-09', '2025-09']);
  });
});

describe('顯示用的小工具', () => {
  it('groupLabel：今年只寫月，往年帶年份', () => {
    expect(groupLabel({ year: 2026, month: 9 }, 2026)).toBe('9 月');
    expect(groupLabel({ year: 2025, month: 12 }, 2026)).toBe('2025 年 12 月');
  });

  it('shortDate：M/D 不補零', () => {
    expect(shortDate('2026-09-04')).toBe('9/4');
    expect(shortDate('2026-11-22')).toBe('11/22');
  });

  it('highlight 只標第一個符合處，保留原本的大小寫', () => {
    expect(highlight('TTC cc', 'c')).toEqual({ before: 'TT', hit: 'C', after: ' cc' });
    expect(highlight('Costco', 'COSTCO')).toEqual({ before: '', hit: 'Costco', after: '' });
    expect(highlight('Costco', 'zz')).toEqual({ before: 'Costco', hit: '', after: '' });
    expect(highlight('Costco', '  ')).toEqual({ before: 'Costco', hit: '', after: '' });
  });

  it('matches：關鍵字前後的空白不影響', () => {
    const h = { txn: txn({ note: 'Costco' }), category: CATS[1], kind: 'expense' as const, mainName: '超市', subName: '食材' };
    expect(matches(h, '  costco ')).toBe(true);
  });
});
