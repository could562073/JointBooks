import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { Icon, ICON_KEYS } from './Icon';

afterEach(cleanup);

describe('Icon', () => {
  it('圖示庫剛好 15 個 key', () => {
    expect(ICON_KEYS).toHaveLength(15);
    expect(ICON_KEYS).toContain('house');
    expect(ICON_KEYS).toContain('coin');
  });

  it('每個 key 都解析得到一個 svg 路徑', () => {
    for (const k of ICON_KEYS) {
      const { container, unmount } = render(<Icon name={k} size={24} />);
      const img = container.querySelector('img')!;
      expect(img.getAttribute('alt')).toBe(k);
      expect(img.getAttribute('src')).toMatch(/\.svg/);
      unmount();
    }
  });

  it('給了 box 才畫底色方塊', () => {
    const { container, rerender } = render(<Icon name="house" size={23} />);
    expect(container.querySelector('[data-box]')).toBeNull();

    rerender(<Icon name="house" size={23} box={36} boxRadius={13} tint="#EDE9FA" />);
    const box = container.querySelector('[data-box]') as HTMLElement;
    expect(box).not.toBeNull();
    expect(box.style.width).toBe('36px');
    expect(box.style.borderRadius).toBe('13px');
    // jsdom 的 cssstyle 會把色碼正規化成 rgb()，所以用 style 屬性字串比對比較穩
    expect(box.getAttribute('style')).toMatch(/#EDE9FA|rgb\(237, ?233, ?250\)/i);
  });

  it('沒給 tint 時退回 --c-tint', () => {
    const { container } = render(<Icon name="house" size={23} box={36} />);
    const box = container.querySelector('[data-box]') as HTMLElement;
    expect(box.getAttribute('style')).toContain('var(--c-tint)');
  });
});
