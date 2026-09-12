import { describe, it, expect } from 'vitest';
import { GESTURE } from '../../lib/gesture';
import { CARD_OPEN_X, cardX, shiftBounds, snapToOpen } from './cardSwipe';

describe('CARD_OPEN_X', () => {
  it('就是 preset 的 min，不另外寫一個數字', () => {
    expect(CARD_OPEN_X).toBe(-84);
    expect(CARD_OPEN_X).toBe(GESTURE.categoryCard.min);
  });
});

describe('shiftBounds', () => {
  it('關閉時完全等同原 preset', () => {
    expect(shiftBounds(0)).toEqual(GESTURE.categoryCard);
  });

  it('展開時邊界變成「可以往右拖回原位」', () => {
    // base -84：往右最多 +84 回到 0，往左不能再走
    expect(shiftBounds(CARD_OPEN_X)).toMatchObject({ min: 0, max: 84 });
  });

  it('阻尼與門檻不受影響', () => {
    const s = shiftBounds(CARD_OPEN_X);
    expect(s.damping).toBe(GESTURE.categoryCard.damping);
    expect(s.snapDistancePx).toBe(GESTURE.categoryCard.snapDistancePx);
    expect(s.takeoverPx).toBe(GESTURE.categoryCard.takeoverPx);
  });
});

describe('cardX', () => {
  it('關閉時就是拖曳位移本身', () => {
    expect(cardX(false, 0)).toBe(0);
    expect(cardX(false, -30)).toBe(-30);
  });

  it('展開時從 -84 起算', () => {
    expect(cardX(true, 0)).toBe(-84);
    expect(cardX(true, 60)).toBe(-24);
    expect(cardX(true, 84)).toBe(0);
  });
});

describe('snapToOpen', () => {
  it('往左展開、往右收回', () => {
    expect(snapToOpen(-1)).toBe(true);
    expect(snapToOpen(1)).toBe(false);
  });
});
