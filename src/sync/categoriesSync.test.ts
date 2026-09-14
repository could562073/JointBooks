import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../db/schema';
import { defaultCategories } from '../domain/categories';
import { ledgerRepo } from '../repo/ledgerRepo';
import { useLedger } from '../store/useLedger';
import { CATEGORIES_DIRTY_KEY, categoriesSync, migrateCategorySync } from './categoriesSync';
import { setSelfPerson } from './ledgerId';

const initial = useLedger.getState();
let n = 0;
const THEIRS = defaultCategories(() => `theirs-${n++}`);

beforeEach(async () => {
  await resetDb();
  useLedger.setState(initial, true);
  await ledgerRepo.bootstrap();
});

describe('分類的同步標記', () => {
  it('在 App 裡改分類、刪分類都會標成待推', async () => {
    await useLedger.getState().load();
    expect(await categoriesSync.dirty()).toBe(false);

    const first = useLedger.getState().categories[0]!;
    await useLedger.getState().saveCategory({ ...first, name: '改過的名字' });
    expect(await categoriesSync.dirty()).toBe(true);

    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, false);
    await useLedger.getState().deleteCategory(first.id);
    expect(await categoriesSync.dirty()).toBe(true);
  });

  it('從雲端拉回來就換掉本機的分類（不算本機修改）', async () => {
    await categoriesSync.save(THEIRS);
    const ids = (await ledgerRepo.listCategories()).map((c) => c.id).sort();
    expect(ids).toEqual(THEIRS.map((c) => c.id).sort());
    expect(await categoriesSync.dirty()).toBe(false);
  });

  it('本機有還沒推的修改：拉回來的不覆蓋', async () => {
    const mine = await ledgerRepo.listCategories();
    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, true);
    await categoriesSync.save(THEIRS);
    expect((await ledgerRepo.listCategories()).map((c) => c.id)).toEqual(mine.map((c) => c.id));
  });

  it('推完才清待推標記；推的途中又改了就留著', async () => {
    const pushed = await ledgerRepo.listCategories();
    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, true);
    await ledgerRepo.saveCategory({ ...pushed[0]!, name: '推的途中又改' });
    await categoriesSync.markPushed(pushed);
    expect(await categoriesSync.dirty()).toBe(true);

    await categoriesSync.markPushed(await ledgerRepo.listCategories());
    expect(await categoriesSync.dirty()).toBe(false);
  });
});

describe('升到會同步分類的版本（只跑一次）', () => {
  it('受邀者的手機：把本機分類標成待推，第一輪同步推上去，不被雲端舊的蓋掉', async () => {
    await setSelfPerson('妻');
    await migrateCategorySync();
    expect(await categoriesSync.dirty()).toBe(true);
  });

  it('建立帳本的那台：不標，照常從雲端拉', async () => {
    await migrateCategorySync();
    expect(await categoriesSync.dirty()).toBe(false);
  });

  it('只跑一次：之後推完清掉的標記不會再被設回來', async () => {
    await setSelfPerson('妻');
    await migrateCategorySync();
    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, false);
    await migrateCategorySync();
    expect(await categoriesSync.dirty()).toBe(false);
  });
});
