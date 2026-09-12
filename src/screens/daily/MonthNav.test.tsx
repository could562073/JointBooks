import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonthNav } from './MonthNav';
import { monthLabel } from './labels';

const noop = () => {};

function renderNav(over: Partial<Parameters<typeof MonthNav>[0]> = {}) {
  const props = {
    year: 2026, month: 8, pickerOpen: false,
    onPrev: noop, onNext: noop, onTogglePicker: noop,
    ...over,
  };
  return { ...render(<MonthNav {...props} />), props };
}

describe('monthLabel', () => {
  it('月份是 0-based，9 月要顯示成 9 月而不是 8 月', () => {
    expect(monthLabel(2026, 8)).toEqual({ zh: '2026年9月', en: 'September 2026' });
  });

  it('兩端的月份都對', () => {
    expect(monthLabel(2026, 0).zh).toBe('2026年1月');
    expect(monthLabel(2026, 0).en).toBe('January 2026');
    expect(monthLabel(2026, 11).zh).toBe('2026年12月');
    expect(monthLabel(2026, 11).en).toBe('December 2026');
  });
});

describe('MonthNav', () => {
  it('同時顯示中文與英文標題', () => {
    renderNav();
    expect(screen.getByTestId('month-title')).toHaveTextContent('2026年9月');
    expect(screen.getByTestId('month-title')).toHaveTextContent('September 2026');
  });

  it('兩顆箭頭各自呼叫自己的 callback，而且不會呼叫到對方', () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    renderNav({ onPrev, onNext });

    screen.getByLabelText('上個月').click();
    expect(onPrev).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();

    screen.getByLabelText('下個月').click();
    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('點標題會開年月選擇器', () => {
    const onTogglePicker = vi.fn();
    renderNav({ onTogglePicker });
    screen.getByTestId('month-title').click();
    expect(onTogglePicker).toHaveBeenCalledTimes(1);
  });

  // MOTION #33 指定的是「▾ 轉 180°」，不是換成 ▴——同一個字元轉過去才動得起來
  it('選擇器展開時 ▾ 轉 180°，收合時轉回來', () => {
    const { unmount } = renderNav({ pickerOpen: false });
    expect(screen.getByTestId('month-chevron')).toHaveStyle({ transform: 'none' });
    unmount();

    renderNav({ pickerOpen: true });
    expect(screen.getByTestId('month-chevron')).toHaveStyle({ transform: 'rotate(180deg)' });
  });

  it('aria-expanded 跟著選擇器狀態', () => {
    const { unmount } = renderNav({ pickerOpen: false });
    expect(screen.getByTestId('month-title')).toHaveAttribute('aria-expanded', 'false');
    unmount();

    renderNav({ pickerOpen: true });
    expect(screen.getByTestId('month-title')).toHaveAttribute('aria-expanded', 'true');
  });
});
