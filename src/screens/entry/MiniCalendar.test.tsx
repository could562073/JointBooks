import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MiniCalendar } from './MiniCalendar';

const BASE = { value: '2026-09-06', onChange: () => {}, onClose: () => {} };

describe('MiniCalendar 的格線', () => {
  it('標題顯示選中日所在的年月', () => {
    render(<MiniCalendar {...BASE} />);
    expect(screen.getByTestId('mini-title')).toHaveTextContent('2026年9月');
  });

  it('格數等於當月天數', () => {
    render(<MiniCalendar {...BASE} />);
    expect(screen.getByTestId('mini-day-30')).toBeInTheDocument();
    expect(screen.queryByTestId('mini-day-31')).not.toBeInTheDocument();
  });

  it('1 號前的空格數跟著星期走', () => {
    // 2026-09-01 是週二，週一起始要空 1 格
    const { container } = render(<MiniCalendar {...BASE} />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
  });

  it('選中日標成 aria-pressed', () => {
    render(<MiniCalendar {...BASE} />);
    expect(screen.getByTestId('mini-day-6')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('mini-day-7')).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('MiniCalendar 的換月', () => {
  it('› 往後一個月，選中日跟著移動', () => {
    const onChange = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(onChange).toHaveBeenCalledWith('2026-10-06');
  });

  it('‹ 往前一個月，跨年正確', () => {
    const onChange = vi.fn();
    render(<MiniCalendar {...BASE} value="2026-01-15" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('上個月'));
    expect(onChange).toHaveBeenCalledWith('2025-12-15');
  });

  it('跳到天數較少的月份時夾到月底', () => {
    const onChange = vi.fn();
    render(<MiniCalendar {...BASE} value="2026-01-31" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(onChange).toHaveBeenCalledWith('2026-02-28');
  });

  it('換月不會收合面板', () => {
    const onClose = vi.fn();
    render(<MiniCalendar {...BASE} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('MiniCalendar 的選日', () => {
  it('選日回報新日期並收合（§5：選日後即收合）', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('mini-day-18'));
    expect(onChange).toHaveBeenCalledWith('2026-09-18');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('MiniCalendar 的兩顆鍵', () => {
  it('「今天」跳到今天並收合', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 12, 0));
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('mini-today'));
    expect(onChange).toHaveBeenCalledWith('2026-09-09');
    expect(onClose).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('「收起」只收合，不動日期', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(<MiniCalendar {...BASE} onChange={onChange} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('mini-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('今天的那一格被標出來', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 9, 12, 0));
    render(<MiniCalendar {...BASE} />);
    expect(screen.getByTestId('mini-day-9')).toHaveAttribute('data-today');
    expect(screen.getByTestId('mini-day-8')).not.toHaveAttribute('data-today');
    vi.useRealTimers();
  });
});
