import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../db/schema';
import { defaultCategories } from '../domain/categories';
import { ledgerRepo } from '../repo/ledgerRepo';
import { useLedger } from '../store/useLedger';
import {
  CATEGORIES_DIRTY_KEY, CATEGORIES_PREFER_LOCAL_KEY, categoriesSync, migrateCategorySync,
} from './categoriesSync';
import { setSelfPerson } from './ledgerId';

const initial = useLedger.getState();
let n = 0;
const THEIRS = defaultCategories(() => `theirs-${n++}`);

beforeEach(async () => {
  await resetDb();
  useLedger.setState(initial, true);
  await ledgerRepo.bootstrap();
});

const flag = async (key: string) => (await ledgerRepo.getMeta<boolean>(key)) === true;

describe('分類的同步標記', () => {
  it('在 App 裡改分類、刪分類都會標成待推，並記下修改時間', async () => {
    await useLedger.getState().load();
    expect(await categoriesSync.dirty()).toBe(false);

    const first = useLedger.getState().categories[0]!;
    await useLedger.getState().saveCategory({ ...first, name: '改過的名字' });
    expect(await categoriesSync.dirty()).toBe(true);
    expect(useLedger.getState().categories[0]!.updatedAt).toBeGreaterThan(0);

    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, false);
    const second = useLedger.getState().categories[1]!;
    await useLedger.getState().deleteCategory(second.id);
    expect(await categoriesSync.dirty()).toBe(true);
    expect(useLedger.getState().categories.find((c) => c.id === second.id)!.updatedAt).toBeGreaterThan(0);
  });

  it('按了 ✓ 但內容沒變：不算修改，不標待推也不改修改時間（使用者回報舊的蓋掉對方的）', async () => {
    await useLedger.getState().load();
    const first = useLedger.getState().categories[0]!;
    await useLedger.getState().saveCategory({ ...first });
    expect(await categoriesSync.dirty()).toBe(false);
    expect(useLedger.getState().categories[0]!.updatedAt).toBeUndefined();
  });

  it('合併完、本機這段時間沒再改：存入合併結果並清掉標記', async () => {
    const read = await ledgerRepo.listCategories();
    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, true);
    await categoriesSync.settle(read, THEIRS);
    expect((await ledgerRepo.listCategories()).map((c) => c.id).sort()).toEqual(THEIRS.map((c) => c.id).sort());
    expect(await categoriesSync.dirty()).toBe(false);
  });

  it('合併途中本機又改了：不存、標記留著，下一輪再合併', async () => {
    const read = await ledgerRepo.listCategories();
    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, true);
    await ledgerRepo.saveCategory({ ...read[0]!, name: '途中又改', updatedAt: 5 });
    await categoriesSync.settle(read, THEIRS);
    expect((await ledgerRepo.listCategories()).map((c) => c.id)).toEqual(read.map((c) => c.id));
    expect(await categoriesSync.dirty()).toBe(true);
  });

  it('合併結果跟本機一樣（null）：只清標記', async () => {
    const read = await ledgerRepo.listCategories();
    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, true);
    await categoriesSync.settle(read, null);
    expect(await ledgerRepo.listCategories()).toEqual(read);
    expect(await categoriesSync.dirty()).toBe(false);
  });
});

describe('升到逐一合併分類的版本（只跑一次）', () => {
  it('受邀者的手機：第一次合併以本機為準，之前改的分類推得上去', async () => {
    await setSelfPerson('妻');
    await migrateCategorySync();
    expect(await categoriesSync.preferLocal()).toBe(true);
    expect(await categoriesSync.dirty()).toBe(true);
  });

  it('建立帳本、沒有待推修改的那台：照常以雲端為準', async () => {
    await migrateCategorySync();
    expect(await categoriesSync.preferLocal()).toBe(false);
    expect(await categoriesSync.dirty()).toBe(false);
  });

  it('建立帳本的那台還有沒推的修改：也以本機為準', async () => {
    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, true);
    await migrateCategorySync();
    expect(await flag(CATEGORIES_PREFER_LOCAL_KEY)).toBe(true);
  });

  it('只跑一次：合併完清掉的標記不會再被設回來', async () => {
    await setSelfPerson('妻');
    await migrateCategorySync();
    await categoriesSync.settle(await ledgerRepo.listCategories(), null);
    await migrateCategorySync();
    expect(await categoriesSync.preferLocal()).toBe(false);
    expect(await categoriesSync.dirty()).toBe(false);
  });
});
