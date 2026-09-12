import { describe, it, expect } from 'vitest';
import { GESTURE } from '../../lib/gesture';
import { swipeOpacity } from './useMonthSwipe';

describe('swipeOpacity', () => {
  it('沒位移時完全不透明', () => {
    expect(swipeOpacity(0)).toBe(1);
  });

  it('滑到吸附門檻剛好降到 .5', () => {
    expect(swipeOpacity(GESTURE.monthSwipe.snapDistancePx)).toBe(0.5);
    expect(swipeOpacity(-GESTURE.monthSwipe.snapDistancePx)).toBe(0.5);
  });

  it('超過門檻不會再更透明', () => {
    expect(swipeOpacity(999)).toBe(0.5);
    expect(swipeOpacity(-999)).toBe(0.5);
  });

  it('中途是線性的，左右對稱', () => {
    const half = GESTURE.monthSwipe.snapDistancePx / 2;
    expect(swipeOpacity(half)).toBeCloseTo(0.75, 5);
    expect(swipeOpacity(-half)).toBeCloseTo(0.75, 5);
  });
});
