import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SummaryCards } from './SummaryCards';

/** 讓 count-up 直接落在終值上，數字斷言才有確定性（§10 通則的 reduced-motion 路徑） */
function stubReducedMotion() {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => vi.unstubAllGlobals());

const PROPS = {
  incomeCents: 520_000,
  expenseCents: 318_450,
  netCents: 201_550,
  periodLabel: '9月1日 – 9月30日',
};

describe('SummaryCards', () => {
  beforeEach(stubReducedMotion);

  it('三張卡都在', () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.getByTestId('card-income')).toBeInTheDocument();
    expect(screen.getByTestId('card-expense')).toBeInTheDocument();
    expect(screen.getByTestId('card-net')).toBeInTheDocument();
  });

  it('收入與支出顯示不帶正負號的金額', () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.getByTestId('card-income')).toHaveTextContent('$5,200.00');
    expect(screen.getByTestId('card-expense')).toHaveTextContent('$3,184.50');
    expect(screen.getByTestId('card-expense')).not.toHaveTextContent('-$3,184.50');
  });

  it('結餘為負時帶負號', () => {
    render(<SummaryCards {...PROPS} netCents={-45_000} />);
    expect(screen.getByTestId('card-net')).toHaveTextContent('-$450.00');
  });

  it('結餘卡顯示結算期間副標', () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.getByTestId('card-net')).toHaveTextContent('9月1日 – 9月30日');
  });

  it('金額為 0 時顯示 $0.00 而不是空白', () => {
    render(<SummaryCards {...PROPS} incomeCents={0} />);
    expect(screen.getByTestId('card-income')).toHaveTextContent('$0.00');
  });
});

describe('SummaryCards 的 count-up（MOTION #31）', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, addEventListener() {}, removeEventListener() {},
    }));
  });

  it('先從 0 起跑，最後停在整月合計上', async () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.getByTestId('card-income')).toHaveTextContent('$0.00');
    await waitFor(
      () => expect(screen.getByTestId('card-income')).toHaveTextContent('$5,200.00'),
      { timeout: 3000 }
    );
  });
});

describe('SummaryCards 的結餘卡饅頭（MOTION #30）', () => {
  beforeEach(stubReducedMotion);

  it('結餘卡有一隻會呼吸的饅頭', () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.getByTestId('net-mantou')).toBeInTheDocument();
  });

  it('收入卡與支出卡沒有饅頭', () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.getByTestId('card-income').querySelector('[data-part="hi"]')).toBeNull();
    expect(screen.getByTestId('card-expense').querySelector('[data-part="hi"]')).toBeNull();
  });
});
