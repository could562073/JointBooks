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
};

describe('SummaryCards', () => {
  beforeEach(stubReducedMotion);

  it('三張卡都在', () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.getByTestId('card-income')).toBeInTheDocument();
    expect(screen.getByTestId('card-expense')).toBeInTheDocument();
    expect(screen.getByTestId('card-net')).toBeInTheDocument();
  });

  // 原型的三卡只到元（$5,786 而不是 $5,786.00）——合計看量級，單筆才要對得上收據
  it('收入與支出顯示不帶正負號、只到元的金額', () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.getByTestId('card-income')).toHaveTextContent('$5,200');
    expect(screen.getByTestId('card-expense')).toHaveTextContent('$3,185');
    expect(screen.getByTestId('card-expense')).not.toHaveTextContent('-$3,185');
  });

  it('角分被四捨五入掉，不顯示小數點', () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.getByTestId('card-expense').textContent).not.toMatch(/\d\.\d/);
  });

  it('結餘為負時帶負號', () => {
    render(<SummaryCards {...PROPS} netCents={-45_000} />);
    expect(screen.getByTestId('card-net')).toHaveTextContent('-$450');
  });

  // 增補檔 D-4：月結日固定 1 日，副標固定「本月」、不顯示區間
  it('結餘卡副標固定顯示「本月」', () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.getByTestId('card-net')).toHaveTextContent('本月');
  });

  it('金額為 0 時顯示 $0 而不是空白', () => {
    render(<SummaryCards {...PROPS} incomeCents={0} />);
    expect(screen.getByTestId('card-income')).toHaveTextContent('$0');
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
    expect(screen.getByTestId('card-income')).toHaveTextContent('$0');
    await waitFor(
      () => expect(screen.getByTestId('card-income')).toHaveTextContent('$5,200'),
      { timeout: 3000 }
    );
  });
});

describe('SummaryCards 沒有饅頭', () => {
  beforeEach(stubReducedMotion);

  /*
   * 原型的結餘卡上沒有饅頭——Plan 04 自己加了一顆。MOTION #30 的呼吸饅頭在
   * 原型裡是統計頁總覽卡那一顆，不在這裡。
   */
  it('三張卡都沒有饅頭', () => {
    render(<SummaryCards {...PROPS} />);
    expect(screen.queryByTestId('net-mantou')).not.toBeInTheDocument();
    for (const id of ['card-income', 'card-expense', 'card-net']) {
      expect(screen.getByTestId(id).querySelector('[data-part="hi"]')).toBeNull();
    }
  });
});
