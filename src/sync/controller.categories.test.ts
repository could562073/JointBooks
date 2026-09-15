import { describe, it, expect, vi } from 'vitest';
import { defaultCategories } from '../domain/categories';
import type { Category } from '../domain/types';
import type { SheetsClient } from '../sheets/client';
import { CATEGORIES_RANGE, REV_RANGE, SHEET } from '../sheets/ledgerSheet';
import { categoryToRows } from '../sheets/rows';
import type { CategoriesSync } from './categoriesSync';
import { createSyncController } from './controller';

let n = 0;
/** 加入時兩支手機拿到的是同一份分類（id 相同） */
const BASE = defaultCategories(() => `c-${n++}`);
const swap = (cs: readonly Category[], next: Category) => cs.map((c) => (c.id === next.id ? next : c));
const find = (cs: readonly Category[], id: string) => cs.find((c) => c.id === id)!;
/** 對方改過第一個分類的名稱 */
const THEIRS = swap(BASE, { ...BASE[0]!, name: '對方改過', updatedAt: 100 });

/** 試算表只模擬版本戳記與配置頁的分類區；紀錄頁一直是空的 */
function setup(opts: { remote?: Category[]; rev?: string; local?: Category[]; dirty?: boolean; preferLocal?: boolean } = {}) {
  const sheet = { rev: opts.rev ?? '', config: opts.remote ? opts.remote.flatMap(categoryToRows) : ([] as string[][]) };
  const get = vi.fn(async (_s: string, range: string) => {
    if (range === REV_RANGE) return sheet.rev ? [[sheet.rev]] : [];
    if (range === CATEGORIES_RANGE) return sheet.config.map((r) => [...r]);
    return [];
  });
  const update = vi.fn(async (_s: string, range: string, rows: string[][]) => {
    if (range === REV_RANGE) sheet.rev = rows[0]![0]!;
    if (range.startsWith(`${SHEET.config}!A2:K`)) sheet.config = rows;
  });
  const clear = vi.fn(async (_s: string, range: string) => {
    if (range === CATEGORIES_RANGE) sheet.config = [];
  });
  const client = {
    get, update, clear, append: vi.fn(async () => ({ updates: { updatedRange: 'x' } })),
  } as unknown as SheetsClient;

  const store = { local: opts.local ?? BASE, dirty: opts.dirty ?? false, preferLocal: opts.preferLocal ?? false };
  const categories: CategoriesSync = {
    dirty: async () => store.dirty,
    local: async () => store.local,
    preferLocal: async () => store.preferLocal,
    settle: async (_read, merged) => {
      if (merged) store.local = [...merged];
      store.dirty = false;
      store.preferLocal = false;
    },
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
  const remoteNow = () => sheet.config;
  return { ctl, sheet, store, clear, categoryReads, remoteNow };
}

describe('同步控制器：分類與月預算', () => {
  it('受邀者改了分類：合併後寫回配置頁、改版本戳記通知對方、清掉待推標記', async () => {
    const mine = swap(BASE, { ...BASE[2]!, budgetCents: 99_000, updatedAt: 200 });
    const t = setup({ remote: BASE, rev: '5', local: mine, dirty: true });
    await t.ctl.syncNow();
    expect(t.clear).toHaveBeenCalledWith('S', CATEGORIES_RANGE);
    expect(t.remoteNow()).toEqual(mine.flatMap(categoryToRows));
    expect(t.sheet.rev).not.toBe('5');
    expect(t.store.dirty).toBe(false);
  });

  it('對方改過（版本戳記變了）：拉回來換掉本機的分類', async () => {
    const t = setup({ remote: THEIRS, rev: '5' });
    await t.ctl.syncNow();
    expect(find(t.store.local, BASE[0]!.id).name).toBe('對方改過');
  });

  it('這支手機手上是舊的、又按了一次存檔：蓋不掉雲端較新的修改（使用者回報）', async () => {
    const t = setup({ remote: THEIRS, rev: '5', local: BASE, dirty: true });
    await t.ctl.syncNow();
    expect(find(t.store.local, BASE[0]!.id).name).toBe('對方改過');
    expect(t.remoteNow()).toEqual(THEIRS.flatMap(categoryToRows));
    expect(t.clear).not.toHaveBeenCalled();
    expect(t.sheet.rev).toBe('5');   // 沒有東西要推，不必叫對方來拉
  });

  it('兩邊各改不同的分類：兩個修改都留下，雲端與本機一致', async () => {
    const mine = swap(BASE, { ...BASE[2]!, icon: BASE[3]!.icon, updatedAt: 200 });
    const t = setup({ remote: THEIRS, rev: '5', local: mine, dirty: true });
    await t.ctl.syncNow();
    expect(find(t.store.local, BASE[0]!.id).name).toBe('對方改過');
    expect(find(t.store.local, BASE[2]!.id).icon).toBe(BASE[3]!.icon);
    expect(t.remoteNow()).toEqual(t.store.local.flatMap(categoryToRows));
  });

  it('雲端的分類區是空的：不拿空的蓋掉本機，把本機的寫回去', async () => {
    const t = setup({ local: BASE, rev: '5' });
    await t.ctl.syncNow();
    expect(t.store.local).toEqual(BASE);
    expect(t.remoteNow()).toEqual(BASE.flatMap(categoryToRows));
  });

  it('版本戳記沒變、本機也沒改就不再讀分類（省配額）', async () => {
    const t = setup({ remote: THEIRS, rev: '5' });
    await t.ctl.syncNow();
    const reads = t.categoryReads();
    await t.ctl.syncNow();
    expect(t.categoryReads()).toBe(reads);
  });

  it('升級後受邀者第一次合併：兩邊都沒有修改時間時留本機改的，推上去', async () => {
    const mine = swap(BASE, { ...BASE[0]!, name: '她之前改的' });
    const t = setup({ remote: BASE, rev: '5', local: mine, dirty: true, preferLocal: true });
    await t.ctl.syncNow();
    expect(find(t.store.local, BASE[0]!.id).name).toBe('她之前改的');
    expect(t.remoteNow()).toEqual(mine.flatMap(categoryToRows));
    expect(t.store.preferLocal).toBe(false);
  });
});
