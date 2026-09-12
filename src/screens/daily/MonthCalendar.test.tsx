import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { DayCell } from '../../domain/aggregate';
import { daysInMonth } from '../../domain/date';
import { CELL_H } from './calendarLayout';
import { MonthCalendar } from './MonthCalendar';

afterEach(() => vi.unstubAllGlobals());

/** 2026 年 9 月：1 號是週二，所以 offset = 1、共 30 天 */
const Y = 2026;
const M = 8;

function cellsOf(overrides: Partial<Record<number, Partial<DayCell>>> = {}): DayCell[] {
  return Array.from({ length: daysInMonth(Y, M) }, (_, i) => {
    const day = i + 1;
    const date = `2026-09-${String(day).padStart(2, '0')}`;
    return { date, day, expenseCents: 0, hasIncome: false, heat: 0, ...overrides[day] };
  });
}

const BASE = {
  year: Y,
  month: M,
  cells: cellsOf(),
  selectedDay: 6,
  todayDate: '2026-09-09',
  onSelectDay: () => {},
};

describe('MonthCalendar 的格線', () => {
  it('星期列有七格，週六週日被標成假日', () => {
    render(<MonthCalendar {...BASE} />);
    const days = screen.getAllByText(/^[一二三四五六日]$/);
    expect(days).toHaveLength(7);
    expect(days.map((n) => n.textContent)).toEqual(['一', '二', '三', '四', '五', '六', '日']);
    // 週一起始，所以第 6、7 格（六、日）才是假日
    expect(days.filter((n) => n.hasAttribute('data-weekend')).map((n) => n.textContent))
      .toEqual(['六', '日']);
  });

  it('日期格數等於當月天數', () => {
    render(<MonthCalendar {...BASE} />);
    expect(screen.getAllByRole('button')).toHaveLength(30);
    expect(screen.getByTestId('cell-1')).toBeInTheDocument();
    expect(screen.getByTestId('cell-30')).toBeInTheDocument();
    expect(screen.queryByTestId('cell-31')).not.toBeInTheDocument();
  });

  it('1 號前的空格用不可聚焦的佔位，不是空按鈕', () => {
    const { container } = render(<MonthCalendar {...BASE} />);
    const grid = container.querySelector('[style*="--cell-h"]')!;
    // 2026-09-01 是週二 → 前面補 1 格
    const pads = grid.querySelectorAll('[aria-hidden="true"]');
    expect(pads).toHaveLength(1);
    expect(pads[0]?.tagName).toBe('SPAN');
  });

  it('換到 2 月時格數與補格都跟著變', () => {
    // 2026-02-01 是週日 → 週一起始下 offset 為 6、當月 28 天
    const { container } = render(
      <MonthCalendar
        {...BASE}
        month={1}
        selectedDay={1}
        cells={Array.from({ length: 28 }, (_, i) => ({
          date: `2026-02-${String(i + 1).padStart(2, '0')}`,
          day: i + 1,
          expenseCents: 0,
          hasIncome: false,
          heat: 0,
        }))}
      />
    );
    expect(screen.getAllByRole('button')).toHaveLength(28);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(6);
  });
});

describe('MonthCalendar 的格內資訊', () => {
  it('有支出時顯示精簡金額，沒有就完全不顯示', () => {
    render(<MonthCalendar {...BASE} cells={cellsOf({ 6: { expenseCents: 4_250 } })} />);
    expect(screen.getByTestId('cell-6')).toHaveTextContent('$43');
    // 0 元的格子只剩日期數字
    expect(screen.getByTestId('cell-7').textContent).toBe('7');
  });

  it('有收入的那天才有收入記號', () => {
    render(<MonthCalendar {...BASE} cells={cellsOf({ 10: { hasIncome: true } })} />);
    expect(screen.getByTestId('income-10')).toBeInTheDocument();
    expect(screen.queryByTestId('income-11')).not.toBeInTheDocument();
  });

  it('熱度越高底色越濃', () => {
    render(<MonthCalendar {...BASE} cells={cellsOf({ 3: { heat: 0 }, 4: { heat: 1 } })} />);
    expect(screen.getByTestId('cell-3')).toHaveStyle({ background: 'rgba(183,166,229,0.14)' });
    expect(screen.getByTestId('cell-4')).toHaveStyle({ background: 'rgba(183,166,229,0.58)' });
  });

  it('今天的格子有標記，其他天沒有', () => {
    render(<MonthCalendar {...BASE} />);
    expect(screen.getByTestId('cell-9')).toHaveAttribute('data-today');
    expect(screen.getByTestId('cell-8')).not.toHaveAttribute('data-today');
  });

  it('今天不在本月時沒有任何格子被標成今天', () => {
    const { container } = render(<MonthCalendar {...BASE} todayDate="2026-10-02" />);
    expect(container.querySelectorAll('[data-today]')).toHaveLength(0);
  });
});

describe('MonthCalendar 的選取', () => {
  it('只有選中的那天 aria-pressed 為 true', () => {
    render(<MonthCalendar {...BASE} selectedDay={6} />);
    expect(screen.getByTestId('cell-6')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('cell-5')).toHaveAttribute('aria-pressed', 'false');
  });

  it('點格子把日期回報出去', () => {
    const onSelectDay = vi.fn();
    render(<MonthCalendar {...BASE} onSelectDay={onSelectDay} />);
    fireEvent.click(screen.getByTestId('cell-18'));
    expect(onSelectDay).toHaveBeenCalledWith(18);
  });

  it('滑塊落在選中日的欄與列上（MOTION #6）', () => {
    // offset=1：6 號的 index 是 6 → col 6、row 0
    const { rerender } = render(<MonthCalendar {...BASE} selectedDay={6} />);
    const slider = screen.getByTestId('calendar-slider');
    expect(slider).toHaveStyle({ left: `${((6 * 100) / 7).toFixed(4)}%`, top: '0px' });

    // 8 號的 index 是 8 → col 1、row 1
    rerender(<MonthCalendar {...BASE} selectedDay={8} />);
    expect(slider).toHaveStyle({ left: `${((1 * 100) / 7).toFixed(4)}%`, top: `${CELL_H}px` });
  });

  it('reduced motion 下滑塊不做位移過場', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: q.includes('prefers-reduced-motion'),
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }));
    render(<MonthCalendar {...BASE} />);
    expect(screen.getByTestId('calendar-slider').style.transition).toBe('none');
  });
});

describe('MonthCalendar 的週起始（§15.1-3）', () => {
  it('週日起始時星期列從日開始，週末字換到頭尾兩欄', () => {
    render(<MonthCalendar {...BASE} weekStart="sun" />);
    const labels = screen.getAllByText(/^[一二三四五六日]$/);
    expect(labels.map((n) => n.textContent)).toEqual(['日', '一', '二', '三', '四', '五', '六']);
    expect(labels.filter((n) => n.hasAttribute('data-weekend')).map((n) => n.textContent))
      .toEqual(['日', '六']);
  });

  it('首格空白數跟著位移，不只是星期列換字', () => {
    // 2026-09-01 是週二
    const { container, rerender } = render(<MonthCalendar {...BASE} weekStart="mon" />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(1);
    rerender(<MonthCalendar {...BASE} weekStart="sun" />);
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
  });
});
