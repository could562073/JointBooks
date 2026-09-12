import { describe, it, expect } from 'vitest';
import { toCents } from '../../domain/money';
import { centsToInput, keyChar } from './amountInput';

describe('keyChar', () => {
  it('數字與小數點原樣傳給 pushDigit', () => {
    expect(keyChar('7')).toBe('7');
    expect(keyChar('.')).toBe('.');
  });

  it('back 對應到 pushDigit 認得的 ⌫', () => {
    expect(keyChar('back')).toBe('⌫');
  });
});

describe('centsToInput', () => {
  it('補滿兩位小數', () => {
    expect(centsToInput(1234)).toBe('12.34');
    expect(centsToInput(1250)).toBe('12.50');
    expect(centsToInput(7)).toBe('0.07');
  });

  it('0 給空字串，讓欄位顯示 placeholder', () => {
    expect(centsToInput(0)).toBe('');
  });

  it('不帶千分位——帶了的話下一個按鍵會把它接成 1,234.565', () => {
    expect(centsToInput(123_456)).toBe('1234.56');
    expect(centsToInput(20_500_00)).toBe('20500.00');
  });

  it('負數保留負號', () => {
    expect(centsToInput(-1234)).toBe('-12.34');
  });

  it('跟 toCents 對得起來（編輯模式帶入原值不會走樣）', () => {
    for (const c of [1, 7, 99, 100, 1999, 205_000, 123_456]) {
      expect(toCents(centsToInput(c))).toBe(c);
    }
  });
});
