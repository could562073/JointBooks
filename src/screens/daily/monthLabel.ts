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
