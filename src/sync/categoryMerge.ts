import type { Category } from '../domain/types';

/** 分類的內容（不含修改時間）：拿來判斷「這次存檔到底有沒有改到東西」 */
function contentKey(c: Category): string {
  return JSON.stringify([
    c.id, c.kind, c.name, c.icon, c.budgetCents,
    c.subs.map((s) => [s.id, s.name]), c.colorSet, c.order, c.active,
  ]);
}

export function sameContent(a: Category, b: Category): boolean {
  return contentKey(a) === contentKey(b);
}

/** 兩份分類清單是否完全一樣（含修改時間；順序不計） */
export function sameCategories(a: readonly Category[], b: readonly Category[]): boolean {
  const key = (cs: readonly Category[]) =>
    cs.map((c) => `${contentKey(c)}@${c.updatedAt ?? 0}`).sort().join('\n');
  return key(a) === key(b);
}

export type CategoryMerge = {
  /** 合併後兩邊都該是這一份 */
  merged: Category[];
  /** 雲端跟合併結果不同：要寫回配置頁 */
  pushNeeded: boolean;
  /** 本機跟合併結果不同：要存回本機 */
  saveNeeded: boolean;
};

/**
 * 分類逐一合併，同一個分類以修改時間較新的為準（跟紀錄的 §14.6 同一套規則）。
 *
 * 原本是整份分類清單「最後推的贏」：另一支手機只要按一次 ✓（就算沒改），就把它手上
 * 還沒拉到的舊分類整份推上去，蓋掉對方剛改好的月預算、圖示、子分類（使用者回報）。
 * 逐一比修改時間後，一邊改租屋、一邊改外食兩個都留得住；同一個分類兩邊都改，才是較新的贏。
 *
 * 修改時間相等（多半是兩邊都還沒有修改時間的舊分類）時取雲端，全部裝置才會收斂成同一份；
 * preferLocalOnTie 只給升級後受邀者的第一次合併用，見 migrateCategorySync。
 * 分類只會假刪、不會真的消失，所以雲端沒有的分類一定是本機新增、還沒推上去的。
 */
export function mergeCategories(
  local: readonly Category[],
  remote: readonly Category[],
  preferLocalOnTie = false
): CategoryMerge {
  const remoteById = new Map(remote.map((c) => [c.id, c]));
  const byId = new Map<string, Category>();

  for (const l of local) {
    const r = remoteById.get(l.id);
    if (!r) { byId.set(l.id, l); continue; }
    const lt = l.updatedAt ?? 0;
    const rt = r.updatedAt ?? 0;
    byId.set(l.id, lt > rt || (lt === rt && preferLocalOnTie) ? l : r);
  }
  for (const r of remote) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }

  const merged = [...byId.values()].sort((a, b) => a.order - b.order);
  return {
    merged,
    pushNeeded: !sameCategories(merged, remote),
    saveNeeded: !sameCategories(merged, local),
  };
}
