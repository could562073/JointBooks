import { create } from 'zustand';
import { ledgerRepo, type NewTxnInput } from '../repo/ledgerRepo';
import { addMonths, clampDay, todayLocal, parseDate } from '../domain/date';
import type { Category, Dimension, Txn } from '../domain/types';

export type Tab = 'daily' | 'stats' | 'settings';

export type LedgerState = {
  ready: boolean;
  tab: Tab;
  year: number;
  month: number;
  selectedDay: number;
  dimension: Dimension;
  categories: Category[];
  txns: Txn[];
  showWhoTags: boolean;
  notifyOnPartnerEntry: boolean;

  load(): Promise<void>;
  setTab(t: Tab): void;
  goMonth(delta: number): void;
  setMonth(y: number, m: number): void;
  selectDay(day: number): void;
  setDimension(d: Dimension): void;
  addTxn(i: NewTxnInput): Promise<void>;
  updateTxn(id: string, p: Partial<NewTxnInput>): Promise<void>;
  deleteTxn(id: string): Promise<void>;
  saveCategory(c: Category): Promise<void>;
  deleteCategory(id: string): Promise<void>;
  toggleWhoTags(): void;
  toggleNotify(): void;
};

const now = parseDate(todayLocal());

export const useLedger = create<LedgerState>((set, get) => ({
  ready: false,
  tab: 'daily',
  year: now.getFullYear(),
  month: now.getMonth(),
  selectedDay: now.getDate(),
  dimension: 'month',
  categories: [],
  txns: [],
  showWhoTags: true,
  notifyOnPartnerEntry: true,

  async load() {
    await ledgerRepo.bootstrap();
    const [categories, txns] = await Promise.all([
      ledgerRepo.listCategories(),
      ledgerRepo.listTxns(),
    ]);
    set({ categories, txns, ready: true });
  },

  setTab(tab) { set({ tab }); },

  /** §4：跨年要正確進退；選中日自動夾到該月最後一天 */
  goMonth(delta) {
    const { year, month, selectedDay } = get();
    const next = addMonths(year, month, delta);
    set({ year: next.y, month: next.m, selectedDay: clampDay(next.y, next.m, selectedDay) });
  },

  /** §15.1-4：年月選擇器選到 2 月時，原本的 31 日要夾成 28 */
  setMonth(y, m) {
    set({ year: y, month: m, selectedDay: clampDay(y, m, get().selectedDay) });
  },

  selectDay(day) {
    const { year, month } = get();
    set({ selectedDay: clampDay(year, month, day) });
  },

  setDimension(dimension) { set({ dimension }); },

  async addTxn(input) {
    const t = await ledgerRepo.addTxn(input);
    if (!t) return;                                  // 金額 0，不寫入
    set({ txns: [...get().txns, t] });
  },

  async updateTxn(id, patch) {
    const t = await ledgerRepo.updateTxn(id, patch);
    set({ txns: get().txns.map((x) => (x.id === id ? t : x)) });
  },

  async deleteTxn(id) {
    await ledgerRepo.deleteTxn(id);
    set({ txns: get().txns.filter((x) => x.id !== id) });
  },

  async saveCategory(c) {
    await ledgerRepo.saveCategory(c);
    set({ categories: await ledgerRepo.listCategories() });
  },

  async deleteCategory(id) {
    await ledgerRepo.deleteCategory(id);
    set({ categories: await ledgerRepo.listCategories() });
  },

  toggleWhoTags() { set({ showWhoTags: !get().showWhoTags }); },
  toggleNotify() { set({ notifyOnPartnerEntry: !get().notifyOnPartnerEntry }); },
}));

export function selectedDate(s: LedgerState): string {
  return `${s.year}-${String(s.month + 1).padStart(2, '0')}-${String(s.selectedDay).padStart(2, '0')}`;
}
