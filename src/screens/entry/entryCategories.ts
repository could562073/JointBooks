import { addSub, makeCategory, nextColorSet, nextOrder } from '../../domain/categories';
import type { Category, CategoryKind } from '../../domain/types';

/**
 * §5 就地新增主分類。回傳要存的分類與它的 id，讓面板可以立即選中。
 * 色盤與排序沿用 domain/categories 的規則（新分類插在清單最上方）。
 */
export function createMain(
  cats: Category[],
  kind: CategoryKind,
  name: string,
  newId?: () => string
): { category: Category; id: string } | null {
  const n = name.trim();
  if (!n) return null;

  // 同 kind 已經有同名分類時不再建一個，直接回傳既有的——使用者要的是「選到它」
  const existing = cats.find((c) => c.kind === kind && c.name === n && c.active);
  if (existing) return { category: existing, id: existing.id };

  const category = makeCategory({
    kind, name: n,
    colorSet: nextColorSet(cats),
    order: nextOrder(cats),
    ...(newId ? { newId } : {}),
  });
  return { category, id: category.id };
}

/**
 * §5 就地新增子分類。addSub 對空字串與重名都回傳原樣，所以這裡用「有沒有多出
 * 一個 id」來判斷是不是真的新增了；重名時回傳既有那顆的 id，一樣達成「立即選中」。
 */
export function createSub(
  cats: Category[],
  mainId: string,
  name: string,
  newId?: () => string
): { category: Category; id: string } | null {
  const main = cats.find((c) => c.id === mainId);
  const n = name.trim();
  if (!main || !n) return null;

  const before = new Set(main.subs.map((s) => s.id));
  const category = newId ? addSub(main, n, newId) : addSub(main, n);
  const added = category.subs.find((s) => !before.has(s.id));
  if (added) return { category, id: added.id };

  const existing = main.subs.find((s) => s.name === n);
  return existing ? { category: main, id: existing.id } : null;
}
