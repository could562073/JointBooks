import { selectable } from '../../domain/categories';
import type { Category, CategoryKind, Currency, Person, Txn } from '../../domain/types';
import type { NewTxnInput } from '../../repo/ledgerRepo';
import { toCents } from '../../domain/money';
import { centsToInput } from './amountInput';

/** 數字鍵盤打在哪一個欄位上（§5：這些欄位共用同一組鍵盤） */
export type AmountField = 'amount' | 'cad' | 'tax';

export type EntryDraft = {
  kind: CategoryKind;
  /** 原幣金額的顯示字串 */
  amount: string;
  /** 實扣 CAD 的顯示字串；currency === 'CAD' 時用不到 */
  cad: string;
  /** 其中稅的顯示字串，可不填。跟 amount 同一個幣別 */
  tax: string;
  currency: Currency;
  mainId: string;
  subId: string;
  /** YYYY-MM-DD。§5：儲存寫入的是這裡選的日期，不是月曆上的選中日 */
  date: string;
  by: Person;
  note: string;
  field: AmountField;
};

/** 該分類清單裡第一個可選的主分類與它的第一個子分類 */
function firstOf(cats: Category[], kind: CategoryKind): { mainId: string; subId: string } {
  const main = selectable(cats, kind)[0];
  return { mainId: main?.id ?? '', subId: main?.subs[0]?.id ?? '' };
}

/**
 * §5 新增模式。日期預設為月曆上選中那天，不是今天——使用者剛剛才在月曆上
 * 挑了一天，這時候跳回今天等於把他的選擇丟掉。
 */
export function draftForNew(cats: Category[], date: string, by: Person = '我'): EntryDraft {
  return {
    kind: 'expense',
    amount: '', cad: '', tax: '',
    currency: 'CAD',
    ...firstOf(cats, 'expense'),
    date, by, note: '',
    field: 'amount',
  };
}

/** §5 編輯模式：欄位帶入原值 */
export function draftFromTxn(cats: Category[], t: Txn): EntryDraft {
  const kind = cats.find((c) => c.id === t.mainId)?.kind ?? 'expense';
  return {
    kind,
    amount: centsToInput(t.amountCents),
    // CAD 的紀錄沒有獨立的實扣欄位，帶空字串免得切到外幣時看到一個來路不明的數字
    cad: t.currency === 'CAD' ? '' : centsToInput(t.actualCadCents),
    // 沒有稅的舊帳帶成空字串，不要憑空生一個 0
    tax: t.taxCents ? centsToInput(t.taxCents) : '',
    currency: t.currency,
    mainId: t.mainId, subId: t.subId,
    date: t.date, by: t.by, note: t.note,
    field: 'amount',
  };
}

/**
 * 切換支出／收入。主分類必須跟著換成該類別的第一個——留著原本那顆的話，
 * 面板會顯示一個不在 chip 清單裡的選取狀態，存下去也會讓 kind 與分類不一致。
 */
export function setKind(d: EntryDraft, cats: Category[], kind: CategoryKind): EntryDraft {
  if (kind === d.kind) return d;
  return { ...d, kind, ...firstOf(cats, kind) };
}

/** 換主分類要一併把子分類移到新主分類的第一個，舊的 subId 在新分類裡不存在 */
export function setMain(d: EntryDraft, cats: Category[], mainId: string): EntryDraft {
  const main = cats.find((c) => c.id === mainId);
  return { ...d, mainId, subId: main?.subs[0]?.id ?? '' };
}

/**
 * 換幣別。切回 CAD 時把實扣欄位清掉——CAD 模式下它不存在，焦點留在上面會變成
 * 打字沒有任何反應。稅不清：稅跟著金額的幣別走，換幣別本來就要重打金額，
 * 稅留著讓使用者自己改比清掉少一次意外。
 */
export function setCurrency(d: EntryDraft, currency: Currency): EntryDraft {
  if (currency === 'CAD') {
    return { ...d, currency, cad: '', field: d.field === 'cad' ? 'amount' : d.field };
  }
  return { ...d, currency };
}

/** §5：非 CAD 時才出現「實際扣款 CAD」欄位 */
export function needsCadField(d: EntryDraft): boolean {
  return d.currency !== 'CAD';
}

/**
 * 實扣 CAD 的分。CAD 的紀錄直接等於原幣金額（§5：主幣別 CAD · 直接記錄），
 * 外幣則用使用者填的實扣數字；沒填就是 0，由 canSave 擋下。
 */
export function actualCadCents(d: EntryDraft): number {
  return d.currency === 'CAD' ? toCents(d.amount) : toCents(d.cad);
}

/** 其中稅的分。沒填就是 0 */
export function taxCents(d: EntryDraft): number {
  return toCents(d.tax);
}

/**
 * 扣掉稅之後的金額，給面板顯示用，不存。沒填稅、或金額還沒打時回 null：
 * 這時候顯示「稅前 $0.00」只是噪音。
 */
export function preTaxCents(d: EntryDraft): number | null {
  const amount = toCents(d.amount);
  const tax = taxCents(d);
  if (amount === 0 || tax === 0) return null;
  return amount - tax;
}

/**
 * 稅欄的錯誤訊息；沒問題回 null。
 *
 * 金額還沒打時一律不報錯：使用者可能先點稅欄，這時候亮「稅不能大於金額」是
 * 噪音不是資訊。儲存還是會被擋下來——canSave 本來就不讓金額 0 的帳寫入。
 */
export function taxError(d: EntryDraft): string | null {
  const amount = toCents(d.amount);
  if (amount === 0) return null;
  return taxCents(d) > amount ? '稅不能大於金額' : null;
}

/**
 * §5：金額為 0 時不寫入。外幣還要求實扣也不是 0，否則會存進一筆
 * 在所有統計裡都等於零的紀錄（統計一律用 actualCadCents）。
 */
export function canSave(d: EntryDraft): boolean {
  if (!d.mainId || !d.subId) return false;
  if (toCents(d.amount) === 0) return false;
  if (taxError(d)) return false;
  return actualCadCents(d) !== 0;
}

export function toInput(d: EntryDraft): NewTxnInput {
  return {
    date: d.date,
    mainId: d.mainId,
    subId: d.subId,
    amountCents: toCents(d.amount),
    currency: d.currency,
    actualCadCents: actualCadCents(d),
    by: d.by,
    note: d.note,
    // 一定要帶這個鍵：編輯時把稅刪掉，patch 少了它舊值就會留著
    taxCents: taxCents(d) || undefined,
  };
}
