import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TabBar, TABS, tabSliderLeft } from './TabBar';

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
  it('三等寬，滑塊落在三分之一的倍數上', () => {
    expect(tabSliderLeft(0)).toBe('0.0000%');
    expect(tabSliderLeft(1)).toBe('33.3333%');
    expect(tabSliderLeft(2)).toBe('66.6667%');
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
    expect(screen.getByTestId('tab-slider')).toHaveStyle({ left: '0.0000%' });
    rerender(<TabBar tab="settings" onChange={() => {}} />);
    expect(screen.getByTestId('tab-slider')).toHaveStyle({ left: '66.6667%' });
  });

  it('點頁籤回報要切到哪一頁', () => {
    const onChange = vi.fn();
    render(<TabBar tab="daily" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('tab-settings'));
    expect(onChange).toHaveBeenCalledWith('settings');
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
