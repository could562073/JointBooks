import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Mantou } from './Mantou';

describe('Mantou', () => {
  it('身體套用規格的饅頭幾何', () => {
    const { container } = render(<Mantou variant="full" width={64} />);
    const body = container.querySelector('[data-part="body"]') as HTMLElement;
    // 用 style 屬性字串比對：jsdom 的 cssstyle 對這種雙軸圓角語法支援不穩
    expect(body.getAttribute('style'))
      .toContain('50% 50% 34% 34% / 64% 64% 36% 36%');
  });

  it('寬一定大於高', () => {
    const { container } = render(<Mantou variant="full" width={64} />);
    const body = container.querySelector('[data-part="body"]') as HTMLElement;
    expect(parseFloat(body.style.width)).toBeGreaterThan(parseFloat(body.style.height));
  });

  it('tab 變體沒有嘴也沒有腳', () => {
    const { container } = render(<Mantou variant="tab" width={22} />);
    expect(container.querySelector('[data-part="mouth"]')).toBeNull();
    expect(container.querySelectorAll('[data-part="foot"]')).toHaveLength(0);
  });

  it('full 變體有兩隻腳', () => {
    const { container } = render(<Mantou variant="full" width={64} />);
    expect(container.querySelectorAll('[data-part="foot"]')).toHaveLength(2);
  });

  it('empty 變體是灰階、嘴向上、無腳', () => {
    const { container } = render(<Mantou variant="empty" width={64} />);
    const body = container.querySelector('[data-part="body"]') as HTMLElement;
    expect(body.getAttribute('style')).toMatch(/#DEDCE6|rgb\(222, ?220, ?230\)/i);
    expect(container.querySelector('[data-part="mouth"]')?.getAttribute('data-dir')).toBe('up');
    expect(container.querySelectorAll('[data-part="foot"]')).toHaveLength(0);
  });

  // 嘴的方向不是靠 data-dir 這種標記決定的，而是靠「弧線往哪邊彎」＋「畫在哪一條邊上」。
  // 這裡直接斷言那兩件事本身，data-dir 只是附帶檢查。
  //
  // border-width 用 longhand 讀而不是比對 style 字串：jsdom 會把
  // `1.5px 1.5px 0 1.5px` 收合序列化成 `1.5px 1.5px 0px`（左右相同時省略第四值），
  // 比對原始寫法的字串會失敗。longhand 不受序列化影響，語意也更清楚。
  it('嘴的方向：empty 向上（畫上緣）、full 向下（畫下緣）', () => {
    const mouthOf = (variant: 'empty' | 'full') => {
      const { container } = render(<Mantou variant={variant} width={64} />);
      return container.querySelector('[data-part="mouth"]') as HTMLElement;
    };

    const up = mouthOf('empty');
    expect(up.style.borderRadius).toBe('100% 100% 0 0 / 100% 100% 0 0');
    expect(up.style.borderTopWidth).toBe('1.5px');
    expect(up.style.borderBottomWidth).toBe('0px');
    expect(up.getAttribute('data-dir')).toBe('up');

    const down = mouthOf('full');
    expect(down.style.borderRadius).toBe('0 0 100% 100% / 0 0 100% 100%');
    expect(down.style.borderTopWidth).toBe('0px');
    expect(down.style.borderBottomWidth).toBe('1.5px');
    expect(down.getAttribute('data-dir')).toBe('down');
  });
});
