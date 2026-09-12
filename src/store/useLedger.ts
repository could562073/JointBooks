import { create } from 'zustand';
import { ledgerRepo, type NewTxnInput } from '../repo/ledgerRepo';
import { addMonths, clampDay, todayLocal, parseDate } from '../domain/date';
import type { Category, Dimension, Txn } from '../domain/types';
import type { SyncState } from '../sync/state';

export type Tab = 'daily' | 'stats' | 'settings';

/** §7.3 兩個開關持久化到 meta 表用的 key（I9） */
const SHOW_WHO_TAGS_KEY = 'showWhoTags';
const NOTIFY_ON_PARTNER_ENTRY_KEY = 'notifyOnPartnerEntry';

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
  /** §14.6 的同步狀態機，直接餵給 MOTION #26 的狀態點 */
  syncState: SyncState;
  lastSyncAt: number | null;

  load(): Promise<void>;
  setSyncState(s: SyncState): void;
  markSynced(at?: number): void;
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
  toggleWhoTags(): Promise<void>;
  toggleNotify(): Promise<void>;
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
  syncState: 'idle',
  lastSyncAt: null,

  setSyncState(syncState) { set({ syncState }); },

  markSynced(at = Date.now()) { set({ syncState: 'synced', lastSyncAt: at }); },

  async load() {
    await ledgerRepo.bootstrap();
    const [categories, txns, showWhoTags, notifyOnPartnerEntry] = await Promise.all([
      ledgerRepo.listCategories(),
      ledgerRepo.listTxns(),
      ledgerRepo.getMeta<boolean>(SHOW_WHO_TAGS_KEY),
      ledgerRepo.getMeta<boolean>(NOTIFY_ON_PARTNER_ENTRY_KEY),
    ]);
    set({
      categories, txns, ready: true,
      // §7.3：兩個開關預設開啟；讀不到（第一次啟動）就維持預設值
      showWhoTags: showWhoTags ?? true,
      notifyOnPartnerEntry: notifyOnPartnerEntry ?? true,
    });
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

  /** §7.3：切換後立即反映在畫面，並持久化到 meta，下次啟動仍記得（I9） */
  async toggleWhoTags() {
    const next = !get().showWhoTags;
    set({ showWhoTags: next });
    await ledgerRepo.setMeta(SHOW_WHO_TAGS_KEY, next);
  },
  async toggleNotify() {
    const next = !get().notifyOnPartnerEntry;
    set({ notifyOnPartnerEntry: next });
    await ledgerRepo.setMeta(NOTIFY_ON_PARTNER_ENTRY_KEY, next);
  },
}));

export function selectedDate(s: LedgerState): string {
  return `${s.year}-${String(s.month + 1).padStart(2, '0')}-${String(s.selectedDay).padStart(2, '0')}`;
}
