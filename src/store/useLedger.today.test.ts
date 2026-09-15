import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { selectedDate, useLedger } from './useLedger';

const s = () => useLedger.getState();
const initialState = useLedger.getState();

beforeEach(() => { useLedger.setState(initialState, true); });
afterEach(() => { vi.useRealTimers(); });

/** 只假造時鐘，其他計時器照常 */
function clockAt(y: number, m: number, d: number, hh = 0, mm = 1): void {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(y, m, d, hh, mm));
}

describe('App 開著跨過午夜', () => {
  it('啟動時的今天就是本機日期', () => {
    expect(initialState.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(selectedDate(initialState)).toBe(initialState.today);
  });

  it('原本停在今天：過了午夜跟著換到新的一天（跨月也對）', () => {
    useLedger.setState({ today: '2026-09-30', year: 2026, month: 8, selectedDay: 30 });
    clockAt(2026, 9, 1);
    s().refreshToday();
    expect(s().today).toBe('2026-10-01');
    expect(selectedDate(s())).toBe('2026-10-01');
  });

  it('自己選了別天：只更新今天，選的日期不動', () => {
    useLedger.setState({ today: '2026-09-14', year: 2026, month: 8, selectedDay: 3 });
    clockAt(2026, 8, 15);
    s().refreshToday();
    expect(s().today).toBe('2026-09-15');
    expect(selectedDate(s())).toBe('2026-09-03');
  });

  it('還沒過午夜：什麼都不變', () => {
    useLedger.setState({ today: '2026-09-14', year: 2026, month: 8, selectedDay: 14 });
    clockAt(2026, 8, 14, 23, 59);
    s().refreshToday();
    expect(s().today).toBe('2026-09-14');
    expect(selectedDate(s())).toBe('2026-09-14');
  });
});
