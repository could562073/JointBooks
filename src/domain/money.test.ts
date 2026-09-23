import { describe, it, expect } from 'vitest';
import {
  toCents, fromCents, formatCents, formatCad, formatCompact, formatOriginal, pushDigit,
} from './money';

describe('toCents / fromCents', () => {
  it('字串轉成整數分', () => {
    expect(toCents('5.2')).toBe(520);
    expect(toCents('5.20')).toBe(520);
    expect(toCents('0.01')).toBe(1);
    expect(toCents('2050')).toBe(205_000);
    expect(toCents('')).toBe(0);
    expect(toCents('0')).toBe(0);
  });

  it('避免浮點誤差（§14.7）', () => {
    // 0.1 + 0.2 的經典陷阱：整數分不會有這問題
    expect(toCents('0.1') + toCents('0.2')).toBe(30);
    // Number('1.005') * 100 === 100.49999999999999 → Math.round 會錯給 100。
    // 字面量解析才拿得到 101。
    expect(toCents('1.005')).toBe(101);
    expect(toCents('-1.005')).toBe(-101);
    expect(toCents('48.62')).toBe(4862);
    expect(toCents('0.29')).toBe(29);
    expect(toCents('-5.2')).toBe(-520);
    expect(toCents('abc')).toBe(0);
  });

  it('fromCents 是 toCents 的反向', () => {
    expect(fromCents(4862)).toBe(48.62);
    expect(fromCents(0)).toBe(0);
  });
});

describe('格式化', () => {
  it('formatCents 套千分位、固定兩位小數', () => {
    expect(formatCents(205_000)).toBe('2,050.00');
    expect(formatCents(520)).toBe('5.20');
    expect(formatCents(0)).toBe('0.00');
  });

  it('formatCad 依規則加正負號', () => {
    expect(formatCad(-520)).toBe('-$5.20');       // 支出前綴 -
    expect(formatCad(520, 'plus')).toBe('+$5.20');  // 收入前綴 +
    expect(formatCad(-520, 'none')).toBe('$5.20');
    expect(formatCad(207_400)).toBe('$2,074.00');
    expect(formatCad(0)).toBe('$0.00');           // 零不加負號
    expect(formatCad(0, 'plus')).toBe('+$0.00');  // 零 + plus 加 +
    expect(formatCad(0, 'none')).toBe('$0.00');   // 零 + none 不加號
  });

  it('formatCad 的 minus 模式：不論正負一律加 -（Minor 5，支出金額本身是正數儲存）', () => {
    expect(formatCad(520, 'minus')).toBe('-$5.20');
    expect(formatCad(-520, 'minus')).toBe('-$5.20');
    expect(formatCad(0, 'minus')).toBe('-$0.00');
  });

  it('formatCompact：≥$1000 顯示 $1.2k（§4 月曆格）', () => {
    expect(formatCompact(5_200)).toBe('$52');
    expect(formatCompact(99_900)).toBe('$999');
    expect(formatCompact(100_000)).toBe('$1.0k');
    expect(formatCompact(220_000)).toBe('$2.2k');
    expect(formatCompact(0)).toBe('');            // 沒有支出就不顯示
  });

  it('formatOriginal：CAD 顯示 CAD，其他顯示金額 + 幣別（§4）', () => {
    expect(formatOriginal(520, 'CAD')).toBe('CAD');
    expect(formatOriginal(128_000, 'TWD')).toBe('1,280 TWD');
    expect(formatOriginal(4_999, 'USD')).toBe('49.99 USD');
    expect(formatOriginal(-128_000, 'TWD')).toBe('1,280 TWD');  // 負值視為幅度
  });
});

describe('pushDigit：數字鍵盤輸入規則（§5）', () => {
  it('一般輸入', () => {
    expect(pushDigit('', '5')).toBe('5');
    expect(pushDigit('5', '2')).toBe('52');
  });

  it('小數最多兩位', () => {
    expect(pushDigit('5.2', '0')).toBe('5.20');
    expect(pushDigit('5.20', '9')).toBe('5.20');   // 第三位被擋
  });

  it('小數點只能有一個', () => {
    expect(pushDigit('5', '.')).toBe('5.');
    expect(pushDigit('5.2', '.')).toBe('5.2');
  });

  it('開頭補 0', () => {
    expect(pushDigit('', '.')).toBe('0.');
    expect(pushDigit('0', '5')).toBe('5');         // 不留前導零
    expect(pushDigit('0', '.')).toBe('0.');
  });

  it('總長上限 9 字', () => {
    expect(pushDigit('123456789', '1')).toBe('123456789');
    expect(pushDigit('12345678', '9')).toBe('123456789');
    expect(pushDigit('1234567', '.')).toBe('1234567.');  // 7 字 + 點 = 8 字
    expect(pushDigit('1234567.', '5')).toBe('1234567.5');  // 8 字 + 5 = 9 字
    expect(pushDigit('1234567.5', '5')).toBe('1234567.5');  // 已滿 9 字，無法再加
  });

  it('⌫ 退位', () => {
    expect(pushDigit('5.20', '⌫')).toBe('5.2');
    expect(pushDigit('5', '⌫')).toBe('');
    expect(pushDigit('', '⌫')).toBe('');
  });
});
