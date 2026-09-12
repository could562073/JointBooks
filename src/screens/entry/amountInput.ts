import { formatCents } from '../../domain/money';

/**
 * §5 數字鍵盤的鍵。輸入規則本身在 domain/money 的 pushDigit——那支是 Plan 02
 * 就為了 §5 寫的，這裡只負責把鍵名對應過去，不要再寫第二份規則。
 */
export type KeypadKey =
  | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '0' | '.' | 'back';

/** pushDigit 收的是畫面上的字元；'back' 是這一層的鍵名 */
export function keyChar(key: KeypadKey): string {
  return key === 'back' ? '⌫' : key;
}

/**
 * 整數分換回輸入欄的顯示字串（編輯模式帶入原值用）。
 *
 * 不用 money 的 fromCents：那支回傳數字（12.5），輸入欄要的是補滿兩位的
 * 字串（"12.50"），而且 0 要給空字串讓欄位顯示 placeholder 而不是一個死板的 0。
 * 用 formatCents 是為了共用同一套小數處理，但要去掉它的千分位——
 * 千分位進到輸入欄之後，下一個按鍵就會把它接成 "1,234.565"。
 */
export function centsToInput(cents: number): string {
  if (!cents) return '';
  const sign = cents < 0 ? '-' : '';
  return `${sign}${formatCents(cents).replace(/,/g, '')}`;
}
