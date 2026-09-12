import { describe, it, expect } from 'vitest';
import { fromCents, MAX_LEN, pressKey, toCents } from './amountInput';

/** 連續按一串鍵，方便描述一段真實的輸入過程 */
function type(keys: string): string {
  return [...keys].reduce<string>((s, k) => pressKey(s, k as never), '');
}

describe('pressKey 的數字', () => {
  it('依序接上去', () => {
    expect(type('123')).toBe('123');
  });

  it('總長最多 9 字，滿了就不再吃鍵', () => {
    const full = type('123456789');
    expect(full).toHaveLength(MAX_LEN);
    expect(pressKey(full, '0')).toBe(full);
  });
});

describe('pressKey 的小數點', () => {
  it('第二個小數點沒有作用', () => {
    expect(type('12.3')).toBe('12.3');
    expect(pressKey('12.3', '.')).toBe('12.3');
  });

  it('小數最多兩位，第三位吃不進去', () => {
    expect(type('1.23')).toBe('1.23');
    expect(pressKey('1.23', '4')).toBe('1.23');
  });

  it('一開始就按小數點會得到 .（原型行為，不自動補 0）', () => {
    expect(type('.5')).toBe('.5');
  });
});

describe('pressKey 的 ⌫', () => {
  it('去掉最後一個字', () => {
    expect(pressKey('123', 'back')).toBe('12');
    expect(pressKey('1.2', 'back')).toBe('1.');
  });

  it('空字串按 ⌫ 還是空字串，不會變成 undefined', () => {
    expect(pressKey('', 'back')).toBe('');
  });

  it('刪掉小數點之後又可以再按一次小數點', () => {
    const s = pressKey('1.2', 'back');       // '1.'
    const t = pressKey(s, 'back');           // '1'
    expect(pressKey(t, '.')).toBe('1.');
  });
});

describe('toCents', () => {
  it('整數與兩位小數', () => {
    expect(toCents('12')).toBe(1200);
    expect(toCents('12.5')).toBe(1250);
    expect(toCents('12.34')).toBe(1234);
  });

  it('19.99 不會因為浮點數變成 1998', () => {
    expect(toCents('19.99')).toBe(1999);
    expect(toCents('0.07')).toBe(7);
    expect(toCents('1.10')).toBe(110);
  });

  it('空字串、單一小數點都是 0（§5：金額 0 時不寫入）', () => {
    expect(toCents('')).toBe(0);
    expect(toCents('.')).toBe(0);
  });

  it('前導零與省略整數位都讀得出來', () => {
    expect(toCents('007')).toBe(700);
    expect(toCents('.5')).toBe(50);
  });
});

describe('fromCents', () => {
  it('補滿兩位小數', () => {
    expect(fromCents(1234)).toBe('12.34');
    expect(fromCents(1250)).toBe('12.50');
    expect(fromCents(7)).toBe('0.07');
  });

  it('0 給空字串，讓欄位顯示 placeholder', () => {
    expect(fromCents(0)).toBe('');
  });

  it('跟 toCents 對得起來（編輯模式帶入原值不會走樣）', () => {
    for (const c of [1, 7, 99, 100, 1999, 205_000]) {
      expect(toCents(fromCents(c))).toBe(c);
    }
  });
});
