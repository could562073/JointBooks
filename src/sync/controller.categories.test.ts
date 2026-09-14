import { describe, it, expect, vi } from 'vitest';
import { defaultCategories } from '../domain/categories';
import type { Category } from '../domain/types';
import type { SheetsClient } from '../sheets/client';
import { CATEGORIES_RANGE, REV_RANGE, SHEET } from '../sheets/ledgerSheet';
import { categoryToRows } from '../sheets/rows';
import type { CategoriesSync } from './categoriesSync';
import { createSyncController } from './controller';

let n = 0;
const MINE = defaultCategories(() => `mine-${n++}`);
const THEIRS = defaultCategories(() => `theirs-${n++}`).map((c, i) => (i === 0 ? { ...c, name: '對方改過' } : c));

/** 試算表只模擬版本戳記與配置頁的分類區；紀錄頁一直是空的 */
function setup(opts: { remote?: Category[]; rev?: string; local?: Category[]; dirty?: boolean } = {}) {
  const sheet = { rev: opts.rev ?? '', config: opts.remote ? opts.remote.flatMap(categoryToRows) : ([] as string[][]) };
  const get = vi.fn(async (_s: string, range: string) => {
    if (range === REV_RANGE) return sheet.rev ? [[sheet.rev]] : [];
    if (range === CATEGORIES_RANGE) return sheet.config.map((r) => [...r]);
    return [];
  });
  const update = vi.fn(async (_s: string, range: string, rows: string[][]) => {
    if (range === REV_RANGE) sheet.rev = rows[0]![0]!;
    if (range.startsWith(`${SHEET.config}!A2:J`)) sheet.config = rows;
  });
  const clear = vi.fn(async (_s: string, range: string) => {
    if (range === CATEGORIES_RANGE) sheet.config = [];
  });
  const client = {
    get, update, clear, append: vi.fn(async () => ({ updates: { updatedRange: 'x' } })),
  } as unknown as SheetsClient;

  const store = { local: opts.local ?? MINE, dirty: opts.dirty ?? false };
  const categories: CategoriesSync = {
    dirty: async () => store.dirty,
    local: async () => store.local,
    markPushed: async () => { store.dirty = false; },
    save: async (cs) => { store.local = [...cs]; },
  };

  let clock = 1_000;
  const ctl = createSyncController({
    client,
    tokens: { isConnected: () => true },
    spreadsheetId: () => 'S',
    localTxns: async () => [],
    saveTxns: async () => {},
    categories,
    onPulled: vi.fn(), onState: () => {}, onSynced: vi.fn(),
    isOnline: () => true,
    isVisible: () => true,
    now: () => (clock += 1),
  });
  const categoryReads = () => get.mock.calls.filter((c) => c[1] === CATEGORIES_RANGE).length;
  return { ctl, sheet, store, clear, categoryReads };
}

describe('同步控制器：分類與月預算', () => {
  it('受邀者改了分類：整批推到配置頁、改版本戳記通知對方、清掉待推標記', async () => {
    const t = setup({ local: THEIRS, dirty: true });
    await t.ctl.syncNow();
    expect(t.clear).toHaveBeenCalledWith('S', CATEGORIES_RANGE);
    expect(t.sheet.config).toEqual(THEIRS.flatMap(categoryToRows));
    expect(t.sheet.rev).not.toBe('');
    expect(t.store.dirty).toBe(false);
  });

  it('對方改過（版本戳記變了）：拉回來換掉本機的分類', async () => {
    const t = setup({ remote: THEIRS, rev: '5' });
    await t.ctl.syncNow();
    expect(t.store.local.find((c) => c.id === THEIRS[0]!.id)?.name).toBe('對方改過');
  });

  it('雲端的分類區是空的：不拿空的蓋掉本機', async () => {
    const t = setup({ local: MINE, rev: '5' });
    await t.ctl.syncNow();
    expect(t.store.local).toEqual(MINE);
  });

  it('版本戳記沒變就不再讀分類（省配額）', async () => {
    const t = setup({ remote: THEIRS, rev: '5' });
    await t.ctl.syncNow();
    const reads = t.categoryReads();
    await t.ctl.syncNow();
    expect(t.categoryReads()).toBe(reads);
  });

  it('本機有待推的修改時，不拿雲端的蓋過（最後寫入的贏）', async () => {
    const t = setup({ remote: THEIRS, rev: '5', local: MINE, dirty: true });
    await t.ctl.syncNow();
    expect(t.store.local).toEqual(MINE);
    expect(t.sheet.config).toEqual(MINE.flatMap(categoryToRows));
  });
});
