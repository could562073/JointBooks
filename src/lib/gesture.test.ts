import { describe, it, expect } from 'vitest';
import { GESTURE } from './gesture';

describe('GESTURE preset 逐條對 §10', () => {
  it('#13 月曆把手：1:1、>138px 或 >0.4px/ms、<6px 視為點擊', () => {
    expect(GESTURE.calendarHandle).toEqual({
      axis: 'y', takeoverPx: 0, followRatio: 1,
      min: null, max: null, damping: 0.4,
      snapDistancePx: 138, snapVelocity: 0.4,
      tapPx: 6, abandonPx: null,
    });
  });

  it('#7 月曆換月：10px 才接管、跟手 ×0.55、>56px 或 >0.35px/ms、垂直 18px 放棄', () => {
    expect(GESTURE.monthSwipe).toEqual({
      axis: 'x', takeoverPx: 10, followRatio: 0.55,
      min: null, max: null, damping: 0.4,
      snapDistancePx: 56, snapVelocity: 0.35,
      tapPx: 0, abandonPx: 18,
    });
  });

  it('#15 分類卡：10px 才接管、-84~0、>42px 或 >0.35px/ms', () => {
    expect(GESTURE.categoryCard).toEqual({
      axis: 'x', takeoverPx: 10, followRatio: 1,
      min: -84, max: 0, damping: 0.3,
      snapDistancePx: 42, snapVelocity: 0.35,
      tapPx: 0, abandonPx: null,
    });
  });

  it('#22/#35 面板下滑：不往上超過 0、>110px 或 >0.4px/ms', () => {
    expect(GESTURE.panelDismiss).toEqual({
      axis: 'y', takeoverPx: 0, followRatio: 1,
      min: 0, max: null, damping: 0.4,
      snapDistancePx: 110, snapVelocity: 0.4,
      tapPx: 0, abandonPx: null,
    });
  });

  it('#27 下拉重整：上限 64px、阻尼 .5', () => {
    expect(GESTURE.pullRefresh).toEqual({
      axis: 'y', takeoverPx: 0, followRatio: 1,
      min: 0, max: 64, damping: 0.5,
      snapDistancePx: 64, snapVelocity: 0.4,
      tapPx: 0, abandonPx: null,
    });
  });

  it('每個 preset 的阻尼都在規格的 0.3～0.5 之間', () => {
    for (const [name, p] of Object.entries(GESTURE)) {
      expect(p.damping, name).toBeGreaterThanOrEqual(0.3);
      expect(p.damping, name).toBeLessThanOrEqual(0.5);
    }
  });

  it('有界的 preset 才需要阻尼有意義：無界者的 damping 不被使用', () => {
    // 這條是文件性的：min/max 皆為 null 時 damping 永遠走不到，
    // 但仍給值以免日後加界線時忘了設。
    expect(GESTURE.monthSwipe.min).toBeNull();
    expect(GESTURE.monthSwipe.max).toBeNull();
  });
});
