import { describe, it, expect } from 'vitest';
import { PALETTE, colorSetOf } from './palette';

describe('六組紫色系配色', () => {
  it('剛好六組', () => {
    expect(PALETTE).toHaveLength(6);
  });

  it('數值逐字符合原型', () => {
    expect(PALETTE[0]).toEqual({ color: '#5E4FA0', tint: '#EDE9FA', blob: '#B7A6E5', spike: '#CDC0F0' });
    expect(PALETTE[1]).toEqual({ color: '#8A4F9E', tint: '#F4E9FA', blob: '#CFA3E0', spike: '#E2C0EE' });
    expect(PALETTE[2]).toEqual({ color: '#4F52A0', tint: '#E9EAFA', blob: '#A7A9E5', spike: '#C0C2F0' });
    expect(PALETTE[3]).toEqual({ color: '#9E4F87', tint: '#FAE9F3', blob: '#DDA6D0', spike: '#EDC2E2' });
    expect(PALETTE[4]).toEqual({ color: '#6B4FA0', tint: '#EFE9FA', blob: '#BFA3E5', spike: '#D4C0F0' });
    expect(PALETTE[5]).toEqual({ color: '#5A5AA8', tint: '#EAEAF8', blob: '#ADADE0', spike: '#C6C6EE' });
  });

  it('§11-5：新增分類的配色依序循環', () => {
    expect(colorSetOf(0)).toEqual(PALETTE[0]);
    expect(colorSetOf(5)).toEqual(PALETTE[5]);
    expect(colorSetOf(6)).toEqual(PALETTE[0]);   // 繞回來
    expect(colorSetOf(13)).toEqual(PALETTE[1]);
  });

  it('每組的 tint 都比 color 淺（淡底配深字，§11-10）', () => {
    const lum = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16 & 255) * 299 + (n >> 8 & 255) * 587 + (n & 255) * 114) / 1000;
    };
    for (const p of PALETTE) expect(lum(p.tint)).toBeGreaterThan(lum(p.color));
  });
});
