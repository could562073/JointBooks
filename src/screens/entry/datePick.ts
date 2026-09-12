import { addMonths, clampDay, parseDate, toDateString, todayLocal } from '../../domain/date';

/**
 * §5 小月曆的 `‹ ›` 換月。
 *
 * 規格寫的是「跨年正確、跳到天數較少的月份時自動夾到月底」——夾日這個措辭
 * 跟 §4 月份導覽一樣，所以這裡換的是「選中的那一天」本身，不是單純翻頁：
 * 1/31 按下一月會變成 2/28，不會冒出一個不存在的 2/31。
 */
export function shiftMonth(date: string, delta: number): string {
  const d = parseDate(date);
  const next = addMonths(d.getFullYear(), d.getMonth(), delta);
  return toDateString(new Date(next.y, next.m, clampDay(next.y, next.m, d.getDate())));
}

/** 在同一個月裡換一天 */
export function withDay(date: string, day: number): string {
  const d = parseDate(date);
  return toDateString(new Date(d.getFullYear(), d.getMonth(), day));
}

/** 「今天」鍵。抽成函式是為了讓測試能注入固定的今天 */
export function today(now: Date = new Date()): string {
  return todayLocal(now);
}
