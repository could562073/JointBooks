import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import type { TrendPoint } from '../../domain/aggregate';
import { TrendChart } from './TrendChart';

afterEach(() => vi.unstubAllGlobals());

function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
}

function pts(...rows: [string, number, number][]): TrendPoint[] {
  return rows.map(([label, expenseCents, incomeCents]) => ({ label, expenseCents, incomeCents }));
}

const THREE = pts(['W36', 1_000, 0], ['W37', 3_000, 5_000], ['W38', 2_000, 0]);

describe('TrendChart', () => {
  it('標出目前這一期：最後一個軸標籤加重並多一行「本週」，還有一條縱向導引線', () => {
    render(<TrendChart points={THREE} drawKey="week" currentLabel="本週" />);
    const axis = screen.getByTestId('trend-axis');
    expect(axis.lastElementChild).toHaveTextContent('W38本週');
    expect(axis.lastElementChild).toHaveAttribute('data-current');
    expect(axis.firstElementChild).not.toHaveAttribute('data-current');
    expect(screen.getByTestId('trend-current-guide')).toBeInTheDocument();
  });

  it('沒給目前這一期的標籤就不標', () => {
    render(<TrendChart points={THREE} drawKey="week" />);
    expect(screen.queryByTestId('trend-current-guide')).not.toBeInTheDocument();
    expect(screen.getByTestId('trend-axis').lastElementChild).not.toHaveAttribute('data-current');
  });

  it('畫出支出實線、收入虛線與支出面積', () => {
    render(<TrendChart points={THREE} drawKey="month" />);
    expect(screen.getByTestId('trend-expense')).toBeInTheDocument();
    expect(screen.getByTestId('trend-income')).toBeInTheDocument();
    expect(screen.getByTestId('trend-area')).toBeInTheDocument();
  });

  it('最後一點加大', () => {
    render(<TrendChart points={THREE} drawKey="month" />);
    expect(screen.getByTestId('trend-last')).toBeInTheDocument();
  });

  it('X 軸標籤照資料點', () => {
    render(<TrendChart points={THREE} drawKey="month" />);
    expect(screen.getByTestId('trend-axis')).toHaveTextContent('W36');
    expect(screen.getByTestId('trend-axis')).toHaveTextContent('W38');
  });

  it('有無障礙名稱', () => {
    render(<TrendChart points={THREE} drawKey="month" />);
    expect(screen.getByRole('img')).toHaveAccessibleName('收支趨勢');
  });
});

describe('TrendChart 的邊界情況', () => {
  it('沒有資料點時不畫線，也不會炸掉', () => {
    render(<TrendChart points={[]} drawKey="month" />);
    expect(screen.queryByTestId('trend-expense')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trend-last')).not.toBeInTheDocument();
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
  });

  it('只有一個資料點時不畫線，但仍標出那一點', () => {
    render(<TrendChart points={pts(['W36', 1_000, 0])} drawKey="month" />);
    expect(screen.queryByTestId('trend-expense')).not.toBeInTheDocument();
    expect(screen.getByTestId('trend-last')).toBeInTheDocument();
  });

  it('整個期間都是 0 時線是平的，不會出現 NaN 座標', () => {
    render(<TrendChart points={pts(['a', 0, 0], ['b', 0, 0])} drawKey="month" />);
    const points = screen.getByTestId('trend-expense').getAttribute('points')!;
    expect(points).not.toMatch(/NaN/);
  });
});

describe('TrendChart 的描線（MOTION #11）', () => {
  it('一般情況下掛描線動畫，dasharray 等於整條線長', () => {
    stubMotion(false);
    render(<TrendChart points={THREE} drawKey="month" />);
    const line = screen.getByTestId('trend-expense');
    expect(line.getAttribute('class')!.split(' ')).toHaveLength(2);
    expect(Number(line.getAttribute('style')?.match(/stroke-dasharray:\s*([\d.]+)/)?.[1]))
      .toBeGreaterThan(0);
  });

  it('reduced-motion 時不描線', () => {
    stubMotion(true);
    render(<TrendChart points={THREE} drawKey="month" />);
    expect(screen.getByTestId('trend-expense').getAttribute('class')!.split(' ')).toHaveLength(1);
  });

  it('換維度時重掛，描線才會重播', () => {
    stubMotion(false);
    const { rerender } = render(<TrendChart points={THREE} drawKey="month" />);
    const before = screen.getByTestId('trend-expense');
    rerender(<TrendChart points={THREE} drawKey="year" />);
    expect(screen.getByTestId('trend-expense')).not.toBe(before);
  });
});
