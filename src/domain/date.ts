import type { Dimension, Range } from './types';

const p2 = (n: number) => String(n).padStart(2, '0');

/** §14.7：一律用本地時區欄位組字串，絕不用 toISOString() */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function todayLocal(now: Date = new Date()): string {
  return toDateString(now);
}

/** 用本地建構子解析，避免 new Date('2026-09-06') 被當成 UTC 午夜 */
export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function daysInMonth(y: number, m: number): number {
  return new Date(y, m + 1, 0).getDate();
}

export function clampDay(y: number, m: number, day: number): number {
  return Math.min(day, daysInMonth(y, m));
}

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const total = y * 12 + m + delta;
  return { y: Math.floor(total / 12), m: ((total % 12) + 12) % 12 };
}

/** 週一起始：getDay() 的 0=週日 轉成 6 */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export function firstCellOffset(y: number, m: number): number {
  return mondayIndex(new Date(y, m, 1));
}

export function weekdayLabels(): string[] {
  return ['一', '二', '三', '四', '五', '六', '日'];
}

export function isWeekend(colIndex: number): boolean {
  return colIndex === 5 || colIndex === 6;
}

export function isoWeek(d: Date): { year: number; week: number } {
  // 移到該週的週四，該週四所在年就是 ISO 年
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  t.setDate(t.getDate() - mondayIndex(t) + 3);
  const isoYear = t.getFullYear();
  const jan4 = new Date(isoYear, 0, 4);
  jan4.setDate(jan4.getDate() - mondayIndex(jan4) + 3);
  // Both dates moved to Thursday, so difference is always exact weeks; round() absorbs float error only
  const week = 1 + Math.round((t.getTime() - jan4.getTime()) / (7 * 86_400_000));
  return { year: isoYear, week };
}

export function rangeOf(dim: Dimension, anchor: string): Range {
  const d = parseDate(anchor);

  if (dim === 'month') {
    const s = new Date(d.getFullYear(), d.getMonth(), 1);
    const e = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return { start: toDateString(s), end: toDateString(e) };
  }

  if (dim === 'year') {
    return {
      start: toDateString(new Date(d.getFullYear(), 0, 1)),
      end: toDateString(new Date(d.getFullYear() + 1, 0, 1)),
    };
  }

  // week：本週一至下週一
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - mondayIndex(d));
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7);
  return { start: toDateString(s), end: toDateString(e) };
}

export function previousRange(dim: Dimension, r: Range): Range {
  const s = parseDate(r.start);

  if (dim === 'month') {
    return {
      start: toDateString(new Date(s.getFullYear(), s.getMonth() - 1, 1)),
      end: r.start,
    };
  }

  if (dim === 'year') {
    return {
      start: toDateString(new Date(s.getFullYear() - 1, 0, 1)),
      end: r.start,
    };
  }

  return {
    start: toDateString(new Date(s.getFullYear(), s.getMonth(), s.getDate() - 7)),
    end: r.start,
  };
}

/** 半開區間 [start, end)。字串比較即可，因為 YYYY-MM-DD 字典序等於時間序 */
export function inRange(date: string, r: Range): boolean {
  return date >= r.start && date < r.end;
}

export function eachDay(r: Range): string[] {
  const out: string[] = [];
  const end = parseDate(r.end);
  for (let d = parseDate(r.start); d < end; d.setDate(d.getDate() + 1)) {
    out.push(toDateString(d));
  }
  return out;
}
