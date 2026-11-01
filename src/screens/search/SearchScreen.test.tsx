import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Category, Txn } from '../../domain/types';
import { useLedger } from '../../store/useLedger';
import { RECENT_SEARCHES_KEY, pushRecent, loadRecent } from './recentSearches';
import { SEARCH_DEBOUNCE_MS, SearchScreen } from './SearchScreen';

const CATS: Category[] = [
  {
    id: 'food', kind: 'expense', name: '餐飲', icon: 'cup', budgetCents: 60_000,
    subs: [{ id: 'food-in', name: '內用' }], colorSet: 0, order: 0, active: true,
  },
  {
    id: 'mart', kind: 'expense', name: '超市', icon: 'basket', budgetCents: 80_000,
    subs: [{ id: 'mart-food', name: '食材' }], colorSet: 1, order: 1, active: true,
  },
  {
    id: 'old', kind: 'expense', name: '舊分類', icon: 'bag', budgetCents: 0,
    subs: [{ id: 'old-s', name: '舊' }], colorSet: 2, order: 2, active: false,
  },
  {
    id: 'inc', kind: 'income', name: '收入', icon: 'coin', budgetCents: null,
    subs: [{ id: 'inc-tax', name: '退稅' }], colorSet: 3, order: 3, active: true,
  },
];

function txn(id: string, over: Partial<Txn>): Txn {
  return {
    id, date: '2026-09-04', mainId: 'mart', subId: 'mart-food', mainName: '超市', subName: '食材',
    amountCents: 1_000, currency: 'CAD', actualCadCents: 1_000, by: '我', note: '',
    createdAt: '2026-09-04T10:00:00.000Z', updatedAt: '2026-09-04T10:00:00.000Z', deleted: false,
    ...over,
  };
}

const TXNS: Txn[] = [
  txn('costco-sep', { date: '2026-09-14', note: 'Costco', actualCadCents: 8_820 }),
  txn('costco-aug', { date: '2026-08-30', note: 'Costco', actualCadCents: 9_640, by: '妻' }),
  txn('brunch', { date: '2026-09-07', mainId: 'food', subId: 'food-in', note: 'Brunch', actualCadCents: 1_230 }),
  txn('gst', { date: '2026-09-22', mainId: 'inc', subId: 'inc-tax', note: 'GST credit', actualCadCents: 18_640 }),
];

const initialState = useLedger.getState();

beforeEach(() => {
  localStorage.clear();
  useLedger.setState(initialState, true);
  useLedger.setState({ categories: CATS, txns: TXNS, today: '2026-09-23' });
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

function open(over: Partial<Parameters<typeof SearchScreen>[0]> = {}) {
  const props = { onPick: vi.fn(), onClose: vi.fn(), ...over };
  render(<SearchScreen {...props} />);
  return props;
}

function type(text: string) {
  fireEvent.change(screen.getByTestId('search-input'), { target: { value: text } });
  act(() => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
}

describe('SearchScreen：閒置狀態', () => {
  it('開啟時是閒置狀態，不列任何紀錄；最近搜尋是空的時候連標題都不顯示', () => {
    open();
    expect(screen.queryByTestId('search-count')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-recent')).not.toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toHaveFocus();
  });

  it('有最近搜尋時顯示膠囊，點了立刻搜尋', () => {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(['Costco', '咖啡']));
    open();
    const recent = screen.getByTestId('search-recent');
    expect(recent).toHaveTextContent('最近搜尋');
    fireEvent.click(within(recent).getByText('Costco'));
    // 不等 debounce
    expect(screen.getByTestId('search-input')).toHaveValue('Costco');
    expect(screen.getByTestId('search-count')).toHaveTextContent('找到 2 筆');
  });
});

describe('SearchScreen：搜尋', () => {
  it('輸入 costco 找到備註有 Costco 的紀錄，且有標亮', () => {
    open();
    type('costco');
    expect(screen.getByTestId('search-count')).toHaveTextContent('找到 2 筆');
    const hit = screen.getByTestId('search-hit-costco-sep');
    expect(hit.querySelector('mark')).toHaveTextContent('Costco');
  });

  it('打字時等 debounce 才更新結果', () => {
    open();
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'costco' } });
    expect(screen.queryByTestId('search-count')).not.toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS); });
    expect(screen.getByTestId('search-count')).toBeInTheDocument();
  });

  it('輸入 12.3 找到金額 12.30', () => {
    open();
    type('12.3');
    expect(screen.getByTestId('search-count')).toHaveTextContent('找到 1 筆');
    expect(screen.getByTestId('search-hit-brunch')).toHaveTextContent('-12.30');
  });

  it('跨月份分組正確，各組小計正確，摘要只加支出', () => {
    open();
    type('c');
    expect(screen.getByTestId('search-count')).toHaveTextContent('找到 4 筆');
    expect(screen.getByTestId('search-total')).toHaveTextContent('支出合計 $196.90');
    expect(screen.getByTestId('search-group-2026-09')).toHaveTextContent('9 月');
    expect(screen.getByTestId('search-group-total-2026-09')).toHaveTextContent('支出 $100.50');
    expect(screen.getByTestId('search-group-total-2026-08')).toHaveTextContent('支出 $96.40');
    expect(screen.getByTestId('search-hit-gst')).toHaveTextContent('+186.40');
  });

  it('找不到時顯示空狀態', () => {
    open();
    type('zzz');
    expect(screen.getByTestId('search-empty')).toHaveTextContent('找不到符合的紀錄');
  });

  it('清除鈕只在有輸入時出現，點了回到閒置', () => {
    open();
    expect(screen.queryByTestId('search-clear')).not.toBeInTheDocument();
    type('costco');
    fireEvent.click(screen.getByTestId('search-clear'));
    expect(screen.getByTestId('search-input')).toHaveValue('');
    expect(screen.queryByTestId('search-count')).not.toBeInTheDocument();
  });
});

describe('SearchScreen：分類篩選', () => {
  it('順序是 全部 → 還在用的支出分類 → 收入', () => {
    open();
    const names = within(screen.getByTestId('search-chips')).getAllByRole('radio').map((b) => b.textContent);
    expect(names).toEqual(['全部', '餐飲', '超市', '收入']);
  });

  it('只選餐飲不輸入關鍵字，列出全部餐飲紀錄', () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: '餐飲' }));
    expect(screen.getByTestId('search-count')).toHaveTextContent('找到 1 筆');
    expect(screen.getByTestId('search-hit-brunch')).toBeInTheDocument();
  });

  it('選收入時摘要不顯示支出合計', () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: '收入' }));
    expect(screen.getByTestId('search-count')).toHaveTextContent('找到 1 筆');
    expect(screen.queryByTestId('search-total')).not.toBeInTheDocument();
  });

  it('點回全部且沒有關鍵字就回到閒置', () => {
    open();
    fireEvent.click(screen.getByRole('radio', { name: '餐飲' }));
    fireEvent.click(screen.getByRole('radio', { name: '全部' }));
    expect(screen.queryByTestId('search-count')).not.toBeInTheDocument();
  });
});

describe('SearchScreen：最近搜尋與操作', () => {
  it('按 Enter 寫進最近搜尋，重開還在', () => {
    open();
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: '  Costco ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(loadRecent()).toEqual(['Costco']);
  });

  it('關鍵字是空的時候按 Enter 不寫入', () => {
    open();
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(localStorage.getItem(RECENT_SEARCHES_KEY)).toBeNull();
  });

  it('pushRecent：新的在前、去重、最多 5 筆', () => {
    let list: string[] = [];
    for (const t of ['a', 'b', 'c', 'd', 'e', 'f', 'c']) list = pushRecent(list, t);
    expect(list).toEqual(['c', 'f', 'e', 'd', 'b']);
  });

  it('點結果列回報那一筆', () => {
    const { onPick } = open();
    type('brunch');
    fireEvent.click(screen.getByTestId('search-hit-brunch'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'brunch' }));
  });

  it('取消關閉搜尋頁', () => {
    const { onClose } = open();
    fireEvent.click(screen.getByTestId('search-cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  it('開著時對方同步了新資料不重整（下次開啟才生效）', () => {
    open();
    act(() => { useLedger.setState({ txns: [...TXNS, txn('new', { note: 'Costco' })] }); });
    type('costco');
    expect(screen.getByTestId('search-count')).toHaveTextContent('找到 2 筆');
  });
});
