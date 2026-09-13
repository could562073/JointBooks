import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OverviewCard } from './OverviewCard';

/** count-up 直接落終值，數字斷言才有確定性 */
beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

const BASE = {
  totals: { incomeCents: 520_000, expenseCents: 318_450, netCents: 201_550 },
  title: '本月結餘',
  periodLabel: '9/1 ~ 9/30',
  delta: { deltaRatio: 0.12, direction: 'up' as const },
};

describe('OverviewCard', () => {
  it('標題照傳入的寫（本週結餘／本月結餘…），期間跟在後面', () => {
    render(<OverviewCard {...BASE} />);
    expect(screen.getByTestId('overview-card')).toHaveTextContent('本月結餘9/1 ~ 9/30');
  });

  it('顯示期間標籤與三個數字（原型的合計數字只到元，不顯示角分）', () => {
    render(<OverviewCard {...BASE} />);
    expect(screen.getByTestId('overview-period')).toHaveTextContent('9/1 ~ 9/30');
    expect(screen.getByTestId('overview-net')).toHaveTextContent('$2,016');
    expect(screen.getByTestId('overview-income')).toHaveTextContent('$5,200');
    expect(screen.getByTestId('overview-expense')).toHaveTextContent('$3,185');
  });

  it('結餘為負時帶負號，收入支出不帶', () => {
    render(
      <OverviewCard
        {...BASE}
        totals={{ incomeCents: 100, expenseCents: 500, netCents: -400 }}
      />
    );
    expect(screen.getByTestId('overview-net')).toHaveTextContent('-$4');
    expect(screen.getByTestId('overview-expense').textContent).toBe('$5');
  });

  it('有一隻會呼吸的饅頭（MOTION #30）', () => {
    render(<OverviewCard {...BASE} />);
    expect(screen.getByTestId('overview-mantou')).toBeInTheDocument();
  });
});

describe('OverviewCard 的增減 pill', () => {
  it('增加顯示 ▲', () => {
    render(<OverviewCard {...BASE} />);
    const pill = screen.getByTestId('overview-delta');
    expect(pill).toHaveTextContent('▲ 12%');
    expect(pill).toHaveAttribute('data-direction', 'up');
  });

  it('減少顯示 ▼', () => {
    render(<OverviewCard {...BASE} delta={{ deltaRatio: -0.3, direction: 'down' }} />);
    const pill = screen.getByTestId('overview-delta');
    expect(pill).toHaveTextContent('▼ 30%');
    expect(pill).toHaveAttribute('data-direction', 'down');
  });

  it('持平不顯示箭頭', () => {
    render(<OverviewCard {...BASE} delta={{ deltaRatio: 0, direction: 'flat' }} />);
    expect(screen.getByTestId('overview-delta')).toHaveTextContent('持平');
  });
});

describe('OverviewCard 的比例條', () => {
  // 原型改成兩欄各自一條：收入欄固定滿版（裝飾用），支出欄顯示「花掉了收入的幾成」，
  // 不再是舊版「支出佔收支合計」的 expenseShare 公式。
  it('支出條寬度＝支出佔收入的比例', () => {
    render(
      <OverviewCard {...BASE} totals={{ incomeCents: 100_000, expenseCents: 65_000, netCents: 35_000 }} />
    );
    expect(screen.getByTestId('overview-bar-expense')).toHaveStyle({ width: '65.00%' });
  });

  it('支出超過收入時灌滿，不超過 100%', () => {
    render(
      <OverviewCard {...BASE} totals={{ incomeCents: 100, expenseCents: 300, netCents: -200 }} />
    );
    expect(screen.getByTestId('overview-bar-expense')).toHaveStyle({ width: '100.00%' });
  });

  it('沒有任何紀錄時是空軌道，不是一半一半', () => {
    render(<OverviewCard {...BASE} totals={{ incomeCents: 0, expenseCents: 0, netCents: 0 }} />);
    expect(screen.getByTestId('overview-bar-expense')).toHaveStyle({ width: '0.00%' });
  });
});
