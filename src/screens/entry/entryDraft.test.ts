import { describe, it, expect } from 'vitest';
import { defaultCategories } from '../../domain/categories';
import type { Category, Txn } from '../../domain/types';
import {
  actualCadCents, canSave, draftForNew, draftFromTxn, needsCadField, preTaxCents,
  setCurrency, setKind, setMain, taxCents, taxError, toInput,
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

  it('外幣的紀錄帶入實扣金額', () => {
    const d = draftFromTxn(CATS, txn({ amountCents: 128_000, currency: 'TWD', actualCadCents: 5_800 }));
    expect(d.amount).toBe('1280.00');
    expect(d.cad).toBe('58.00');
  });

  it('CAD 的紀錄不帶實扣欄位，免得切到外幣時看到來路不明的數字', () => {
    expect(draftFromTxn(CATS, txn()).cad).toBe('');
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

describe('幣別與實扣 CAD', () => {
  it('CAD 時不出現實扣欄位，實扣就等於原幣金額', () => {
    const d = { ...NEW(), amount: '20.50' };
    expect(needsCadField(d)).toBe(false);
    expect(actualCadCents(d)).toBe(2050);
  });

  it('非 CAD 時才出現實扣欄位，且實扣用使用者填的數字', () => {
    const d = setCurrency({ ...NEW(), amount: '1280' }, 'TWD');
    expect(needsCadField(d)).toBe(true);
    expect(actualCadCents({ ...d, cad: '58' })).toBe(5800);
  });

  it('切回 CAD 會清掉實扣欄位並把鍵盤焦點收回金額欄', () => {
    const foreign = { ...setCurrency(NEW(), 'USD'), cad: '58', field: 'cad' as const };
    const back = setCurrency(foreign, 'CAD');
    expect(back.cad).toBe('');
    expect(back.field).toBe('amount');
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

  it('外幣沒填實扣不給存，否則統計上會是一筆零元', () => {
    const d = setCurrency({ ...NEW(), amount: '1280' }, 'TWD');
    expect(canSave(d)).toBe(false);
    expect(canSave({ ...d, cad: '58' })).toBe(true);
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

  it('外幣：原幣與實扣各自獨立', () => {
    const d = setCurrency({ ...NEW(), amount: '1280' }, 'TWD');
    const i = toInput({ ...d, cad: '58' });
    expect(i.amountCents).toBe(128_000);
    expect(i.actualCadCents).toBe(5_800);
  });

  it('備註留空時存空字串，不是 undefined', () => {
    expect(toInput({ ...NEW(), amount: '12' }).note).toBe('');
  });
});

describe('其中稅', () => {
  const withTax = (tax: string, amount = '48.72') => ({ ...NEW(), amount, tax });

  it('新增模式預設沒有稅', () => {
    expect(NEW().tax).toBe('');
    expect(taxCents(NEW())).toBe(0);
  });

  it('稅前是金額減稅', () => {
    expect(preTaxCents(withTax('2.85'))).toBe(4_587);
  });

  it('沒填稅時沒有稅前可以顯示', () => {
    expect(preTaxCents(withTax(''))).toBeNull();
  });

  it('金額還沒打時也沒有稅前', () => {
    expect(preTaxCents(withTax('2.85', ''))).toBeNull();
  });

  it('稅剛好等於金額是合法的（整筆都是押金之類）', () => {
    const d = withTax('48.72');
    expect(taxError(d)).toBeNull();
    expect(canSave(d)).toBe(true);
    expect(preTaxCents(d)).toBe(0);
  });

  it('稅大於金額：擋下儲存並給訊息', () => {
    const d = withTax('50.00');
    expect(taxError(d)).toBe('稅不能大於金額');
    expect(canSave(d)).toBe(false);
  });

  // 錯誤狀態下那個數字沒有意義；顯示負數或絕對值都會誤導
  it('稅大於金額時沒有稅前可以顯示', () => {
    expect(preTaxCents(withTax('50.00'))).toBeNull();
  });

  // 先點稅欄、金額還沒打時亮紅字只是噪音；存不存得了本來就由金額 0 那條規則決定
  it('金額還沒打時不報稅的錯，但也還是存不了', () => {
    const d = withTax('2.85', '');
    expect(taxError(d)).toBeNull();
    expect(canSave(d)).toBe(false);
  });

  it('toInput 有稅時帶整數分', () => {
    expect(toInput(withTax('2.85')).taxCents).toBe(285);
  });

  // 編輯一筆本來有稅的帳、把稅刪掉時，patch 一定要含這個鍵，否則舊值會留著
  it('toInput 沒稅時帶 undefined，而不是漏掉這個鍵', () => {
    const i = toInput(withTax(''));
    expect('taxCents' in i).toBe(true);
    expect(i.taxCents).toBeUndefined();
  });

  it('編輯模式把稅帶回字串', () => {
    expect(draftFromTxn(CATS, txn({ taxCents: 285 })).tax).toBe('2.85');
  });

  it('沒有稅的舊帳帶回空字串，不是 0', () => {
    expect(draftFromTxn(CATS, txn()).tax).toBe('');
  });

  // 換幣別本來就要重打金額，稅留著讓使用者自己改比清掉少一次意外
  it('換幣別不清掉稅', () => {
    expect(setCurrency(withTax('2.85'), 'USD').tax).toBe('2.85');
    expect(setCurrency({ ...withTax('2.85'), currency: 'USD' }, 'CAD').tax).toBe('2.85');
  });

  it('切回 CAD 時焦點在稅欄就留在稅欄，只有停在實扣欄才收回金額', () => {
    const onTax = { ...withTax('2.85'), currency: 'USD' as const, field: 'tax' as const };
    expect(setCurrency(onTax, 'CAD').field).toBe('tax');
    const onCad = { ...withTax('2.85'), currency: 'USD' as const, field: 'cad' as const };
    expect(setCurrency(onCad, 'CAD').field).toBe('amount');
  });
});
