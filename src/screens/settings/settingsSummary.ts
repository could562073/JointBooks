import { selectable } from '../../domain/categories';
import type { Category } from '../../domain/types';

/** §7.2 摘要列疊圖示的張數 */
export const STACK_SIZE = 5;

/**
 * §7.2 摘要列的副標：「N 個分類 · 月額度 $X」。
 *
 * 只算 active 的分類——假刪掉的不該出現在數量裡，也不該把它的預算算進月額度。
 * 月額度只加支出：收入分類沒有預算（增補檔 B-2）。
 */
export function categorySummary(cats: Category[]): { count: number; budgetCents: number } {
  const active = cats.filter((c) => c.active);
  return {
    count: active.length,
    budgetCents: active.reduce((sum, c) => sum + (c.budgetCents ?? 0), 0),
  };
}

/**
 * §7.2 摘要列疊在一起的五個圖示。取支出側的前五個——收入側預設只有一個分類，
 * 疊上去看起來會像湊數。不足五個就有幾個顯示幾個。
 */
export function stackedIcons(cats: Category[]): Category[] {
  return selectable(cats, 'expense').slice(0, STACK_SIZE);
}
