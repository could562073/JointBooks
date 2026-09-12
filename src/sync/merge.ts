import type { Txn } from '../domain/types';

/**
 * §14.6 衝突：同一 id 以 updatedAt 較新者勝。
 *
 * 相等時取遠端：兩邊都宣稱同一個時間點的話，本地的那份極可能是已經推上去
 * 之後又被讀回來的同一筆，取遠端至少全裝置一致；取本地則會讓兩台手機
 * 各自堅持自己那份，永遠收斂不了。
 */
export function pickNewer(local: Txn, remote: Txn): Txn {
  return local.updatedAt > remote.updatedAt ? local : remote;
}

export type MergeResult = {
  /** 合併後應該存進本地的完整清單 */
  merged: Txn[];
  /** 需要推上去的（本地較新，或遠端根本沒有） */
  toPush: Txn[];
};

/**
 * 把本地與遠端的紀錄合成一份。
 *
 * 兩人同時新增不同筆不會衝突（append 天然安全，§14.6），所以這裡只處理
 * 同一個 id 的情況；其餘就是聯集。
 */
export function mergeTxns(local: readonly Txn[], remote: readonly Txn[]): MergeResult {
  const byId = new Map<string, Txn>();
  const toPush: Txn[] = [];

  const remoteById = new Map(remote.map((t) => [t.id, t]));

  for (const l of local) {
    const r = remoteById.get(l.id);
    if (!r) {
      // 遠端沒有：可能還沒推上去，也可能是別人刪了——但刪除是軟刪（deleted=TRUE）
      // 仍會有那一列，所以「遠端沒有」只會是「還沒推上去」
      byId.set(l.id, l);
      toPush.push(l);
      continue;
    }
    const winner = pickNewer(l, r);
    byId.set(l.id, winner);
    if (winner === l && l.updatedAt > r.updatedAt) toPush.push(l);
  }

  for (const r of remote) {
    if (!byId.has(r.id)) byId.set(r.id, r);
  }

  return { merged: [...byId.values()], toPush };
}

/**
 * §14.6 去重：回線後先看遠端是否已存在該 id，再決定要不要 append。
 *
 * 這是「重試時帶同一個 id」的另一半——沒有這一步，一次逾時但其實成功的
 * append，重試時就會變成兩列一模一樣的帳。
 */
export function needsAppend(id: string, remoteIds: ReadonlySet<string>): boolean {
  return !remoteIds.has(id);
}
