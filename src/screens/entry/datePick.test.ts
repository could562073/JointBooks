import { describe, it, expect } from 'vitest';
import { shiftMonth, today, withDay } from './datePick';

describe('shiftMonth', () => {
  it('往前往後各一個月', () => {
    expect(shiftMonth('2026-09-06', 1)).toBe('2026-10-06');
    expect(shiftMonth('2026-09-06', -1)).toBe('2026-08-06');
  });

  it('跨年正確', () => {
    expect(shiftMonth('2026-12-15', 1)).toBe('2027-01-15');
    expect(shiftMonth('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('跳到天數較少的月份時夾到月底，不會冒出 2/31', () => {
    expect(shiftMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftMonth('2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftMonth('2026-05-31', 1)).toBe('2026-06-30');
  });

  it('閏年的 2 月有 29 天', () => {
    expect(shiftMonth('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('夾過之後不會自己長回來（連按兩次不是原地往返）', () => {
    // 1/31 → 2/28 → 3/28，而不是回到 3/31
    expect(shiftMonth(shiftMonth('2026-01-31', 1), 1)).toBe('2026-03-28');
  });
});

describe('withDay', () => {
  it('同一個月裡換日', () => {
    expect(withDay('2026-09-06', 18)).toBe('2026-09-18');
  });

  it('不會影響年月', () => {
    expect(withDay('2026-12-01', 31)).toBe('2026-12-31');
  });
});

describe('today', () => {
  it('用本地時區組出 YYYY-MM-DD', () => {
    expect(today(new Date(2026, 8, 6, 23, 30))).toBe('2026-09-06');
  });

  it('接近午夜也不會跳到隔天（不是走 UTC）', () => {
    expect(today(new Date(2026, 8, 6, 0, 5))).toBe('2026-09-06');
  });
});
