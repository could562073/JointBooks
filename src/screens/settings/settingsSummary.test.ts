import { describe, it, expect } from 'vitest';
import { defaultCategories } from '../../domain/categories';
import type { Category } from '../../domain/types';
import { categorySummary, STACK_SIZE, stackedIcons } from './settingsSummary';

let n = 0;
const CATS: Category[] = defaultCategories(() => `id-${n++}`);

describe('categorySummary', () => {
  it('數量是所有 active 的分類', () => {
    expect(categorySummary(CATS).count).toBe(CATS.length);
  });

  it('月額度只加預算，收入分類沒有預算所以不影響', () => {
    const expected = CATS.reduce((s, c) => s + (c.budgetCents ?? 0), 0);
    expect(categorySummary(CATS).budgetCents).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('假刪的分類不算進數量，也不算進月額度', () => {
    const first = CATS[0]!;
    const withDeleted = CATS.map((c) => (c.id === first.id ? { ...c, active: false } : c));
    const s = categorySummary(withDeleted);
    expect(s.count).toBe(CATS.length - 1);
    expect(s.budgetCents).toBe(categorySummary(CATS).budgetCents - (first.budgetCents ?? 0));
  });

  it('沒有分類時是 0，不是 NaN', () => {
    expect(categorySummary([])).toEqual({ count: 0, budgetCents: 0 });
  });
});

describe('stackedIcons', () => {
  it('最多五個', () => {
    expect(stackedIcons(CATS)).toHaveLength(STACK_SIZE);
  });

  it('只取支出側', () => {
    for (const c of stackedIcons(CATS)) expect(c.kind).toBe('expense');
  });

  it('照 order 排', () => {
    const got = stackedIcons(CATS).map((c) => c.order);
    expect(got).toEqual([...got].sort((a, b) => a - b));
  });

  it('不足五個時有幾個給幾個', () => {
    expect(stackedIcons(CATS.slice(0, 2))).toHaveLength(2);
    expect(stackedIcons([])).toHaveLength(0);
  });

  it('假刪的不出現', () => {
    const hidden = CATS.map((c, i) => (i === 0 ? { ...c, active: false } : c));
    expect(stackedIcons(hidden).map((c) => c.id)).not.toContain(CATS[0]!.id);
  });
});
