import { describe, it, expect } from 'vitest';
import { countUpValue } from './countUpMath';

describe('countUpValue', () => {
  it('起點回 from、終點回 to', () => {
    expect(countUpValue(0, 1000, 0, 900)).toBe(0);
    expect(countUpValue(0, 1000, 900, 900)).toBe(1000);
  });

  it('超過時長仍然回 to，不會超衝', () => {
    expect(countUpValue(0, 1000, 5000, 900)).toBe(1000);
  });

  it('elapsed 為負數時回 from', () => {
    expect(countUpValue(250, 1000, -10, 900)).toBe(250);
  });

  it('duration 為 0 直接回 to —— reduced-motion 走的就是這條路', () => {
    expect(countUpValue(0, 1000, 0, 0)).toBe(1000);
  });

  it('中途值一定落在兩端之間', () => {
    const v = countUpValue(0, 1000, 450, 900);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1000);
  });

  it('回傳整數，因為單位是 cents', () => {
    expect(Number.isInteger(countUpValue(0, 3333, 137, 900))).toBe(true);
  });

  it('往下數也對（結餘可能變小甚至轉負）', () => {
    expect(countUpValue(1000, -500, 0, 900)).toBe(1000);
    expect(countUpValue(1000, -500, 900, 900)).toBe(-500);
    const mid = countUpValue(1000, -500, 450, 900);
    expect(mid).toBeLessThan(1000);
    expect(mid).toBeGreaterThan(-500);
  });

  it('from 等於 to 時整段都是同一個值', () => {
    expect(countUpValue(700, 700, 300, 900)).toBe(700);
  });
});
