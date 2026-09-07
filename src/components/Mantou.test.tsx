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
});
