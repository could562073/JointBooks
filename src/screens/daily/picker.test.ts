import { describe, it, expect } from 'vitest';
import { isCurrentMonthCell, monthSlideDirection, pickerYears } from './picker';

describe('pickerYears', () => {
  it('錨點年排在第三格，左邊兩年右邊一年', () => {
    expect(pickerYears(2026)).toEqual([2024, 2025, 2026, 2027]);
  });

  it('翻年只是錨點位移，四格一起跟著走', () => {
    expect(pickerYears(2027)).toEqual([2025, 2026, 2027, 2028]);
    expect(pickerYears(2025)).toEqual([2023, 2024, 2025, 2026]);
  });
});

describe('monthSlideDirection', () => {
  it('往未來是 1，往過去是 -1', () => {
    expect(monthSlideDirection(2026, 8, 2026, 11)).toBe(1);
    expect(monthSlideDirection(2026, 8, 2026, 2)).toBe(-1);
  });

  it('跨年不會被月份數字騙走方向', () => {
    // 2025年12月 → 2026年1月 是往前，雖然月份數字從 11 掉到 0
    expect(monthSlideDirection(2025, 11, 2026, 0)).toBe(1);
    // 2026年1月 → 2025年12月 是往回，雖然月份數字從 0 升到 11
    expect(monthSlideDirection(2026, 0, 2025, 11)).toBe(-1);
  });

  it('選到同一個月給定值 1', () => {
    expect(monthSlideDirection(2026, 8, 2026, 8)).toBe(1);
  });
});

describe('isCurrentMonthCell', () => {
  it('錨點年等於在看的年份時，該月才算選中', () => {
    expect(isCurrentMonthCell(2026, 2026, 8, 8)).toBe(true);
    expect(isCurrentMonthCell(2026, 2026, 8, 7)).toBe(false);
  });

  it('翻到別的年份時整排都不標選中', () => {
    // 錨點翻到 2027，2026年9月 不該還亮著
    expect(isCurrentMonthCell(2027, 2026, 8, 8)).toBe(false);
  });
});
