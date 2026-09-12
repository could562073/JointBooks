import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useLedger } from '../store/useLedger';
import { AT, goTab, openApp, setupLedger, teardownLedger } from './harness';

beforeEach(setupLedger);
afterEach(teardownLedger);

describe('§15.1-1 三個分頁可切換', () => {
  it('三頁都切得到，且分頁列標記目前這頁', async () => {
    await openApp();
    expect(screen.getByTestId('tab-daily')).toHaveAttribute('aria-current', 'page');

    await goTab('stats');
    expect(screen.getByTestId('tab-stats')).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByTestId('daily-screen')).not.toBeInTheDocument();

    await goTab('settings');
    expect(screen.getByTestId('tab-settings')).toHaveAttribute('aria-current', 'page');

    await goTab('daily');
    expect(screen.getByTestId('daily-screen')).toBeInTheDocument();
  });

  it('每頁只有一個捲動區', async () => {
    await openApp();
    // 日常頁捲的是明細，月曆與月份列固定
    expect(screen.getAllByTestId(/-scroll$|^txn-scroll$/)).toHaveLength(1);

    await goTab('stats');
    expect(screen.getAllByTestId(/-scroll$/)).toHaveLength(1);
    expect(screen.getByTestId('stats-scroll')).toBeInTheDocument();

    await goTab('settings');
    expect(screen.getAllByTestId(/-scroll$/)).toHaveLength(1);
    expect(screen.getByTestId('settings-scroll')).toBeInTheDocument();
  });
});

describe('§15.1-2 點月曆某天 → 明細、日期標題、當日總額同步', () => {
  it('選另一天時三處一起換', async () => {
    await openApp();
    // 10 號記一筆，12 號不記
    fireEvent.click(screen.getByTestId('fab'));
    for (const k of '30') fireEvent.click(screen.getByTestId(`key-${k}`));
    fireEvent.click(screen.getByTestId('key-save'));
    await waitFor(() => expect(screen.getByTestId('txn-list')).toBeInTheDocument());

    expect(screen.getByTestId('day-header')).toHaveTextContent('10日');
    // 當日總額是 count-up，值在 effect 裡才落定
    await waitFor(() => expect(screen.getByTestId('day-total')).toHaveTextContent('30'));

    fireEvent.click(screen.getByTestId('cell-12'));
    expect(screen.getByTestId('day-header')).toHaveTextContent('12日');
    expect(screen.getByTestId('txn-empty')).toBeInTheDocument();
    // 沒有帳的那天總額是破折號，不是 $0.00
    await waitFor(() => expect(screen.getByTestId('day-total')).toHaveTextContent('—'));

    fireEvent.click(screen.getByTestId('cell-10'));
    expect(screen.getByTestId('txn-list')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('day-total')).toHaveTextContent('30'));
  });
});

describe('§15.1-3 ‹ › 換月，跨年年份正確', () => {
  it('12 月按 › 進到隔年 1 月', async () => {
    useLedger.setState({ year: 2026, month: 11, selectedDay: 5 });
    await openApp();
    expect(screen.getByTestId('month-title')).toHaveTextContent('2026年12月');

    fireEvent.click(screen.getByLabelText('下個月'));
    expect(screen.getByTestId('month-title')).toHaveTextContent('2027年1月');
  });

  it('1 月按 ‹ 退到前一年 12 月', async () => {
    useLedger.setState({ year: 2027, month: 0, selectedDay: 5 });
    await openApp();
    fireEvent.click(screen.getByLabelText('上個月'));
    expect(screen.getByTestId('month-title')).toHaveTextContent('2026年12月');
  });

  it('連按十四次回到同一個月的隔年', async () => {
    await openApp();
    for (let i = 0; i < 12; i += 1) fireEvent.click(screen.getByLabelText('下個月'));
    expect(screen.getByTestId('month-title')).toHaveTextContent(`${AT.year + 1}年9月`);
  });
});

describe('§15.1-4 年月選擇器選 2 月時 31 日被夾成當月最後一天', () => {
  it('31 日 → 2 月 → 28 日，不會出現 2/31', async () => {
    useLedger.setState({ year: 2026, month: 0, selectedDay: 31 });
    await openApp();
    expect(screen.getByTestId('day-header')).toHaveTextContent('31日');

    fireEvent.click(screen.getByTestId('month-title'));
    fireEvent.click(screen.getByTestId('picker-month-1'));

    await waitFor(() => expect(screen.getByTestId('month-title')).toHaveTextContent('2026年2月'));
    expect(screen.getByTestId('day-header')).toHaveTextContent('28日');
    expect(useLedger.getState().selectedDay).toBe(28);
    expect(screen.queryByTestId('cell-31')).not.toBeInTheDocument();
  });

  it('閏年的 2 月夾到 29 而不是 28', async () => {
    useLedger.setState({ year: 2028, month: 0, selectedDay: 31 });
    await openApp();
    fireEvent.click(screen.getByTestId('month-title'));
    fireEvent.click(screen.getByTestId('picker-month-1'));
    await waitFor(() => expect(useLedger.getState().selectedDay).toBe(29));
  });
});
