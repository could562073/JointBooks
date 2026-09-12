import { describe, it, expect } from 'vitest';
import { avatarColor, riseDelay, txnTime } from './txnRow';

describe('txnTime', () => {
  it('取本地時間的時:分，個位數補零', () => {
    expect(txnTime(new Date(2026, 8, 6, 9, 5).toISOString())).toBe('09:05');
    expect(txnTime(new Date(2026, 8, 6, 21, 40).toISOString())).toBe('21:40');
  });

  it('午夜顯示 00:00 而不是 24:00 或空白', () => {
    expect(txnTime(new Date(2026, 8, 6, 0, 0).toISOString())).toBe('00:00');
  });

  it('壞掉的時戳回空字串，不要讓整列炸掉', () => {
    expect(txnTime('not-a-date')).toBe('');
  });
});

describe('avatarColor', () => {
  it('兩個人各有固定顏色', () => {
    expect(avatarColor('我')).toBe('#B7A6E5');
    expect(avatarColor('妻')).toBe('#DDA6D0');
  });
});

describe('riseDelay（MOTION #5 的逐張延遲）', () => {
  it('前八張逐張遞增', () => {
    expect(riseDelay(0, 35)).toBe(0);
    expect(riseDelay(1, 35)).toBe(35);
    expect(riseDelay(7, 35)).toBe(245);
  });

  it('第 8 張之後不再遞增，避免最後一張等到像卡住', () => {
    expect(riseDelay(8, 35)).toBe(245);
    expect(riseDelay(30, 35)).toBe(245);
  });
});
