const EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/**
 * §4 月份導覽的兩行標題。`m` 是 0-based，與 Date、store 和 domain/date.ts 一致
 * ——整個專案只有這裡會把它變成給人看的 1-based 字串。
 */
export function monthLabel(y: number, m: number): { zh: string; en: string } {
  return { zh: `${y}年${m + 1}月`, en: `${EN[m]} ${y}` };
}

/** getDay() 的 0=週日 對進來，所以這個表以週日開頭，跟月曆的週一起始無關 */
const ZH_WEEKDAY = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'] as const;

/**
 * §4 日期標題列：`9月6日 · 週日`。`m` 是 0-based。
 * 用 new Date(y, m, day) 取星期，跟 domain/date.ts 一樣走本地建構子而非解析字串。
 */
export function dayTitle(y: number, m: number, day: number): string {
  return `${m + 1}月${day}日 · ${ZH_WEEKDAY[new Date(y, m, day).getDay()]}`;
}
