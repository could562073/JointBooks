import { selectable } from '../../domain/categories';
import type { Category, CategoryKind, Currency, Person, Txn } from '../../domain/types';
import type { NewTxnInput } from '../../repo/ledgerRepo';
import { toCents } from '../../domain/money';
import { centsToInput } from './amountInput';

/** 數字鍵盤打在哪一個欄位上（§5：兩個欄位共用同一組鍵盤） */
export type AmountField = 'amount' | 'tax';

export type EntryDraft = {
  kind: CategoryKind;
  /** 稅前金額的顯示字串。加拿大的標價本來就不含稅，使用者手上拿著的就是這個數字 */
  amount: string;
  /** 稅費的顯示字串，可不填。外加在金額上，不是金額的一部分 */
  tax: string;
  /**
   * 一律 'CAD'。多幣別的介面已經拿掉（使用者：目前只用得到 CAD），但資料層完整保留，
   * 以後要加回來不必動 Sheet、也不必 migration
   */
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
    amount: '', tax: '',
    currency: 'CAD',
    ...firstOf(cats, 'expense'),
    date, by, note: '',
    field: 'amount',
  };
}

/**
 * 編輯模式金額欄要顯示的分。存進去的是含稅合計，畫面上要顯示的是稅前。
 *
 * 三種情況分開處理：
 * - 收入：原樣。v1.3.0 的稅費欄在收入時也看得見，可能已經有一筆帶稅的收入，
 *   減掉的話那筆收入會在編輯時無聲地變小。
 * - 舊的外幣紀錄：顯示實際扣款的 CAD。原幣金額不再出現在畫面上，存檔後也不保留。
 * - 其餘：合計扣掉稅就是稅前。
 */
function editableAmountCents(kind: CategoryKind, t: Txn): number {
  if (kind === 'income') return t.amountCents;
  if (t.currency !== 'CAD') return t.actualCadCents;
  return t.amountCents - (t.taxCents ?? 0);
}

/** §5 編輯模式：欄位帶入原值 */
export function draftFromTxn(cats: Category[], t: Txn): EntryDraft {
  const kind = cats.find((c) => c.id === t.mainId)?.kind ?? 'expense';
  const hasTax = kind === 'expense' && t.currency === 'CAD' && !!t.taxCents;
  return {
    kind,
    amount: centsToInput(editableAmountCents(kind, t)),
    tax: hasTax ? centsToInput(t.taxCents!) : '',
    // 一律帶 CAD：舊的外幣紀錄一存檔就完成轉換（使用者裁決：原幣不保留）
    currency: 'CAD',
    mainId: t.mainId, subId: t.subId,
    date: t.date, by: t.by, note: t.note,
    field: 'amount',
  };
}

/**
 * 切換支出／收入。主分類必須跟著換成該類別的第一個——留著原本那顆的話，
 * 面板會顯示一個不在 chip 清單裡的選取狀態，存下去也會讓 kind 與分類不一致。
 *
 * 切到收入時焦點也要收回金額欄：收入沒有稅費欄，焦點留在那裡會變成打字沒有任何反應。
 */
export function setKind(d: EntryDraft, cats: Category[], kind: CategoryKind): EntryDraft {
  if (kind === d.kind) return d;
  return {
    ...d, kind, ...firstOf(cats, kind),
    field: kind === 'income' ? 'amount' : d.field,
  };
}

/** 換主分類要一併把子分類移到新主分類的第一個，舊的 subId 在新分類裡不存在 */
export function setMain(d: EntryDraft, cats: Category[], mainId: string): EntryDraft {
  const main = cats.find((c) => c.id === mainId);
  return { ...d, mainId, subId: main?.subs[0]?.id ?? '' };
}

/** 稅費的分。收入沒有稅——擋在這一個地方，卡片、合計與儲存全部跟著對 */
export function taxCents(d: EntryDraft): number {
  return d.kind === 'income' ? 0 : toCents(d.tax);
}

/** 含稅合計＝稅前＋稅。存進去的 amountCents 就是這個數字 */
export function totalCents(d: EntryDraft): number {
  return toCents(d.amount) + taxCents(d);
}

/**
 * §5：金額為 0 時不寫入。
 * 稅是外加的，沒有上限，也不參與這個判斷——稅打得比金額大是合法的
 * （例如只買了一個押金品項）。
 */
export function canSave(d: EntryDraft): boolean {
  if (!d.mainId || !d.subId) return false;
  return toCents(d.amount) !== 0;
}

export function toInput(d: EntryDraft): NewTxnInput {
  const total = totalCents(d);
  return {
    date: d.date,
    mainId: d.mainId,
    subId: d.subId,
    // 畫面上打稅前，存進去的是實付總額：Sheet 的金額欄、年報表的 SUMIFS 與所有統計的意思都不變
    amountCents: total,
    currency: 'CAD',
    actualCadCents: total,
    by: d.by,
    note: d.note,
    // 一定要帶這個鍵：編輯時把稅刪掉，patch 少了它舊值就會留著
    taxCents: taxCents(d) || undefined,
  };
}
