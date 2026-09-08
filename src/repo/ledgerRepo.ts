import { db } from '../db/schema';
import { defaultCategories, softDelete } from '../domain/categories';
import type { Category, Currency, Person, Range, Txn } from '../domain/types';

export type NewTxnInput = {
  date: string;
  mainId: string;
  subId: string;
  amountCents: number;
  currency: Currency;
  actualCadCents: number;
  by: Person;
  note: string;
};

/** 寫入當下的名稱快照，只為了讓 Sheet 好讀；顯示一律以 id 解析為準 */
async function snapshot(mainId: string, subId: string) {
  const c = await db.categories.get(mainId);
  return {
    mainName: c?.name ?? '',
    subName: c?.subs.find((s) => s.id === subId)?.name ?? '',
  };
}

async function enqueue(op: 'add' | 'update' | 'delete', t: Txn) {
  await db.outbox.add({
    txnId: t.id, op, payload: t,
    queuedAt: new Date().toISOString(),
    serverRowId: null, attempts: 0,
  });
}

export const ledgerRepo = {
  /** 第一次啟動寫入預設分類；已有資料則不動 */
  async bootstrap(): Promise<void> {
    if (await db.categories.count() > 0) return;
    await db.categories.bulkPut(defaultCategories());
  },

  async listCategories(): Promise<Category[]> {
    return (await db.categories.toArray()).sort((a, b) => a.order - b.order);
  },

  async saveCategory(c: Category): Promise<void> {
    await db.categories.put(c);
  },

  /** 假刪：不出現在選單，但歷史紀錄與統計金額完全不變（§15.1-14） */
  async deleteCategory(id: string): Promise<void> {
    const c = await db.categories.get(id);
    if (!c) return;
    await db.categories.put(softDelete(c));
  },

  /** 刪分類確認窗要顯示的「已用在 N 筆紀錄」 */
  async countTxnsOf(categoryId: string): Promise<number> {
    return db.txns.where('mainId').equals(categoryId)
      .filter((t) => !t.deleted).count();
  },

  async listTxns(r?: Range): Promise<Txn[]> {
    const rows = r
      ? await db.txns.where('date').between(r.start, r.end, true, false).toArray()
      : await db.txns.toArray();
    return rows.filter((t) => !t.deleted);
  },

  /** §15.1-6：金額為 0 不寫入，回傳 null */
  async addTxn(input: NewTxnInput): Promise<Txn | null> {
    if (input.amountCents === 0) return null;

    const names = await snapshot(input.mainId, input.subId);
    const t: Txn = {
      id: crypto.randomUUID(),
      ...input,
      // §14.4：CAD 時實扣等於原幣金額
      actualCadCents: input.currency === 'CAD' ? input.amountCents : input.actualCadCents,
      ...names,
      updatedAt: new Date().toISOString(),
      deleted: false,
    };

    await db.txns.put(t);
    await enqueue('add', t);
    return t;
  },

  async updateTxn(id: string, patch: Partial<NewTxnInput>): Promise<Txn> {
    const cur = await db.txns.get(id);
    if (!cur) throw new Error(`找不到紀錄 ${id}`);

    const merged = { ...cur, ...patch };
    const names = (patch.mainId || patch.subId)
      ? await snapshot(merged.mainId, merged.subId)
      : { mainName: cur.mainName, subName: cur.subName };

    const next: Txn = {
      ...merged,
      ...names,
      actualCadCents: merged.currency === 'CAD' ? merged.amountCents : merged.actualCadCents,
      updatedAt: new Date().toISOString(),
    };

    await db.txns.put(next);
    await enqueue('update', next);
    return next;
  },

  /** 軟刪：列還在（Sheets 的 deleted 欄轉 TRUE），但不再出現 */
  async deleteTxn(id: string): Promise<void> {
    const cur = await db.txns.get(id);
    if (!cur) return;
    const next: Txn = { ...cur, deleted: true, updatedAt: new Date().toISOString() };
    await db.txns.put(next);
    await enqueue('delete', next);
  },
};
