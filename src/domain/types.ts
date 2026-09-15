import type { IconKey } from '../components/Icon';

export type CategoryKind = 'expense' | 'income';
export type Currency = 'CAD' | 'TWD' | 'USD';
export type Person = '我' | '妻';
export type Dimension = 'week' | 'month' | 'year';

export type SubCategory = {
  id: string;
  name: string;
};

export type Category = {
  id: string;
  kind: CategoryKind;
  name: string;
  icon: IconKey;
  /** 整數分；kind==='income' 時一律 null（收入沒有預算） */
  budgetCents: number | null;
  /** 至少一個，不可刪成空（§11-6） */
  subs: SubCategory[];
  /** PALETTE 的索引，可超過 5，取用時取模 */
  colorSet: number;
  order: number;
  /** false = 假刪：不出現在記帳選單與預算清單，但歷史紀錄與統計不受影響 */
  active: boolean;
  /**
   * 最後一次修改的時間（epoch ms）。兩支手機逐一合併分類時較新的贏；
   * 加上這個欄位之前的分類沒有值，當成 0
   */
  updatedAt?: number;
};

export type Txn = {
  id: string;
  /** YYYY-MM-DD，本地時區 */
  date: string;
  mainId: string;
  subId: string;
  /** 寫入當下的名稱快照，只為了讓人看得懂 Sheet；顯示一律以 id 解析為準 */
  mainName: string;
  subName: string;
  /** 原幣金額，整數分 */
  amountCents: number;
  currency: Currency;
  /** 實際扣款 CAD，整數分。所有統計一律用這個欄位 */
  actualCadCents: number;
  by: Person;
  note: string;
  /** ISO 8601，新增時寫入一次，之後永不變動；§4 明細依此升冪排序 */
  createdAt: string;
  /** ISO 8601，衝突判定用 */
  updatedAt: string;
  deleted: boolean;
};

/** 半開區間 [start, end)，兩端皆為 YYYY-MM-DD */
export type Range = { start: string; end: string };
