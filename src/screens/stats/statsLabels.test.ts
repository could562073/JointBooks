import { describe, it, expect } from 'vitest';
import { rangeOf } from '../../domain/date';
import { deltaLabel, expenseShare, periodLabel, trendAxisNote } from './statsLabels';

describe('periodLabel', () => {
  it('年維度只寫年份', () => {
    expect(periodLabel('year', rangeOf('year', '2026-09-06'))).toBe('2026年');
  });

  it('月結日是 1 號時只寫月份', () => {
    expect(periodLabel('month', rangeOf('month', '2026-09-06'))).toBe('2026年9月');
  });

  it('月結日不是 1 號時寫成區間（§6）', () => {
    expect(periodLabel('month', { start: '2026-09-15', end: '2026-10-15' }))
      .toBe('9/15 – 10/14');
  });

  it('週維度一律寫區間', () => {
    // 2026-09-06 是週日，週一起始的那一週是 8/31 – 9/6
    expect(periodLabel('week', rangeOf('week', '2026-09-06'))).toBe('8/31 – 9/6');
  });

  it('區間結束是 end 的前一天（Range 是半開區間）', () => {
    expect(periodLabel('week', { start: '2026-09-07', end: '2026-09-14' }))
      .toBe('9/7 – 9/13');
  });

  it('跨年的區間也算得對', () => {
    expect(periodLabel('month', { start: '2026-12-15', end: '2027-01-15' }))
      .toBe('12/15 – 1/14');
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

describe('trendAxisNote', () => {
  it('依維度變', () => {
    expect(trendAxisNote('month')).toBe('本月各週');
    expect(trendAxisNote('year')).toBe('1–12月');
  });

  it('週維度跟著週起始設定', () => {
    expect(trendAxisNote('week', 'mon')).toBe('一–日');
    expect(trendAxisNote('week', 'sun')).toBe('日–六');
  });
});
