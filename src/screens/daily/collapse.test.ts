import { describe, it, expect } from 'vitest';
import { CALENDAR_MAX_H, collapseStyle, handleHint, snapToCollapsed } from './collapse';

describe('collapseStyle', () => {
  it('沒在拖曳時就是兩個端點', () => {
    expect(collapseStyle(false, 0)).toEqual({ maxHeight: CALENDAR_MAX_H, opacity: 1 });
    expect(collapseStyle(true, 0)).toEqual({ maxHeight: 0, opacity: 0 });
  });

  it('展開狀態往上拖，高度跟著減少，opacity 同步', () => {
    const s = collapseStyle(false, -100);
    expect(s.maxHeight).toBe(CALENDAR_MAX_H - 100);
    expect(s.opacity).toBeCloseTo((CALENDAR_MAX_H - 100) / CALENDAR_MAX_H);
  });

  it('收起狀態往下拉，高度跟著長回來', () => {
    expect(collapseStyle(true, 120).maxHeight).toBe(120);
  });

  it('拖過頭不會超出 0–460', () => {
    expect(collapseStyle(false, -9999).maxHeight).toBe(0);
    expect(collapseStyle(false, 9999).maxHeight).toBe(CALENDAR_MAX_H);
    expect(collapseStyle(true, -9999).maxHeight).toBe(0);
    expect(collapseStyle(true, 9999).maxHeight).toBe(CALENDAR_MAX_H);
  });

  it('opacity 一律落在 0–1', () => {
    for (const [c, o] of [[false, -9999], [false, 9999], [true, -9999], [true, 9999]] as const) {
      const { opacity } = collapseStyle(c, o);
      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });
});

describe('snapToCollapsed', () => {
  it('往上吸附成收起，往下吸附成展開', () => {
    expect(snapToCollapsed(-1)).toBe(true);
    expect(snapToCollapsed(1)).toBe(false);
  });
});

describe('handleHint', () => {
  it('提示文字隨狀態變', () => {
    expect(handleHint(false)).toBe('往上滑看更多明細');
    expect(handleHint(true)).toBe('往下拉看月曆');
  });
});
