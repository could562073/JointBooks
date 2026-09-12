import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { budgetMultiplier } from '../domain/aggregate';
import { WEEK_START } from '../domain/constants';
import { formatCad } from '../domain/money';
import { useLedger } from '../store/useLedger';
import { AT, addEntry, goTab, openApp, setupLedger, teardownLedger } from './harness';

beforeEach(setupLedger);
afterEach(teardownLedger);

describe('§15.1-16 統計頁週／月／年切換', () => {
  it('總覽期間、趨勢 X 軸、預算倍率三處都跟著換', async () => {
    await openApp();
    await addEntry('100');
    await goTab('stats');

    const read = () => ({
      period: screen.getByTestId('overview-period').textContent,
      axis: screen.getByTestId('trend-axis').textContent,
      budget: screen.getByTestId('budget-list').textContent,
    });

    const month = read();
    expect(screen.getByTestId('dimension-month')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('dimension-week'));
    const week = read();
    expect(week.period).not.toBe(month.period);
    expect(week.axis).not.toBe(month.axis);
    expect(week.budget).not.toBe(month.budget);

    fireEvent.click(screen.getByTestId('dimension-year'));
    const year = read();
    expect(year.period).not.toBe(month.period);
    expect(year.axis).not.toBe(month.axis);
    expect(year.budget).not.toBe(month.budget);
  });

  /**
   * §15.1-16 原本寫死 ×0.25／×1／×11.4，增補檔 D-1 已改成 7/當月天數 與 ×12
   * （原數值被判定為未經推導）。這裡驗的是實際規格，倍率直接取 domain 的
   * budgetMultiplier，避免在測試裡重寫一次公式。
   */
  it('預算額度按維度縮放（增補檔 D-1：週 7/當月天數、月 ×1、年 ×12）', async () => {
    await openApp();
    const target = useLedger.getState().categories
      .find((c) => c.kind === 'expense' && (c.budgetCents ?? 0) > 0)!;
    const monthly = target.budgetCents!;
    const anchor = `${AT.year}-09-${AT.day}`;
    await goTab('stats');

    const shown = () => screen.getByTestId(`budget-${target.id}-numbers`).textContent ?? '';
    const cad = (cents: number) => formatCad(Math.round(cents), 'none');

    expect(budgetMultiplier('month', anchor)).toBe(1);
    expect(shown()).toContain(cad(monthly));

    fireEvent.click(screen.getByTestId('dimension-week'));
    expect(budgetMultiplier('week', anchor)).toBeCloseTo(7 / 30, 10);
    expect(shown()).toContain(cad(monthly * budgetMultiplier('week', anchor)));

    fireEvent.click(screen.getByTestId('dimension-year'));
    expect(budgetMultiplier('year', anchor)).toBe(12);
    expect(shown()).toContain(cad(monthly * 12));
  });

  it('趨勢圖換維度後點數跟著換', async () => {
    await openApp();
    await goTab('stats');
    const points = () => screen.getByTestId('trend-expense').getAttribute('points');

    const month = points();
    fireEvent.click(screen.getByTestId('dimension-year'));
    expect(points()).not.toBe(month);
  });
});

describe('§15.1-18 週起始固定週一（增補檔 A：設定已移除）', () => {
  it('常數就是 mon，月曆星期列從一開始', async () => {
    expect(WEEK_START).toBe('monday');
    await openApp();
    const labels = screen.getAllByText(/^[一二三四五六日]$/).map((n) => n.textContent);
    expect(labels).toEqual(['一', '二', '三', '四', '五', '六', '日']);
  });

  it('2026-09-01 是週二，所以首格空白剛好一格', async () => {
    await openApp();
    // 月曆格線裡的 aria-hidden 佔位就是 1 號前的空白格
    expect(screen.getByTestId('month-calendar').querySelectorAll('[aria-hidden="true"]'))
      .toHaveLength(1);
  });

  it('配置頁沒有週起始與月結日那兩列', async () => {
    await openApp();
    await goTab('settings');
    expect(screen.queryByText(/週起始/)).not.toBeInTheDocument();
    expect(screen.queryByText(/月結日/)).not.toBeInTheDocument();
  });
});

describe('§15.1-19 關閉「每筆顯示記帳人」後頭像隱藏但版位保留', () => {
  it('元素仍在、opacity 轉 0，重開之後記得這個設定', async () => {
    await openApp();
    await addEntry('15');
    const id = useLedger.getState().txns[0]!.id;

    expect(screen.getByTestId(`by-${id}`)).toHaveStyle({ opacity: '1' });

    await goTab('settings');
    fireEvent.click(screen.getByTestId('toggle-who'));
    await waitFor(() => expect(useLedger.getState().showWhoTags).toBe(false));

    await goTab('daily');
    const avatar = screen.getByTestId(`by-${id}`);
    expect(avatar).toBeInTheDocument();                 // 版位保留
    expect(avatar).toHaveStyle({ opacity: '0' });       // 只是看不見
    expect(avatar).toHaveAttribute('aria-hidden', 'true');
  });

  it('再開一次就恢復顯示', async () => {
    await openApp();
    await addEntry('15');
    const id = useLedger.getState().txns[0]!.id;

    await goTab('settings');
    fireEvent.click(screen.getByTestId('toggle-who'));
    await waitFor(() => expect(useLedger.getState().showWhoTags).toBe(false));
    fireEvent.click(screen.getByTestId('toggle-who'));
    await waitFor(() => expect(useLedger.getState().showWhoTags).toBe(true));

    await goTab('daily');
    expect(screen.getByTestId(`by-${id}`)).toHaveStyle({ opacity: '1' });
  });
});
