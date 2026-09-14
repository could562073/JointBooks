import type { Category } from '../domain/types';
import { ledgerRepo } from '../repo/ledgerRepo';
import { SELF_KEY } from './ledgerId';

/** 本機改過分類（新增、改名、圖示、預算、刪除），還沒推上雲端 */
export const CATEGORIES_DIRTY_KEY = 'categoriesDirty';

/** 這台裝置已經跑過會同步分類的版本 */
export const CATEGORIES_SYNC_SINCE_KEY = 'categoriesSyncSince';

/**
 * 升到會同步分類的版本時跑一次。
 *
 * 在這之前，受邀的人改的分類只存在自己手機上、沒有標成待推（使用者回報對方看到舊的）。
 * 不先標，第一輪同步會把雲端舊的分類拉下來蓋掉她改過的那份。所以受邀者的手機第一次
 * 跑這一版時，把本機分類標成待推；建立帳本的那台照常從雲端拉。
 */
export async function migrateCategorySync(): Promise<void> {
  if ((await ledgerRepo.getMeta(CATEGORIES_SYNC_SINCE_KEY)) !== undefined) return;
  await ledgerRepo.setMeta(CATEGORIES_SYNC_SINCE_KEY, true);
  if ((await ledgerRepo.getMeta<string>(SELF_KEY)) === '妻') {
    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, true);
  }
}

/**
 * 同步控制器用的分類存取（使用者回報：受邀者改了分類，另一邊看到的還是舊的）。
 * 規則跟成員設定一樣：本機有沒推的修改就推（最後寫入的贏），否則雲端有變才拉。
 */
export type CategoriesSync = {
  dirty(): Promise<boolean>;
  local(): Promise<Category[]>;
  /** 推上去之後：這段時間本機沒再改，才清掉待推標記 */
  markPushed(pushed: readonly Category[]): Promise<void>;
  /** 從雲端拉回來：本機還有沒推的修改就不覆蓋 */
  save(cs: readonly Category[]): Promise<void>;
};

export const categoriesSync: CategoriesSync = {
  async dirty() {
    return (await ledgerRepo.getMeta<boolean>(CATEGORIES_DIRTY_KEY)) === true;
  },
  local: () => ledgerRepo.listCategories(),
  async markPushed(pushed) {
    const now = await ledgerRepo.listCategories();
    if (JSON.stringify(now) === JSON.stringify(pushed)) await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, false);
  },
  async save(cs) {
    if (await categoriesSync.dirty()) return;
    await ledgerRepo.replaceCategories(cs);
  },
};
