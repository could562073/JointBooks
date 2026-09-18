import type { Category, Txn } from '../domain/types';

export type Remapped = {
  /** 合併後這台手機要用的分類：那本帳的分類（可能多了子分類），加上帶過去的本機分類 */
  categories: Category[];
  /** 改指向那本帳分類 id 的紀錄 */
  txns: Txn[];
};

const nameKey = (kind: Category['kind'], name: string) => `${kind}\u0000${name.trim()}`;

/**
 * 手機上的帳要併進另一本帳（換帳號登入、訪客加入邀請時選「合併」）。
 *
 * 兩邊的分類是各自產生的，同樣叫「外食」內部 id 也不同；不對應的話，帶過去的帳在那本帳裡
 * 找不到分類。所以依「收支類型＋名稱」對到那本帳的分類，帳改指向它的 id。
 * 對不上的只帶有帳在用的：沒用到的預設分類不該塞進對方的帳本。
 * 帶過去的分類與加了子分類的分類修改時間設成 now，同步時逐一合併才會推上去。
 */
export function remapToLedger(
  local: readonly Category[],
  remote: readonly Category[],
  txns: readonly Txn[],
  now: number
): Remapped {
  // 雲端同名的有好幾個時優先對到還在用的：排序讓沒被刪的後寫進 Map、蓋過被刪的
  const remoteByKey = new Map<string, Category>();
  for (const c of [...remote].sort((a, b) => Number(a.active) - Number(b.active))) {
    remoteByKey.set(nameKey(c.kind, c.name), c);
  }

  const out = new Map(remote.map((c) => [c.id, { ...c, subs: [...c.subs] }]));
  const usedMain = new Set(txns.map((t) => t.mainId));
  const usedSub = new Set(txns.map((t) => `${t.mainId}/${t.subId}`));
  const mainMap = new Map<string, string>();
  const subMap = new Map<string, string>();
  const extras: Category[] = [];
  let order = remote.reduce((m, c) => Math.max(m, c.order), -1) + 1;

  for (const l of local) {
    const r = remoteByKey.get(nameKey(l.kind, l.name));
    if (!r) {
      if (usedMain.has(l.id)) extras.push({ ...l, subs: [...l.subs], order: order++, updatedAt: now });
      continue;
    }
    mainMap.set(l.id, r.id);
    const target = out.get(r.id)!;
    for (const s of l.subs) {
      const key = `${l.id}/${s.id}`;
      const hit = target.subs.find((x) => x.name.trim() === s.name.trim());
      if (hit) { subMap.set(key, hit.id); continue; }
      if (!usedSub.has(key)) continue;
      target.subs.push({ ...s });
      target.updatedAt = now;
      subMap.set(key, s.id);
    }
  }

  const moved = txns.map((t) => {
    const main = mainMap.get(t.mainId);
    if (!main) return t;
    return { ...t, mainId: main, subId: subMap.get(`${t.mainId}/${t.subId}`) ?? t.subId };
  });
  return { categories: [...out.values(), ...extras], txns: moved };
}
