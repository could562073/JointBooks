import {
  AMOUNT_MAX_DECIMALS, AMOUNT_MAX_LEN, CALENDAR_COMPACT_THRESHOLD_CENTS,
} from './constants';

/**
 * 轉成整數分。
 * 字串走「字面量」解析而不是 Number(s) * 100 —— 後者會踩浮點：
 * 1.005 * 100 === 100.49999999999999，Math.round 會得到 100 而不是 101。
 */
export function toCents(input: string): number {
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

/** 合計用：只到元，仍要千分位 */
const WHOLE = new Intl.NumberFormat('en-CA', { maximumFractionDigits: 0 });

export function formatCents(cents: number): string {
  return GROUP.format(Math.abs(cents) / 100);
}

/**
 * "auto"：負數加 "-"，正數不加（支出用）
 * "plus"：一律加 "+"（收入用）
 * "minus"：不論正負一律加 "-"（支出金額一律以正數儲存，畫面要強制補上 "-"，
 *          取代到處寫 `-${formatCad(c,'none')}`，§4 明細列的支出前綴）
 * "none"：不加號
 */
export function formatCad(cents: number, sign: 'auto' | 'none' | 'plus' | 'minus' = 'auto'): string {
  const body = `$${formatCents(cents)}`;
  if (sign === 'plus') return `+${body}`;
  if (sign === 'minus') return `-${body}`;
  if (sign === 'none') return body;
  return cents < 0 ? `-${body}` : body;
}

/**
 * 原型的合計數字（收支三卡、統計總覽、預算額度）一律**只到元**，不顯示角分；
 * 只有單筆金額與當日總額才帶兩位小數。同一個畫面上兩種精度是刻意的：合計看
 * 的是量級，單筆看的是對不對得上收據。
 */
export function formatCadWhole(cents: number, sign: 'auto' | 'none' | 'plus' | 'minus' = 'auto'): string {
  const body = `$${WHOLE.format(Math.abs(cents) / 100)}`;
  if (sign === 'plus') return `+${body}`;
  if (sign === 'minus') return `-${body}`;
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

/**
 * §5 數字鍵盤：小數最多兩位、總長 9 字。
 *
 * 兩處與原型不同，都經使用者裁決保留：
 *   1. 空白時先打小數點 → 補成 `0.`（原型留空）
 *   2. 前導零不保留：`0` 後面打 `5` 是 `5`，不是 `05`
 */
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
