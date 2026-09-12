import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetDb } from '../../db/schema';
import { useLedger } from '../../store/useLedger';
import { DailyScreen } from './DailyScreen';

const s = () => useLedger.getState();
const initialState = useLedger.getState();

beforeEach(async () => {
  // count-up 直接落終值，數字斷言才有確定性
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
  await resetDb();
  useLedger.setState(initialState, true);
  useLedger.setState({ year: 2026, month: 8, selectedDay: 6 });
  await s().load();
  useLedger.setState({ year: 2026, month: 8, selectedDay: 6 });
});
afterEach(() => vi.unstubAllGlobals());

const BASE = { onEdit: () => {}, onAdd: () => {} };

describe('DailyScreen 的版面', () => {
  it('六個區塊都在：導覽、收合區、把手、日期標題、明細捲動容器', () => {
    render(<DailyScreen {...BASE} />);
    expect(screen.getByTestId('month-nav')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-region')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-handle')).toBeInTheDocument();
    expect(screen.getByTestId('day-header')).toBeInTheDocument();
    expect(screen.getByTestId('txn-scroll')).toBeInTheDocument();
    expect(screen.getByTestId('fab')).toBeInTheDocument();
  });

  it('懸浮 ＋ 在捲動容器外面，才不會跟著明細捲走', () => {
    render(<DailyScreen {...BASE} />);
    expect(screen.getByTestId('txn-scroll')).not.toContainElement(screen.getByTestId('fab'));
  });

  it('點懸浮 ＋ 回報要記一筆', () => {
    const onAdd = vi.fn();
    render(<DailyScreen {...BASE} onAdd={onAdd} />);
    fireEvent.click(screen.getByTestId('fab'));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('外層不捲動，只有明細區自己捲', () => {
    render(<DailyScreen {...BASE} />);
    const root = screen.getByTestId('daily-screen');
    const scroll = screen.getByTestId('txn-scroll');
    expect(scroll).not.toBe(root);
    // 明細區在外層裡面，而且是它自己在捲
    expect(root).toContainElement(scroll);
  });

  it('標題顯示目前年月', () => {
    render(<DailyScreen {...BASE} />);
    expect(screen.getByTestId('month-title')).toHaveTextContent('2026年9月');
  });
});

describe('DailyScreen 的月份切換', () => {
  it('› 換到下個月，跨年也正確', () => {
    render(<DailyScreen {...BASE} />);
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(screen.getByTestId('month-title')).toHaveTextContent('2026年10月');
    useLedger.setState({ year: 2026, month: 11 });
    fireEvent.click(screen.getByLabelText('下個月'));
    expect(screen.getByTestId('month-title')).toHaveTextContent('2027年1月');
  });

  it('‹ 換到上個月', () => {
    render(<DailyScreen {...BASE} />);
    fireEvent.click(screen.getByLabelText('上個月'));
    expect(screen.getByTestId('month-title')).toHaveTextContent('2026年8月');
  });

  it('換月會重播方向性滑入，往前往後用不同的動畫類別', () => {
    render(<DailyScreen {...BASE} />);
    const before = screen.getByTestId('month-body').className;
    fireEvent.click(screen.getByLabelText('上個月'));
    expect(screen.getByTestId('month-body').className).not.toBe(before);
  });
});

describe('DailyScreen 的年月選擇器', () => {
  it('預設收起，點標題展開', () => {
    render(<DailyScreen {...BASE} />);
    expect(screen.queryByTestId('month-picker')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('month-title'));
    expect(screen.getByTestId('month-picker')).toBeInTheDocument();
  });

  it('展開時收支三卡與月曆先收起', () => {
    render(<DailyScreen {...BASE} />);
    expect(screen.getByTestId('calendar-region')).toHaveStyle({ maxHeight: '460px' });
    fireEvent.click(screen.getByTestId('month-title'));
    expect(screen.getByTestId('calendar-region')).toHaveStyle({ maxHeight: '0px', opacity: '0' });
  });

  it('選完月份就收合，標題跟著換', () => {
    render(<DailyScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('month-title'));
    fireEvent.click(screen.getByTestId('picker-month-1'));
    expect(screen.queryByTestId('month-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('month-title')).toHaveTextContent('2026年2月');
  });

  it('選到天數較少的月份時，選中日夾到該月最後一天（不會出現 2/31）', () => {
    useLedger.setState({ year: 2026, month: 0, selectedDay: 31 });
    render(<DailyScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('month-title'));
    fireEvent.click(screen.getByTestId('picker-month-1'));
    expect(s().selectedDay).toBe(28);
    expect(screen.getByTestId('day-header')).toHaveTextContent('2月28日');
  });

  it('「收起」關掉選擇器，收合區回到原本的展開狀態', () => {
    render(<DailyScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('month-title'));
    fireEvent.click(screen.getByTestId('picker-close'));
    expect(screen.queryByTestId('month-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId('calendar-region')).toHaveStyle({ maxHeight: '460px' });
  });
});

describe('DailyScreen 的日期選擇', () => {
  it('點月曆上的日期換到那天', () => {
    render(<DailyScreen {...BASE} />);
    fireEvent.click(screen.getByRole('button', { name: /18/ }));
    expect(s().selectedDay).toBe(18);
    expect(screen.getByTestId('day-header')).toHaveTextContent('9月18日');
  });
});

describe('DailyScreen 的明細', () => {
  it('沒有紀錄時顯示空狀態', () => {
    render(<DailyScreen {...BASE} />);
    expect(screen.getByTestId('txn-empty')).toBeInTheDocument();
  });

  it('收起再展開月曆，明細的捲動容器沒有被卸載重建', () => {
    render(<DailyScreen {...BASE} />);
    const before = screen.getByTestId('txn-scroll');
    // 點把手＝切換收合（<6px 視為點擊）
    fireEvent.pointerDown(screen.getByTestId('calendar-handle'), { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(screen.getByTestId('calendar-handle'), { pointerId: 1, clientX: 0, clientY: 0 });
    // 先確認這一下真的收起了，否則下面的斷言等於什麼都沒驗
    expect(screen.getByTestId('calendar-region')).toHaveStyle({ maxHeight: '0px' });
    // 同一個 DOM 節點＝scroll 位置不會被重置
    expect(screen.getByTestId('txn-scroll')).toBe(before);
  });
});
