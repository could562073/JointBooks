import { resolveNames } from '../domain/categories';
import { formatCad } from '../domain/money';
import type { Category, Person, Txn } from '../domain/types';

/**
 * 「對方記帳時通知我」（§7.3、MOTION #25）：同步拉回來的紀錄裡，哪幾筆是對方剛記的。
 *
 * 以「這台手機已經看過的紀錄 id」為基準：打開 App 時本機已經有的紀錄不算新的。
 * 本機一筆都沒有（第一次登入、剛加入別人的帳本）時，第一次同步拉回來的整本歷史也不算，
 * 否則一打開就跳「記了 300 筆」。自己記的（不論哪支手機）與已刪除的都不通知；
 * 對方改了舊的一筆也不通知，只有新記的才算。
 */
export function createArrivalWatcher(seedIds: readonly string[]) {
  let known: Set<string> | null = seedIds.length > 0 ? new Set(seedIds) : null;
  return {
    next(txns: readonly Txn[], self: Person): Txn[] {
      const seen = known;
      const arrivals = seen
        ? txns.filter((t) => !seen.has(t.id) && t.by !== self && !t.deleted)
        : [];
      known = new Set([...(seen ?? []), ...txns.map((t) => t.id)]);
      return arrivals;
    },
  };
}

/** 通知文字：一筆「雪雪大人記了一筆 超市 · 食材 $42.18」；好幾筆一起到「雪雪大人記了 3 筆」 */
export function partnerToastText(arrivals: readonly Txn[], partnerName: string, categories: Category[]): string {
  if (arrivals.length !== 1) return `${partnerName}記了 ${arrivals.length} 筆`;
  const t = arrivals[0]!;
  const { main, sub } = resolveNames(categories, t);
  // 主分類只有一個同名子分類時（租屋 · 租屋）只寫一次
  const what = sub && sub !== main ? `${main} · ${sub}` : main;
  return `${partnerName}記了一筆 ${what} ${formatCad(t.actualCadCents, 'none')}`;
}
