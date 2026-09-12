import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { BudgetRow } from '../../domain/aggregate';
import { BudgetList } from './BudgetList';

afterEach(() => vi.unstubAllGlobals());

function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
}

function row(over: Partial<BudgetRow> = {}): BudgetRow {
  return {
    categoryId: 'c1', name: '外食', icon: 'cup', colorSet: 0,
    spentCents: 20_000, budgetCents: 45_000, ratio: 20_000 / 45_000,
    state: 'normal', overCents: 0,
    ...over,
  };
}

describe('BudgetList', () => {
  it('每個分類一條，顯示「已花 / 預算」', () => {
    render(<BudgetList rows={[row()]} fillKey="month" />);
    expect(screen.getByTestId('budget-c1-numbers')).toHaveTextContent('$200.00 / $450.00');
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
    expect(bar).not.toHaveStyle({ background: '#F2C97A' });
    expect(bar).not.toHaveStyle({ background: '#E08A72' });
  });

  it('>85% 轉黃', () => {
    render(<BudgetList rows={[row({ state: 'warn', ratio: 0.9 })]} fillKey="month" />);
    expect(screen.getByTestId('budget-c1-bar')).toHaveStyle({ background: '#F2C97A' });
  });

  it('超支轉橘並顯示超支金額', () => {
    render(
      <BudgetList
        rows={[row({ state: 'over', ratio: 1.3, spentCents: 58_500, overCents: 13_500 })]}
        fillKey="month"
      />
    );
    expect(screen.getByTestId('budget-c1-bar')).toHaveStyle({ background: '#E08A72' });
    expect(screen.getByTestId('budget-c1-over')).toHaveTextContent('超支 $135.00');
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

describe('BudgetList 的填充動畫（MOTION #12）', () => {
  it('每條延遲 50ms 遞增', () => {
    stubMotion(false);
    render(
      <BudgetList
        rows={[row(), row({ categoryId: 'c2' }), row({ categoryId: 'c3' })]}
        fillKey="month"
      />
    );
    expect(screen.getByTestId('budget-c1-bar')).toHaveStyle({ '--delay': '0ms' });
    expect(screen.getByTestId('budget-c2-bar')).toHaveStyle({ '--delay': '50ms' });
    expect(screen.getByTestId('budget-c3-bar')).toHaveStyle({ '--delay': '100ms' });
  });

  it('換維度時重掛，填充才會重播', () => {
    stubMotion(false);
    const { rerender } = render(<BudgetList rows={[row()]} fillKey="month" />);
    const before = screen.getByTestId('budget-c1-bar');
    rerender(<BudgetList rows={[row()]} fillKey="year" />);
    expect(screen.getByTestId('budget-c1-bar')).not.toBe(before);
  });

  it('reduced-motion 時不掛填充動畫', () => {
    stubMotion(true);
    render(<BudgetList rows={[row()]} fillKey="month" />);
    expect(screen.getByTestId('budget-c1-bar').className.split(' ')).toHaveLength(1);
  });
});
