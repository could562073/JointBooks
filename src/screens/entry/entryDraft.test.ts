import { describe, it, expect } from 'vitest';
import { defaultCategories } from '../../domain/categories';
import type { Category, Txn } from '../../domain/types';
import {
  canSave, draftForNew, draftFromTxn, setKind, setMain, taxCents, toInput, totalCents,
} from './entryDraft';

let n = 0;
const CATS: Category[] = defaultCategories(() => `id-${n++}`);
const EXPENSE = CATS.filter((c) => c.kind === 'expense');
const INCOME = CATS.filter((c) => c.kind === 'income');

const NEW = () => draftForNew(CATS, '2026-09-06');

function txn(over: Partial<Txn> = {}): Txn {
  return {
    id: 't1', date: '2026-08-20',
    mainId: EXPENSE[0]!.id, subId: EXPENSE[0]!.subs[0]!.id,
    mainName: '甲', subName: '乙',
    amountCents: 1_250, currency: 'CAD', actualCadCents: 1_250,
    by: '妻', note: '原本的備註',
    createdAt: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z',
    deleted: false,
    ...over,
  };
}

describe('draftForNew', () => {
  it('預設是支出，且選中第一個支出分類與它的第一個子分類', () => {
    const d = NEW();
    expect(d.kind).toBe('expense');
    expect(d.mainId).toBe(EXPENSE[0]!.id);
    expect(d.subId).toBe(EXPENSE[0]!.subs[0]!.id);
  });

  it('日期用傳進來的選中日，不是今天', () => {
    expect(NEW().date).toBe('2026-09-06');
  });

  it('金額留空，幣別預設 CAD，鍵盤打在金額欄', () => {
    const d = NEW();
    expect(d.amount).toBe('');
    expect(d.currency).toBe('CAD');
    expect(d.field).toBe('amount');
  });
});

describe('draftFromTxn', () => {
  it('欄位帶入原值', () => {
    const d = draftFromTxn(CATS, txn());
    expect(d.amount).toBe('12.50');
    expect(d.date).toBe('2026-08-20');
    expect(d.by).toBe('妻');
    expect(d.note).toBe('原本的備註');
  });

  it('收入的紀錄帶進來時 kind 是收入', () => {
    const d = draftFromTxn(CATS, txn({ mainId: INCOME[0]!.id, subId: INCOME[0]!.subs[0]!.id }));
    expect(d.kind).toBe('income');
  });

  it('分類已被刪掉時退回支出，不會炸掉', () => {
    expect(draftFromTxn(CATS, txn({ mainId: 'gone' })).kind).toBe('expense');
  });
});

describe('setKind', () => {
  it('切到收入時主分類跟著換成收入分類', () => {
    const d = setKind(NEW(), CATS, 'income');
    expect(d.kind).toBe('income');
    expect(d.mainId).toBe(INCOME[0]!.id);
    expect(d.subId).toBe(INCOME[0]!.subs[0]!.id);
  });

  it('收入的子分類是薪資、退稅、獎金、其他', () => {
    const d = setKind(NEW(), CATS, 'income');
    const main = CATS.find((c) => c.id === d.mainId)!;
    expect(main.subs.map((s) => s.name)).toEqual(['薪資', '退稅', '獎金', '其他']);
  });

  it('切回支出會換回支出分類', () => {
    const d = setKind(setKind(NEW(), CATS, 'income'), CATS, 'expense');
    expect(d.mainId).toBe(EXPENSE[0]!.id);
  });

  it('切到同一個 kind 不動任何東西', () => {
    const d = NEW();
    expect(setKind(d, CATS, 'expense')).toBe(d);
  });

  it('金額與日期不受切換影響', () => {
    const d = setKind({ ...NEW(), amount: '12.34' }, CATS, 'income');
    expect(d.amount).toBe('12.34');
    expect(d.date).toBe('2026-09-06');
  });
});

describe('setMain', () => {
  it('換主分類時子分類移到新分類的第一個', () => {
    const target = EXPENSE[2]!;
    const d = setMain(NEW(), CATS, target.id);
    expect(d.mainId).toBe(target.id);
    expect(d.subId).toBe(target.subs[0]!.id);
  });

  it('換到不存在的分類時子分類清空，不會留下對不上的 id', () => {
    expect(setMain(NEW(), CATS, 'gone').subId).toBe('');
  });
});

describe('canSave', () => {
  it('金額 0 不給存（§5：金額為 0 時不寫入）', () => {
    expect(canSave(NEW())).toBe(false);
    expect(canSave({ ...NEW(), amount: '0' })).toBe(false);
    expect(canSave({ ...NEW(), amount: '0.00' })).toBe(false);
  });

  it('CAD 有金額就能存', () => {
    expect(canSave({ ...NEW(), amount: '12.34' })).toBe(true);
  });

  it('沒有分類不給存', () => {
    expect(canSave({ ...NEW(), amount: '12', mainId: '' })).toBe(false);
    expect(canSave({ ...NEW(), amount: '12', subId: '' })).toBe(false);
  });
});

describe('toInput', () => {
  it('CAD：實扣等於原幣金額', () => {
    const i = toInput({ ...NEW(), amount: '20.50', note: '午餐' });
    expect(i).toMatchObject({
      date: '2026-09-06', amountCents: 2050, currency: 'CAD',
      actualCadCents: 2050, by: '我', note: '午餐',
    });
  });

  it('備註留空時存空字串，不是 undefined', () => {
    expect(toInput({ ...NEW(), amount: '12' }).note).toBe('');
  });
});

describe('稅前輸入', () => {
  const draft = (amount: string, tax = '') => ({ ...NEW(), amount, tax });

  it('新增模式金額與稅都是空的', () => {
    expect(NEW().amount).toBe('');
    expect(NEW().tax).toBe('');
  });

  it('含稅合計是稅前加稅', () => {
    expect(totalCents(draft('16.75', '1.00'))).toBe(1_775);
  });

  it('沒填稅時合計就是金額', () => {
    expect(totalCents(draft('16.75'))).toBe(1_675);
  });

  // 畫面上打稅前，存進去的是實付總額：Sheet 的金額欄與所有統計的意思都不變
  it('存出去的金額是含稅合計，不是打進去的稅前', () => {
    const i = toInput(draft('16.75', '1.00'));
    expect(i.amountCents).toBe(1_775);
    expect(i.actualCadCents).toBe(1_775);
    expect(i.taxCents).toBe(100);
    expect(i.currency).toBe('CAD');
  });

  it('沒填稅時 taxCents 帶 undefined，而不是漏掉這個鍵', () => {
    const i = toInput(draft('16.75'));
    expect('taxCents' in i).toBe(true);
    expect(i.taxCents).toBeUndefined();
  });

  // 稅現在是外加的，不再是金額裡的一部分，沒有上限可言
  it('稅比金額還大也能存', () => {
    const d = draft('1.00', '50.00');
    expect(canSave(d)).toBe(true);
    expect(toInput(d).amountCents).toBe(5_100);
  });

  it('金額 0 還是存不了', () => {
    expect(canSave(draft('', '1.00'))).toBe(false);
  });

  it('收入沒有稅：打了也不算，也不會存進去', () => {
    const income = { ...setKind(NEW(), CATS, 'income'), amount: '100', tax: '5.00' };
    expect(taxCents(income)).toBe(0);
    expect(totalCents(income)).toBe(10_000);
    expect(toInput(income).taxCents).toBeUndefined();
  });

  // 收入沒有稅費欄，焦點留在那裡會變成打字沒有任何反應
  it('切到收入時焦點從稅欄收回金額欄', () => {
    const onTax = { ...NEW(), field: 'tax' as const };
    expect(setKind(onTax, CATS, 'income').field).toBe('amount');
  });
});

describe('編輯模式帶入的金額', () => {
  it('CAD 的帳：金額欄顯示稅前，稅費欄顯示稅', () => {
    const d = draftFromTxn(CATS, txn({ amountCents: 1_775, actualCadCents: 1_775, taxCents: 100 }));
    expect(d.amount).toBe('16.75');
    expect(d.tax).toBe('1.00');
  });

  it('沒有稅的帳：金額欄就是原值，稅費欄空著', () => {
    const d = draftFromTxn(CATS, txn({ amountCents: 1_250, actualCadCents: 1_250 }));
    expect(d.amount).toBe('12.50');
    expect(d.tax).toBe('');
  });

  // v1.3.0 的稅費欄在收入時也看得見，可能已經記過一筆帶稅的收入。
  // 減掉的話那筆收入會在編輯時無聲地變小
  it('帶稅的收入：金額原樣帶入，不減掉稅', () => {
    const inc = txn({
      mainId: INCOME[0]!.id, subId: INCOME[0]!.subs[0]!.id,
      amountCents: 10_000, actualCadCents: 10_000, taxCents: 500,
    });
    const d = draftFromTxn(CATS, inc);
    expect(d.kind).toBe('income');
    expect(d.amount).toBe('100.00');
    expect(d.tax).toBe('');
  });

  // 使用者裁決：舊的外幣紀錄一編輯就轉成 CAD，原幣金額不保留
  it('舊的外幣紀錄：帶入實扣 CAD，幣別變成 CAD', () => {
    const d = draftFromTxn(CATS, txn({ amountCents: 128_000, currency: 'TWD', actualCadCents: 5_800 }));
    expect(d.amount).toBe('58.00');
    expect(d.tax).toBe('');
    expect(d.currency).toBe('CAD');
  });
});
