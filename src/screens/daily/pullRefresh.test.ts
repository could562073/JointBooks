import { describe, it, expect } from 'vitest';
import { PULL_MAX, pullStyle, shouldArmPull } from './pullRefresh';

describe('shouldArmPull', () => {
  it('捲到頂又往下拉才接管', () => {
    expect(shouldArmPull(true, 12)).toBe(true);
  });

  it('沒捲到頂時不接管，否則使用者捲不動明細', () => {
    expect(shouldArmPull(false, 12)).toBe(false);
  });

  it('往上滑不接管，那是要捲動內容', () => {
    expect(shouldArmPull(true, -12)).toBe(false);
    expect(shouldArmPull(true, 0)).toBe(false);
  });
});

describe('pullStyle', () => {
  it('沒拉時高度與透明度都是 0', () => {
    expect(pullStyle(0)).toEqual({ height: 0, opacity: 0 });
  });

  it('拉到上限時滿版', () => {
    expect(pullStyle(PULL_MAX)).toEqual({ height: PULL_MAX, opacity: 1 });
  });

  it('超過上限不會再長，也不會算出 >1 的 opacity', () => {
    expect(pullStyle(500)).toEqual({ height: PULL_MAX, opacity: 1 });
  });

  it('負位移夾成 0', () => {
    expect(pullStyle(-40)).toEqual({ height: 0, opacity: 0 });
  });

  it('上限跟 preset 的 max 是同一個數字', () => {
    expect(PULL_MAX).toBe(64);
  });
});
