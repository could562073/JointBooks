import type { Currency } from './types';
import {
  AMOUNT_MAX_DECIMALS, AMOUNT_MAX_LEN, CALENDAR_COMPACT_THRESHOLD_CENTS,
} from './constants';

/**
 * 轉成整數分。
 * 字串走「字面量」解析而不是 Number(s) * 100 —— 後者會踩浮點：
 * 1.005 * 100 === 100.49999999999999，Math.round 會得到 100 而不是 101。
 */
export function toCents(input: string | number): number {
  if (typeof input === 'number') {
    return Number.isFinite(input) ? Math.round(input * 100) : 0;
  }

  const s = input.trim();
  if (!s || !/^-?\d*\.?\d*$/.test(s)) return 0;

  const neg = s.startsWith('-');
  const [intPart = '', fracPart = ''] = s.replace('-', '').split('.');
  const whole = Number(intPart || '0') * 100;

  // 第三位小數決定進位；不足補零
  const frac = (fracPart + '000').slice(0, 3);
  const cents = Number(frac.slice(0, 2));
  const carry = Number(frac[2]) >= 5 ? 1 : 0;

  const total = whole + cents + carry;
  return neg ? -total : total;
}

export function fromCents(cents: number): number {
  return Math.round(cents) / 100;
}

const GROUP = new Intl.NumberFormat('en-CA', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCents(cents: number): string {
  return GROUP.format(Math.abs(cents) / 100);
}

/**
 * "auto"：負數加 "-"，正數不加（支出用）
 * "plus"：一律加 "+"（收入用）
 * "none"：不加號
 */
export function formatCad(cents: number, sign: 'auto' | 'none' | 'plus' = 'auto'): string {
  const body = `$${formatCents(cents)}`;
  if (sign === 'plus') return `+${body}`;
  if (sign === 'none') return body;
  return cents < 0 ? `-${body}` : body;
}

/** §4 月曆格：0 不顯示；≥$1000 壓成 $1.2k；否則取整數 */
export function formatCompact(cents: number): string {
  const abs = Math.abs(cents);
  if (abs === 0) return '';
  if (abs >= CALENDAR_COMPACT_THRESHOLD_CENTS) {
    return `$${(abs / 100_000).toFixed(1)}k`;
  }
  return `$${Math.round(abs / 100)}`;
}

/** §4 明細下方小字：CAD 就只顯示 "CAD"，其他顯示原幣金額 + 幣別 */
export function formatOriginal(cents: number, cur: Currency): string {
  if (cur === 'CAD') return 'CAD';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const centsFraction = abs % 100;

  // 只在有小數時顯示小數
  if (centsFraction === 0) {
    return `${dollars.toLocaleString('en-CA')} ${cur}`;
  }

  const value = dollars + centsFraction / 100;
  return `${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
}

/** §5 數字鍵盤：小數最多兩位、總長 9 字 */
export function pushDigit(draft: string, key: string): string {
  if (key === '⌫') return draft.slice(0, -1);

  if (key === '.') {
    if (draft.includes('.')) return draft;
    if (draft === '') return '0.';
    return draft.length < AMOUNT_MAX_LEN ? `${draft}.` : draft;
  }

  if (!/^[0-9]$/.test(key)) return draft;
  if (draft.length >= AMOUNT_MAX_LEN) return draft;

  // 不留前導零："0" + "5" → "5"，但 "0." + "5" → "0.5"
  if (draft === '0') return key;

  const dot = draft.indexOf('.');
  if (dot >= 0 && draft.length - dot - 1 >= AMOUNT_MAX_DECIMALS) return draft;

  return draft + key;
}
