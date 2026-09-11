import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MonthPicker } from './MonthPicker';

const BASE = { year: 2026, month: 8, onPick: () => {}, onClose: () => {} };

function years() {
  return Array.from(screen.getByTestId('year-pills').children).map((n) => n.textContent);
}

describe('MonthPicker 的年份列', () => {
  it('四個年份 pill，錨點年排第三格', () => {
    render(<MonthPicker {...BASE} />);
    expect(years()).toEqual(['2024年', '2025年', '2026年', '2027年']);
  });

  it('錨點年標成選中', () => {
    render(<MonthPicker {...BASE} />);
    expect(screen.getByRole('button', { name: '2026年' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '2025年' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('› 往後翻一年，四格一起位移', () => {
    render(<MonthPicker {...BASE} />);
    fireEvent.click(screen.getByLabelText('後一年'));
    expect(years()).toEqual(['2025年', '2026年', '2027年', '2028年']);
  });

  it('‹ 往前翻一年', () => {
    render(<MonthPicker {...BASE} />);
    fireEvent.click(screen.getByLabelText('前一年'));
    expect(years()).toEqual(['2023年', '2024年', '2025年', '2026年']);
  });

  it('翻年的方向記在 data-dir 上，給 MOTION #34 用', () => {
    render(<MonthPicker {...BASE} />);
    fireEvent.click(screen.getByLabelText('後一年'));
    expect(screen.getByTestId('year-pills')).toHaveAttribute('data-dir', '1');
    fireEvent.click(screen.getByLabelText('前一年'));
    expect(screen.getByTestId('year-pills')).toHaveAttribute('data-dir', '-1');
  });

  it('直接點某個年份 pill 也能換錨點，但不翻頁', () => {
    render(<MonthPicker {...BASE} />);
    fireEvent.click(screen.getByRole('button', { name: '2024年' }));
    // 錨點變 2024，整排跟著重算
    expect(years()).toEqual(['2022年', '2023年', '2024年', '2025年']);
  });
});

describe('MonthPicker 的月方格', () => {
  it('12 格', () => {
    render(<MonthPicker {...BASE} />);
    expect(screen.getByTestId('picker-month-0')).toHaveTextContent('1月');
    expect(screen.getByTestId('picker-month-11')).toHaveTextContent('12月');
  });

  it('目前在看的月份標成選中', () => {
    render(<MonthPicker {...BASE} />);
    expect(screen.getByTestId('picker-month-8')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('picker-month-7')).toHaveAttribute('aria-pressed', 'false');
  });

  it('翻到別的年份後整排都不標選中', () => {
    render(<MonthPicker {...BASE} />);
    fireEvent.click(screen.getByLabelText('後一年'));
    expect(screen.getByTestId('picker-month-8')).toHaveAttribute('aria-pressed', 'false');
  });

  it('選月份時回報錨點年、月與滑入方向', () => {
    const onPick = vi.fn();
    render(<MonthPicker {...BASE} onPick={onPick} />);
    fireEvent.click(screen.getByTestId('picker-month-11'));
    expect(onPick).toHaveBeenCalledWith(2026, 11, 1);
  });

  it('翻年後選月份，帶的是翻過去的那一年', () => {
    const onPick = vi.fn();
    render(<MonthPicker {...BASE} onPick={onPick} />);
    fireEvent.click(screen.getByLabelText('前一年'));
    fireEvent.click(screen.getByTestId('picker-month-0'));
    // 2026年9月 → 2025年1月 是往回
    expect(onPick).toHaveBeenCalledWith(2025, 0, -1);
  });
});

describe('MonthPicker 的收起', () => {
  it('點「收起」回報關閉', () => {
    const onClose = vi.fn();
    render(<MonthPicker {...BASE} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('picker-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
