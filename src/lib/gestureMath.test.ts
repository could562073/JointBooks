import { describe, it, expect } from 'vitest';
import { GESTURE } from './gesture';
import {
  shouldTakeOver, shouldAbandon, applyBounds, velocityOf, decideSnap,
} from './gestureMath';

describe('shouldTakeOver（§11-15：門檻之前不可攔掉點擊）', () => {
  it('未達門檻不接管', () => {
    expect(shouldTakeOver(9, 0, GESTURE.monthSwipe)).toBe(false);
  });

  it('剛好等於門檻不接管，超過才接管', () => {
    expect(shouldTakeOver(10, 0, GESTURE.monthSwipe)).toBe(false);
    expect(shouldTakeOver(11, 0, GESTURE.monthSwipe)).toBe(true);
  });

  it('負向位移一樣算距離', () => {
    expect(shouldTakeOver(-11, 0, GESTURE.monthSwipe)).toBe(true);
  });

  it('takeoverPx 為 0 時任何位移都接管', () => {
    expect(shouldTakeOver(1, 0, GESTURE.calendarHandle)).toBe(true);
    expect(shouldTakeOver(0, 0, GESTURE.calendarHandle)).toBe(false);
  });
});

describe('shouldAbandon（§10 #7：垂直超出水平 18px 就放棄）', () => {
  it('另一軸超出主軸未達 18px 不放棄', () => {
    expect(shouldAbandon(10, 27, GESTURE.monthSwipe)).toBe(false);
  });

  it('超出 18px 才放棄', () => {
    expect(shouldAbandon(10, 28, GESTURE.monthSwipe)).toBe(false);
    expect(shouldAbandon(10, 29, GESTURE.monthSwipe)).toBe(true);
  });

  it('abandonPx 為 null 的 preset 永不放棄', () => {
    expect(shouldAbandon(0, 500, GESTURE.categoryCard)).toBe(false);
  });
});

describe('applyBounds（§10 通則：超界要有阻尼，不可硬止）', () => {
  it('範圍內原樣回傳', () => {
    expect(applyBounds(-40, GESTURE.categoryCard)).toBe(-40);
    expect(applyBounds(0, GESTURE.categoryCard)).toBe(0);
    expect(applyBounds(-84, GESTURE.categoryCard)).toBe(-84);
  });

  it('超出下界的部分乘上阻尼', () => {
    // -84 是界，再過 20px：-84 + (-20 × 0.3) = -90
    expect(applyBounds(-104, GESTURE.categoryCard)).toBeCloseTo(-90, 5);
  });

  it('超出上界的部分乘上阻尼', () => {
    // 0 是界，再過 20px：0 + (20 × 0.3) = 6
    expect(applyBounds(20, GESTURE.categoryCard)).toBeCloseTo(6, 5);
  });

  it('無界的 preset 原樣回傳', () => {
    expect(applyBounds(9999, GESTURE.monthSwipe)).toBe(9999);
    expect(applyBounds(-9999, GESTURE.monthSwipe)).toBe(-9999);
  });

  it('只有一端有界時，另一端不受限', () => {
    // panelDismiss：min 0、max null
    expect(applyBounds(500, GESTURE.panelDismiss)).toBe(500);
    expect(applyBounds(-20, GESTURE.panelDismiss)).toBeCloseTo(-8, 5); // 0 + (-20 × 0.4)
  });
});

describe('velocityOf', () => {
  it('等速取樣得到正確的 px/ms', () => {
    const s = [{ pos: 0, t: 0 }, { pos: 50, t: 100 }];
    expect(velocityOf(s)).toBeCloseTo(0.5, 5);
  });

  it('負向速度', () => {
    expect(velocityOf([{ pos: 0, t: 0 }, { pos: -30, t: 100 }])).toBeCloseTo(-0.3, 5);
  });

  it('只取最近的時間窗，忽略更早的取樣', () => {
    // 窗 100ms：前 200ms 幾乎沒動，最後 100ms 快速移動
    const s = [
      { pos: 0, t: 0 }, { pos: 1, t: 200 }, { pos: 61, t: 300 },
    ];
    expect(velocityOf(s, 100)).toBeCloseTo(0.6, 5);
  });

  it('取樣不足或時間差為零時回 0，不可得到 Infinity', () => {
    expect(velocityOf([])).toBe(0);
    expect(velocityOf([{ pos: 5, t: 10 }])).toBe(0);
    expect(velocityOf([{ pos: 0, t: 5 }, { pos: 50, t: 5 }])).toBe(0);
  });
});

describe('decideSnap（放手判定：位移或速度，任一超過即吸附）', () => {
  const p = GESTURE.monthSwipe;

  it('位移超過門檻即吸附，方向依正負', () => {
    expect(decideSnap(57, 0, p)).toEqual({ kind: 'snap', direction: 1 });
    expect(decideSnap(-57, 0, p)).toEqual({ kind: 'snap', direction: -1 });
  });

  it('位移不足但速度夠也吸附', () => {
    expect(decideSnap(10, 0.36, p)).toEqual({ kind: 'snap', direction: 1 });
    expect(decideSnap(-10, -0.36, p)).toEqual({ kind: 'snap', direction: -1 });
  });

  it('速度方向與位移相反時，以速度方向為準（甩回去）', () => {
    expect(decideSnap(30, -0.4, p)).toEqual({ kind: 'snap', direction: -1 });
  });

  it('兩者都不足則彈回', () => {
    expect(decideSnap(55, 0.34, p)).toEqual({ kind: 'return' });
  });

  it('門檻是嚴格大於，等於不觸發', () => {
    expect(decideSnap(56, 0.35, p)).toEqual({ kind: 'return' });
  });

  it('§10 #13：位移小於 tapPx 視為點擊，優先於其他判定', () => {
    const h = GESTURE.calendarHandle;
    expect(decideSnap(5, 0, h)).toEqual({ kind: 'tap' });
    expect(decideSnap(-5, 0, h)).toEqual({ kind: 'tap' });
    expect(decideSnap(6, 0, h)).toEqual({ kind: 'return' });
  });

  it('點擊判定不因速度而失效：手指抖一下仍是點擊', () => {
    expect(decideSnap(3, 0.9, GESTURE.calendarHandle)).toEqual({ kind: 'tap' });
  });

  it('tapPx 為 0 的 preset 永遠不回 tap', () => {
    expect(decideSnap(0, 0, GESTURE.monthSwipe)).toEqual({ kind: 'return' });
  });
});
