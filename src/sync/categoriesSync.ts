import { db } from '../db/schema';
import type { Category } from '../domain/types';
import { ledgerRepo } from '../repo/ledgerRepo';
import { sameCategories } from './categoryMerge';
import { SELF_KEY } from './ledgerId';

/** 本機改過分類（新增、改名、圖示、預算、刪除），還沒跟雲端合併過 */
export const CATEGORIES_DIRTY_KEY = 'categoriesDirty';

/** 下一次合併時，兩邊都沒有修改時間的分類以本機為準（升級後只用一次） */
export const CATEGORIES_PREFER_LOCAL_KEY = 'categoriesPreferLocal';

/** 這台裝置已經跑過「分類逐一合併」這一版 */
export const CATEGORIES_MERGE_SINCE_KEY = 'categoriesMergeSince';

/**
 * 升到逐一合併分類的版本時跑一次。
 *
 * 在這之前改的分類都沒有修改時間，合併時跟雲端打平、預設以雲端為準。受邀者手機上改過、
 * 一直沒推上去的分類（使用者回報對方看到舊的）這樣會被雲端舊的蓋掉，所以受邀者的手機
 * 第一次合併以本機為準；任何一台本機還有沒推的修改時也一樣。建立帳本、沒有待推修改的
 * 那台照常以雲端為準。有修改時間的分類不受影響，照樣是較新的贏。
 */
export async function migrateCategorySync(): Promise<void> {
  if ((await ledgerRepo.getMeta(CATEGORIES_MERGE_SINCE_KEY)) !== undefined) return;
  await ledgerRepo.setMeta(CATEGORIES_MERGE_SINCE_KEY, true);
  const invitee = (await ledgerRepo.getMeta<string>(SELF_KEY)) === '妻';
  const unpushed = (await ledgerRepo.getMeta<boolean>(CATEGORIES_DIRTY_KEY)) === true;
  if (!invitee && !unpushed) return;
  await ledgerRepo.setMeta(CATEGORIES_PREFER_LOCAL_KEY, true);
  await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, true);
}

/** 同步控制器用的分類存取；合併規則見 mergeCategories */
export type CategoriesSync = {
  dirty(): Promise<boolean>;
  local(): Promise<Category[]>;
  /** 兩邊都沒有修改時間時是否以本機為準 */
  preferLocal(): Promise<boolean>;
  /**
   * 合併完：本機在這段時間沒再改（跟當初讀到的 read 一樣），才存入合併結果（null＝不用存）、
   * 清掉待推標記。途中又改了就都不動，標記留著，下一輪再合併一次
   */
  settle(read: readonly Category[], merged: readonly Category[] | null): Promise<void>;
};

export const categoriesSync: CategoriesSync = {
  async dirty() {
    return (await ledgerRepo.getMeta<boolean>(CATEGORIES_DIRTY_KEY)) === true;
  },
  local: () => ledgerRepo.listCategories(),
  async preferLocal() {
    return (await ledgerRepo.getMeta<boolean>(CATEGORIES_PREFER_LOCAL_KEY)) === true;
  },
  async settle(read, merged) {
    await db.transaction('rw', db.categories, db.meta, async () => {
      if (!sameCategories(await ledgerRepo.listCategories(), read)) return;
      if (merged) await ledgerRepo.replaceCategories(merged);
      await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, false);
      await ledgerRepo.setMeta(CATEGORIES_PREFER_LOCAL_KEY, false);
    });
  },
};
