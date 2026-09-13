import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TAB_SLIDER_WIDTH, TabBar, TABS, tabDirection, tabIndex, tabSliderLeft } from './TabBar';

function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

beforeEach(() => stubMotion(false));
afterEach(() => vi.unstubAllGlobals());

describe('tabSliderLeft', () => {
  // 列有 5px 內距、頁籤間 6px 間距，只用 33.33% 的倍數會讓第二、三格偏掉幾個 px
  it('三等寬，並算進 5px 內距與頁籤之間的 6px 間距', () => {
    expect(tabSliderLeft(0)).toBe('calc(0% + 5px)');
    expect(tabSliderLeft(1)).toBe('calc(33.3333% + 3.66667px)');
    expect(tabSliderLeft(2)).toBe('calc(66.6667% + 2.33333px)');
  });

  it('滑塊寬度扣掉兩側內距與兩道間距後平分', () => {
    expect(TAB_SLIDER_WIDTH).toBe('calc(33.3333% - 7.33333px)');
  });
});

describe('TabBar', () => {
  it('三個頁籤，順序是日常、統計、配置', () => {
    render(<TabBar tab="daily" onChange={() => {}} />);
    expect(TABS.map((t) => t.key)).toEqual(['daily', 'stats', 'settings']);
    expect(screen.getByTestId('tab-daily')).toHaveTextContent('日常');
    expect(screen.getByTestId('tab-stats')).toHaveTextContent('統計');
    expect(screen.getByTestId('tab-settings')).toHaveTextContent('配置');
  });

  it('選中的頁籤標成 aria-current', () => {
    render(<TabBar tab="stats" onChange={() => {}} />);
    expect(screen.getByTestId('tab-stats')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('tab-daily')).not.toHaveAttribute('aria-current');
  });

  it('滑塊位移到選中的那一格，而不是每格自己變底色', () => {
    const { rerender } = render(<TabBar tab="daily" onChange={() => {}} />);
    expect(screen.getByTestId('tab-slider').style.left).toBe(tabSliderLeft(0));
    rerender(<TabBar tab="settings" onChange={() => {}} />);
    expect(screen.getByTestId('tab-slider').style.left).toBe(tabSliderLeft(2));
  });

  it('點頁籤回報要切到哪一頁', () => {
    const onChange = vi.fn();
    render(<TabBar tab="daily" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('tab-settings'));
    expect(onChange).toHaveBeenCalledWith('settings');
  });

  it('沒選中的饅頭是灰的，選中的是紫的（原型）', () => {
    const { container } = render(<TabBar tab="stats" onChange={() => {}} />);
    const body = (id: string) =>
      screen.getByTestId(id).querySelector('[data-part="body"]') as HTMLElement;
    expect(body('tab-stats').style.background).toBe('var(--c-primary)');
    expect(body('tab-daily').style.background).toBe('var(--c-muted-body)');
    expect(container.querySelectorAll('[data-part="body"]')).toHaveLength(3);
  });

  it('頁籤饅頭沒有嘴也沒有腳', () => {
    const { container } = render(<TabBar tab="daily" onChange={() => {}} />);
    expect(container.querySelectorAll('[data-part="mouth"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-part="foot"]')).toHaveLength(0);
  });

  it('reduced-motion 時滑塊不做位移動畫', () => {
    stubMotion(true);
    render(<TabBar tab="daily" onChange={() => {}} />);
    expect(screen.getByTestId('tab-slider')).toHaveStyle({ transition: 'none' });
  });
});

describe('tabDirection（MOTION #8 的進場方向）', () => {
  it('往後（日常→統計→配置）是 1', () => {
    expect(tabDirection('daily', 'stats')).toBe(1);
    expect(tabDirection('stats', 'settings')).toBe(1);
    expect(tabDirection('daily', 'settings')).toBe(1);
  });

  it('往前是 -1', () => {
    expect(tabDirection('settings', 'daily')).toBe(-1);
    expect(tabDirection('stats', 'daily')).toBe(-1);
  });

  it('停在原地給定值 1', () => {
    expect(tabDirection('daily', 'daily')).toBe(1);
  });
});

describe('tabIndex', () => {
  it('照分頁列的順序', () => {
    expect(tabIndex('daily')).toBe(0);
    expect(tabIndex('stats')).toBe(1);
    expect(tabIndex('settings')).toBe(2);
  });
});

describe('TabBar 的饅頭壓扁（MOTION #10）', () => {
  it('只有選中的那一隻掛動畫，其他不動', () => {
    render(<TabBar tab="stats" onChange={() => {}} />);
    expect(screen.getAllByTestId('tab-mantou-active')).toHaveLength(1);
    expect(screen.getByTestId('tab-stats')).toContainElement(
      screen.getByTestId('tab-mantou-active')
    );
  });

  it('換頁時重掛，動畫才會重播', () => {
    const { rerender } = render(<TabBar tab="daily" onChange={() => {}} />);
    const before = screen.getByTestId('tab-mantou-active');
    rerender(<TabBar tab="settings" onChange={() => {}} />);
    expect(screen.getByTestId('tab-mantou-active')).not.toBe(before);
  });

  it('reduced-motion 時不掛壓扁動畫', () => {
    stubMotion(true);
    render(<TabBar tab="daily" onChange={() => {}} />);
    expect(screen.getByTestId('tab-mantou-active').className).toBe('');
  });
});
