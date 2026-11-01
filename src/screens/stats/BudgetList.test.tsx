import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { BudgetRow } from '../../domain/aggregate';
import { BudgetList } from './BudgetList';

afterEach(() => vi.unstubAllGlobals());

function row(over: Partial<BudgetRow> = {}): BudgetRow {
  return {
    categoryId: 'c1', name: '外食', icon: 'cup', colorSet: 0,
    spentCents: 20_000, budgetCents: 45_000, ratio: 20_000 / 45_000,
    state: 'normal', overCents: 0,
    ...over,
  };
}

describe('BudgetList', () => {
  it('每個分類一條，顯示「已花 / 預算」（原型的合計數字只到元）', () => {
    render(<BudgetList rows={[row()]} fillKey="month" />);
    expect(screen.getByTestId('budget-c1-numbers')).toHaveTextContent('$200 / $450');
  });

  it('沒超支時顯示還可以花多少', () => {
    render(<BudgetList rows={[row()]} fillKey="month" />);
    expect(screen.getByText('還可以花 $250')).toBeInTheDocument();
  });

  it('沒有設預算的分類時顯示空狀態', () => {
    render(<BudgetList rows={[]} fillKey="month" />);
    expect(screen.getByTestId('budget-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('budget-list')).not.toBeInTheDocument();
  });

  it('條寬照使用比例', () => {
    render(<BudgetList rows={[row({ ratio: 0.5 })]} fillKey="month" />);
    expect(screen.getByTestId('budget-c1-bar')).toHaveStyle({ width: '50%' });
  });
});

describe('BudgetList 的三種狀態（§6）', () => {
  it('一般狀態用分類色', () => {
    render(<BudgetList rows={[row()]} fillKey="month" />);
    const bar = screen.getByTestId('budget-c1-bar');
    expect(bar).toHaveAttribute('data-state', 'normal');
    // 不是那兩個警示色
    expect(bar).not.toHaveStyle({ background: '#F6D89A' });
    expect(bar).not.toHaveStyle({ background: '#F2B3A0' });
  });

  it('>85% 轉黃', () => {
    render(<BudgetList rows={[row({ state: 'warn', ratio: 0.9 })]} fillKey="month" />);
    expect(screen.getByTestId('budget-c1-bar')).toHaveStyle({ background: '#F6D89A' });
  });

  it('超支轉橘並顯示超支金額', () => {
    render(
      <BudgetList
        rows={[row({ state: 'over', ratio: 1.3, spentCents: 58_500, overCents: 13_500 })]}
        fillKey="month"
      />
    );
    expect(screen.getByTestId('budget-c1-bar')).toHaveStyle({ background: '#F2B3A0' });
    expect(screen.getByTestId('budget-c1-over')).toHaveTextContent('超支 $135');
  });

  it('超支時條滿格，不會畫出軌道外', () => {
    render(<BudgetList rows={[row({ state: 'over', ratio: 2.4, overCents: 1 })]} fillKey="month" />);
    expect(screen.getByTestId('budget-c1-bar')).toHaveStyle({ width: '100%' });
  });

  it('沒超支時不顯示超支文字', () => {
    render(<BudgetList rows={[row()]} fillKey="month" />);
    expect(screen.queryByTestId('budget-c1-over')).not.toBeInTheDocument();
  });
});
