import { describe, it, expect } from 'vitest';
import { rangeOf } from '../../domain/date';
import type { BudgetRow } from '../../domain/aggregate';
import {
  balanceTitle, budgetTotal, deltaLabel, expenseOfIncomeRatio, expenseShare, periodSpan, periodWord,
} from './statsLabels';

describe('balanceTitle', () => {
  it('看的是目前這一期：本週／本月／今年結餘', () => {
    const today = '2026-09-06';
    expect(balanceTitle('week', rangeOf('week', today), today)).toBe('本週結餘');
    expect(balanceTitle('month', rangeOf('month', today), today)).toBe('本月結餘');
    expect(balanceTitle('year', rangeOf('year', today), today)).toBe('今年結餘');
  });

  it('看的是別的期間：寫當週／當月／當年，不會標成本月', () => {
    const today = '2026-10-02';
    expect(balanceTitle('week', rangeOf('week', '2026-09-06'), today)).toBe('當週結餘');
    expect(balanceTitle('month', rangeOf('month', '2026-09-06'), today)).toBe('當月結餘');
    expect(balanceTitle('year', rangeOf('year', '2025-09-06'), today)).toBe('當年結餘');
  });
});

describe('periodSpan', () => {
  it('週：2026-09-06 是週日，週一起始的那一週是 8/31 ~ 9/6', () => {
    expect(periodSpan(rangeOf('week', '2026-09-06'))).toBe('8/31 ~ 9/6');
  });

  it('月：9/1 ~ 9/30', () => {
    expect(periodSpan(rangeOf('month', '2026-09-06'))).toBe('9/1 ~ 9/30');
  });

  it('年：1/1 ~ 12/31', () => {
    expect(periodSpan(rangeOf('year', '2026-09-06'))).toBe('1/1 ~ 12/31');
  });

  it('區間結束是 end 的前一天（Range 是半開區間）', () => {
    expect(periodSpan({ start: '2026-09-07', end: '2026-09-14' })).toBe('9/7 ~ 9/13');
  });

  it('月結日不是 1 號：15 號結算顯示成 9/15 ~ 10/14', () => {
    expect(periodSpan(rangeOf('month', '2026-09-20', 15))).toBe('9/15 ~ 10/14');
  });

  it('跨年的區間也算得對', () => {
    expect(periodSpan({ start: '2026-12-15', end: '2027-01-15' })).toBe('12/15 ~ 1/14');
  });
});

describe('deltaLabel', () => {
  it('增加是 ▲，減少是 ▼', () => {
    expect(deltaLabel(0.123, 'up')).toBe('▲ 12%');
    expect(deltaLabel(-0.5, 'down')).toBe('▼ 50%');
  });

  it('持平不顯示箭頭', () => {
    expect(deltaLabel(0, 'flat')).toBe('持平');
  });

  it('百分比取絕對值，符號由箭頭表示', () => {
    expect(deltaLabel(-0.08, 'down')).toBe('▼ 8%');
  });

  it('超過 100% 照實顯示', () => {
    expect(deltaLabel(2.4, 'up')).toBe('▲ 240%');
  });
});

describe('expenseShare', () => {
  it('支出佔比', () => {
    expect(expenseShare(100, 300)).toBe(0.75);
    expect(expenseShare(300, 100)).toBe(0.25);
  });

  it('沒有任何紀錄時是 0，不是一半一半', () => {
    expect(expenseShare(0, 0)).toBe(0);
  });

  it('只有一邊有數字時是 0 或 1', () => {
    expect(expenseShare(0, 500)).toBe(1);
    expect(expenseShare(500, 0)).toBe(0);
  });
});

describe('expenseOfIncomeRatio', () => {
  it('支出佔收入的比例（原型的支出條寬度）', () => {
    expect(expenseOfIncomeRatio(100_000, 65_000)).toBeCloseTo(0.65);
  });

  it('支出超過收入時灌滿，不超過 1', () => {
    expect(expenseOfIncomeRatio(100, 300)).toBe(1);
  });

  it('收入為 0 但有支出時灌滿', () => {
    expect(expenseOfIncomeRatio(0, 500)).toBe(1);
  });

  it('都是 0 時是 0，不是一半一半', () => {
    expect(expenseOfIncomeRatio(0, 0)).toBe(0);
  });
});

describe('budgetTotal', () => {
  const row = (budgetCents: number): BudgetRow => ({
    categoryId: 'c', name: '', icon: 'coin', colorSet: 0,
    spentCents: 0, budgetCents, ratio: 0, state: 'normal', overCents: 0,
  });

  it('加總每一列的預算金額', () => {
    expect(budgetTotal([row(210_000), row(26_000)])).toBe(236_000);
  });

  it('沒有任何預算列時是 0', () => {
    expect(budgetTotal([])).toBe(0);
  });
});

describe('periodWord（趨勢圖上標示目前這一期）', () => {
  it('看的是目前這一期寫本週，別的期間寫當月', () => {
    expect(periodWord('week', rangeOf('week', '2026-09-06'), '2026-09-06')).toBe('本週');
    expect(periodWord('month', rangeOf('month', '2026-08-06'), '2026-09-06')).toBe('當月');
  });
});
