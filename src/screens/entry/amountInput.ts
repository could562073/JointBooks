/** §5：總長 9 字 */
export const MAX_LEN = 9;
/** §5：小數最多兩位 */
export const MAX_DP = 2;

export type KeypadKey =
  | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0' | '.' | 'back';

/**
 * §5 數字鍵盤的輸入規則，照原型的 reducer 實作：
 *   - ⌫ 去掉最後一個字
 *   - 已經有小數點時再按 `.` 沒有作用
 *   - 小數已經兩位時任何數字鍵都沒有作用
 *   - 其餘就是接上去，結果截到 9 字
 *
 * 刻意保留原型的兩個「不漂亮但無害」的行為（HANDOFF 第 7 條：與文件衝突時以原型為準）：
 *   - 一開始就按 `.` 會得到 `.`，不會自動補成 `0.`；後面接數字就是 `.5`，Number 讀得出來
 *   - 前導零不會被吃掉，`007` 就是 `007`，換算成分一樣是 700
 */
export function pressKey(current: string, key: KeypadKey): string {
  if (key === 'back') return current.slice(0, -1);

  const dot = current.indexOf('.');
  if (key === '.' && dot > -1) return current;
  if (dot > -1 && current.length - dot - 1 >= MAX_DP) return current;

  return (current + key).slice(0, MAX_LEN);
}

/**
 * 顯示字串換算成整數分。
 *
 * 走字串補零而不是 `Math.round(Number(s) * 100)`：後者在 `19.99` 這種值上
 * 會先變成 1998.9999999999998 再四捨五入，雖然這個例子救得回來，但金額不該
 * 依賴浮點數剛好救得回來。字串路徑沒有這個問題。
 */
export function toCents(display: string): number {
  const s = display.trim();
  if (s === '' || s === '.') return 0;

  const [whole = '', frac = ''] = s.split('.');
  const cents = `${whole || '0'}${frac.padEnd(MAX_DP, '0').slice(0, MAX_DP)}`;
  const n = Number(cents);
  return Number.isFinite(n) ? n : 0;
}

/** 整數分換回顯示字串。0 給空字串，讓欄位顯示 placeholder 而不是一個死板的 0 */
export function fromCents(cents: number): string {
  if (!cents) return '';
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
