import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultCategories } from '../../domain/categories';
import type { Category, Txn } from '../../domain/types';
import { useLedger } from '../../store/useLedger';
import { StatsScreen } from './StatsScreen';

let n = 0;
const CATS: Category[] = defaultCategories(() => `id-${n++}`);
const EXPENSE = CATS.filter((c) => c.kind === 'expense');
const INCOME = CATS.filter((c) => c.kind === 'income');

const s = () => useLedger.getState();
const initialState = useLedger.getState();

function txn(over: Partial<Txn> = {}): Txn {
  return {
    id: `t${Math.random()}`, date: '2026-09-06',
    mainId: EXPENSE[0]!.id, subId: EXPENSE[0]!.subs[0]!.id,
    mainName: '租屋', subName: '租屋',
    amountCents: 10_000, currency: 'CAD', actualCadCents: 10_000,
    by: '我', note: '',
    createdAt: '2026-09-06T10:00:00.000Z', updatedAt: '2026-09-06T10:00:00.000Z',
    deleted: false,
    ...over,
  };
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
  useLedger.setState(initialState, true);
  useLedger.setState({
    year: 2026, month: 8, selectedDay: 6,
    categories: CATS, txns: [], dimension: 'month', ready: true,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('StatsScreen 的版面', () => {
  it('三塊內容都在：總覽卡、趨勢、預算', () => {
    render(<StatsScreen />);
    expect(screen.getByTestId('overview-card')).toBeInTheDocument();
    expect(screen.getByTestId('trend-chart')).toBeInTheDocument();
    expect(screen.getByTestId('budget-list')).toBeInTheDocument();
  });

  it('整頁捲動的是內容區，不是最外層', () => {
    render(<StatsScreen />);
    const root = screen.getByTestId('stats-screen');
    const scroll = screen.getByTestId('stats-scroll');
    expect(scroll).not.toBe(root);
    expect(root).toContainElement(scroll);
  });
});

describe('StatsScreen 的維度切換（MOTION #32）', () => {
  it('三個維度：週、月、年', () => {
    render(<StatsScreen />);
    expect(screen.getByTestId('dimension-week')).toHaveTextContent('週');
    expect(screen.getByTestId('dimension-month')).toHaveTextContent('月');
    expect(screen.getByTestId('dimension-year')).toHaveTextContent('年');
  });

  it('點維度會寫回 store', () => {
    render(<StatsScreen />);
    fireEvent.click(screen.getByTestId('dimension-year'));
    expect(s().dimension).toBe('year');
  });

  it('期間標籤跟著維度變', () => {
    render(<StatsScreen />);
    expect(screen.getByTestId('overview-period')).toHaveTextContent('2026年9月');

    fireEvent.click(screen.getByTestId('dimension-year'));
    expect(screen.getByTestId('overview-period')).toHaveTextContent('2026年');

    fireEvent.click(screen.getByTestId('dimension-week'));
    // 2026-09-06 是週日，週一起始那週是 8/31 – 9/6
    expect(screen.getByTestId('overview-period')).toHaveTextContent('8/31 – 9/6');
  });

  it('折線的資料點數跟著維度變', () => {
    render(<StatsScreen />);
    fireEvent.click(screen.getByTestId('dimension-week'));
    expect(screen.getByTestId('trend-axis').children).toHaveLength(7);

    fireEvent.click(screen.getByTestId('dimension-year'));
    expect(screen.getByTestId('trend-axis').children).toHaveLength(12);
  });

  // 原型的「趨勢」標題右邊是支出／收入圖例，不是文字說明（trendAxisNote），
  // 已移除畫面上的顯示；trendAxisNote 本身仍是純函式，測試留在 statsLabels.test.ts。
});

describe('StatsScreen 的數字', () => {
  it('總覽卡算的是該期間的合計（原型的合計數字只到元）', () => {
    useLedger.setState({
      txns: [
        txn({ actualCadCents: 30_000 }),
        txn({ actualCadCents: 20_000 }),
        txn({ mainId: INCOME[0]!.id, subId: INCOME[0]!.subs[0]!.id, actualCadCents: 200_000 }),
      ],
    });
    render(<StatsScreen />);
    expect(screen.getByTestId('overview-expense')).toHaveTextContent('$500');
    expect(screen.getByTestId('overview-income')).toHaveTextContent('$2,000');
    expect(screen.getByTestId('overview-net')).toHaveTextContent('$1,500');
  });

  it('期間外的紀錄不算進來', () => {
    useLedger.setState({ txns: [txn({ date: '2026-08-15', actualCadCents: 99_900 })] });
    render(<StatsScreen />);
    expect(screen.getByTestId('overview-expense')).toHaveTextContent('$0');
  });

  it('預算的分母跟著維度換算（增補檔 D-1：年 = 12 倍）', () => {
    render(<StatsScreen />);
    const monthly = screen.getByTestId(`budget-${EXPENSE[0]!.id}-numbers`).textContent!;

    fireEvent.click(screen.getByTestId('dimension-year'));
    const yearly = screen.getByTestId(`budget-${EXPENSE[0]!.id}-numbers`).textContent!;

    expect(yearly).not.toBe(monthly);
    // 月預算 $2,100 → 年 $25,200
    expect(yearly).toContain('$25,200');
  });
});
