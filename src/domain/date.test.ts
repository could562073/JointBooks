import { describe, it, expect } from 'vitest';
import {
  todayLocal, toDateString, parseDate, daysInMonth, clampDay, addMonths,
  firstCellOffset, weekdayLabels, isWeekend, isoWeek, rangeOf, previousRange,
  inRange, eachDay,
} from './date';

describe('本地時區（§14.7：不得用 UTC，否則跨日會錯一天）', () => {
  it('午夜前一刻仍算當天', () => {
    // 本地 2026-09-06 23:30。若誤用 toISOString() 在 UTC-4 會變成 09-07
    const d = new Date(2026, 8, 6, 23, 30);
    expect(toDateString(d)).toBe('2026-09-06');
  });

  it('清晨仍算當天', () => {
    expect(toDateString(new Date(2026, 8, 6, 0, 15))).toBe('2026-09-06');
  });

  it('parseDate 是 toDateString 的反向且不位移', () => {
    expect(toDateString(parseDate('2026-09-06'))).toBe('2026-09-06');
    expect(parseDate('2026-09-06').getDate()).toBe(6);
    expect(parseDate('2026-09-06').getMonth()).toBe(8);
  });

  it('todayLocal 接受注入的 now', () => {
    expect(todayLocal(new Date(2026, 0, 1, 23, 59))).toBe('2026-01-01');
  });
});

describe('月份運算', () => {
  it('daysInMonth 含閏年', () => {
    expect(daysInMonth(2026, 1)).toBe(28);   // 2026 非閏年
    expect(daysInMonth(2024, 1)).toBe(29);   // 2024 閏年
    expect(daysInMonth(2026, 8)).toBe(30);   // 9 月
    expect(daysInMonth(2026, 0)).toBe(31);
  });

  it('§4：選到天數較少的月份時自動夾到月底，不可出現 2/31', () => {
    expect(clampDay(2026, 1, 31)).toBe(28);
    expect(clampDay(2024, 1, 31)).toBe(29);
    expect(clampDay(2026, 8, 31)).toBe(30);
    expect(clampDay(2026, 0, 31)).toBe(31);
  });

  it('§4：跨年進退正確', () => {
    expect(addMonths(2026, 11, 1)).toEqual({ y: 2027, m: 0 });
    expect(addMonths(2026, 0, -1)).toEqual({ y: 2025, m: 11 });
    expect(addMonths(2026, 8, 5)).toEqual({ y: 2027, m: 1 });
    expect(addMonths(2026, 2, -14)).toEqual({ y: 2025, m: 0 });
  });
});

describe('月曆版面（週起始固定週一）', () => {
  it('星期列為 一二三四五六日', () => {
    expect(weekdayLabels()).toEqual(['一', '二', '三', '四', '五', '六', '日']);
  });

  it('§11-3：首格空白數跟著週一起始位移', () => {
    // 2026-09-01 是週二 → 週一起始下前面空 1 格
    expect(firstCellOffset(2026, 8)).toBe(1);
    // 2026-02-01 是週日 → 週一起始下前面空 6 格
    expect(firstCellOffset(2026, 1)).toBe(6);
    // 2026-06-01 是週一 → 不空格
    expect(firstCellOffset(2026, 5)).toBe(0);
  });

  it('§4：週末（六、日）在週一起始下是第 5、6 欄', () => {
    expect(isWeekend(0)).toBe(false);
    expect(isWeekend(4)).toBe(false);
    expect(isWeekend(5)).toBe(true);
    expect(isWeekend(6)).toBe(true);
  });
});

describe('ISO 週（趨勢圖 X 軸的 W27）', () => {
  it('週四決定週數', () => {
    expect(isoWeek(new Date(2026, 0, 1))).toEqual({ year: 2026, week: 1 });
    expect(isoWeek(new Date(2026, 6, 1))).toEqual({ year: 2026, week: 27 });
  });

  it('跨年邊界歸給正確的 ISO 年', () => {
    // 2027-01-01 是週五 → 屬於 2026 年第 53 週
    expect(isoWeek(new Date(2027, 0, 1))).toEqual({ year: 2026, week: 53 });
  });
});

describe('統計期間（增補檔 D-3）', () => {
  it('月 = 當月 1 日至次月 1 日', () => {
    expect(rangeOf('month', '2026-09-06')).toEqual({ start: '2026-09-01', end: '2026-10-01' });
    expect(rangeOf('month', '2026-12-31')).toEqual({ start: '2026-12-01', end: '2027-01-01' });
  });

  it('週 = 本週一至下週一', () => {
    // 2026-09-06 是週日 → 該 ISO 週為 08-31（一）至 09-07（一）
    expect(rangeOf('week', '2026-09-06')).toEqual({ start: '2026-08-31', end: '2026-09-07' });
    expect(rangeOf('week', '2026-08-31')).toEqual({ start: '2026-08-31', end: '2026-09-07' });
  });

  it('年 = 1/1 至次年 1/1', () => {
    expect(rangeOf('year', '2026-09-06')).toEqual({ start: '2026-01-01', end: '2027-01-01' });
  });

  it('與上期比較 = 同長度的前一個期間', () => {
    expect(previousRange('month', rangeOf('month', '2026-09-06')))
      .toEqual({ start: '2026-08-01', end: '2026-09-01' });
    expect(previousRange('week', rangeOf('week', '2026-09-06')))
      .toEqual({ start: '2026-08-24', end: '2026-08-31' });
    expect(previousRange('year', rangeOf('year', '2026-09-06')))
      .toEqual({ start: '2025-01-01', end: '2026-01-01' });
  });

  it('previousRange 跨年：1 月的前一期是前一年 12 月', () => {
    const jan = rangeOf('month', '2026-01-15');
    expect(jan).toEqual({ start: '2026-01-01', end: '2026-02-01' });
    expect(previousRange('month', jan))
      .toEqual({ start: '2025-12-01', end: '2026-01-01' });
  });

  it('inRange 是半開區間', () => {
    const r = rangeOf('month', '2026-09-06');
    expect(inRange('2026-09-01', r)).toBe(true);
    expect(inRange('2026-09-30', r)).toBe(true);
    expect(inRange('2026-10-01', r)).toBe(false);
    expect(inRange('2026-08-31', r)).toBe(false);
  });

  it('eachDay 展開整個區間', () => {
    const days = eachDay({ start: '2026-09-01', end: '2026-09-04' });
    expect(days).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });
});
