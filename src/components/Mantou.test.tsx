import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Mantou, type MantouVariant } from './Mantou';

function parts(variant: MantouVariant, width: number, part: string): HTMLElement[] {
  const { container } = render(<Mantou variant={variant} width={width} />);
  return Array.from(container.querySelectorAll<HTMLElement>(`[data-part="${part}"]`));
}

describe('Mantou', () => {
  it('身體套用規格的饅頭幾何', () => {
    const [body] = parts('full', 64, 'body');
    // 用 style 屬性字串比對：jsdom 的 cssstyle 對這種雙軸圓角語法支援不穩
    expect(body!.getAttribute('style')).toContain('50% 50% 34% 34% / 64% 64% 36% 36%');
  });

  it('寬一定大於高', () => {
    const [body] = parts('full', 64, 'body');
    expect(parseFloat(body!.style.width)).toBeGreaterThan(parseFloat(body!.style.height));
  });

  it('tab 變體沒有嘴也沒有腳', () => {
    const { container } = render(<Mantou variant="tab" width={22} />);
    expect(container.querySelector('[data-part="mouth"]')).toBeNull();
    expect(container.querySelectorAll('[data-part="foot"]')).toHaveLength(0);
  });

  it('full 變體有兩隻腳，畫在本體之前——被本體蓋住，只從底部圓角露出來（原型）', () => {
    const { container } = render(<Mantou variant="full" width={104} />);
    const body = container.querySelector('[data-part="body"]')!;
    const feet = container.querySelectorAll('[data-part="foot"]');
    expect(feet).toHaveLength(2);
    feet.forEach((foot) => {
      expect(foot.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  it('大顆（原型 78、104）才有腮紅與底部內陰影；小顆（原型 38）沒有', () => {
    expect(parts('full', 104, 'blush')).toHaveLength(2);
    expect(parts('full', 104, 'body')[0]!.style.boxShadow).toContain('inset');
    expect(parts('full', 38, 'blush')).toHaveLength(0);
    expect(parts('full', 38, 'body')[0]!.style.boxShadow).toBe('');
  });

  it('登入頁的大饅頭照原型 104×84 的像素', () => {
    const { container } = render(<Mantou variant="full" width={104} />);
    const body = container.querySelector<HTMLElement>('[data-part="body"]')!;
    const eye = container.querySelector<HTMLElement>('[data-part="eye"]')!;
    const mouth = container.querySelector<HTMLElement>('[data-part="mouth"]')!;
    expect(body.style.height).toBe('83px');
    expect([eye.style.width, eye.style.height]).toEqual(['9px', '11px']);
    expect([mouth.style.width, mouth.style.height]).toEqual(['12px', '6px']);
  });

  it('full 的嘴是實心的下半圓', () => {
    const [mouth] = parts('full', 104, 'mouth');
    expect(mouth!.getAttribute('data-shape')).toBe('smile');
    expect(parseFloat(mouth!.style.width)).toBe(parseFloat(mouth!.style.height) * 2);
  });

  it('empty 變體是灰階、平嘴、有腳、沒腮紅（原型「這天還沒有紀錄」58×46）', () => {
    const { container } = render(<Mantou variant="empty" width={58} />);
    const body = container.querySelector<HTMLElement>('[data-part="body"]')!;
    const mouth = container.querySelector<HTMLElement>('[data-part="mouth"]')!;
    // 只能用 tokens.css 的變數，不可用色碼字面量：斷言也要比對變數名稱，不比對色碼。
    expect(body.style.background).toBe('var(--c-muted-body)');
    expect(body.style.height).toBe('46px');
    expect(mouth.getAttribute('data-shape')).toBe('flat');
    expect([mouth.style.width, mouth.style.height]).toEqual(['10px', '2px']);
    expect(container.querySelectorAll('[data-part="foot"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-part="blush"]')).toHaveLength(0);
  });

  it('頁籤饅頭照原型 22×18：眼睛 3×4，沒選中的是半透明暖灰', () => {
    const { container } = render(<Mantou variant="muted" width={22} />);
    const body = container.querySelector<HTMLElement>('[data-part="body"]')!;
    const eye = container.querySelector<HTMLElement>('[data-part="eye"]')!;
    expect(body.style.height).toBe('18px');
    expect(body.style.background).toBe('var(--c-tab-idle-body)');
    expect([eye.style.width, eye.style.height]).toEqual(['3px', '4px']);
  });

  // 嘴和眼睛共用 PALETTE 的 eye 欄位。只能用變數，不可用色碼字面量：斷言比對變數名稱。
  it('嘴／眼共用的顏色欄位套用 token 變數，不是色碼字面量', () => {
    expect(parts('full', 64, 'mouth')[0]!.style.background).toBe('var(--c-face)');
    expect(parts('full', 64, 'eye')[0]!.style.background).toBe('var(--c-face)');
    expect(parts('empty', 64, 'mouth')[0]!.style.background).toBe('var(--c-muted-eye)');
    expect(parts('empty', 64, 'eye')[0]!.style.background).toBe('var(--c-muted-eye)');
  });
});
