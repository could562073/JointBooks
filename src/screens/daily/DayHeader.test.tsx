import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DayHeader } from './DayHeader';
import { dayTitle } from './labels';

/** 讓 count-up 直接落在終值，數字斷言才有確定性 */
beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('dayTitle', () => {
  it('組成「9月6日 · 週日」', () => {
    // 2026-09-06 是週日
    expect(dayTitle(2026, 8, 6)).toBe('9月6日 · 週日');
  });

  it('星期跟著日期走', () => {
    expect(dayTitle(2026, 8, 7)).toBe('9月7日 · 週一');
    expect(dayTitle(2026, 8, 12)).toBe('9月12日 · 週六');
  });

  it('1 月是 1月不是 0月', () => {
    expect(dayTitle(2026, 0, 1)).toMatch(/^1月1日 · /);
  });
});

describe('DayHeader', () => {
  const BASE = { year: 2026, month: 8, day: 6, expenseCents: 12_345 };

  it('顯示日期標題與當日支出，金額帶負號', () => {
    render(<DayHeader {...BASE} />);
    expect(screen.getByTestId('day-header')).toHaveTextContent('9月6日 · 週日');
    expect(screen.getByTestId('day-total')).toHaveTextContent('-$123.45');
  });

  it('這天沒有支出時顯示破折號而不是 $0.00', () => {
    render(<DayHeader {...BASE} expenseCents={0} />);
    expect(screen.getByTestId('day-total').textContent).toBe('—');
  });
});
