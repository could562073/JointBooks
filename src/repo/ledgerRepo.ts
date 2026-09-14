import { db } from '../db/schema';
import { defaultCategories, softDelete } from '../domain/categories';
import type { Category, Currency, Person, Range, Txn } from '../domain/types';
import { newId } from '../lib/uuid';

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

/**
 * 寫入當下的名稱快照，只為了讓 Sheet 好讀；顯示一律以 id 解析為準。
 * 查不到分類（例如分類被硬刪、或測試造出不存在的 id）時，退回 fallback ——
 * 對 updateTxn 而言 fallback 應該是該筆紀錄目前已有的快照，不能是空字串，
 * 否則「查不到才退回快照」這條最後防線本身就會把快照抹掉（增補檔 C-1 / I2）。
 */
async function snapshot(
  mainId: string,
  subId: string,
  fallback: { mainName: string; subName: string } = { mainName: '', subName: '' },
) {
  const c = await db.categories.get(mainId);
  return {
    mainName: c?.name ?? fallback.mainName,
    subName: c?.subs.find((s) => s.id === subId)?.name ?? fallback.subName,
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
  /**
   * 第一次啟動寫入預設分類；已有資料則不動。
   * 檢查與寫入包在同一個 transaction 裡，避免兩次併發呼叫（React 19 StrictMode
   * 在開發模式下會讓 effect 執行兩次）各自讀到 0 筆、各自寫入一份預設分類（I5）。
   */
  async bootstrap(): Promise<void> {
    await db.transaction('rw', db.categories, async () => {
      if (await db.categories.count() > 0) return;
      await db.categories.bulkPut(defaultCategories());
    });
  },

  async listCategories(): Promise<Category[]> {
    return (await db.categories.toArray()).sort((a, b) => a.order - b.order);
  },

  async saveCategory(c: Category): Promise<void> {
    await db.categories.put(c);
  },

  /**
   * 加入對方的帳本時，用對方的分類整批取代本機的預設分類。
   * 包在同一個 transaction：清掉之後寫入失敗的話，不能留下一本沒有分類的帳。
   */
  async replaceCategories(cs: readonly Category[]): Promise<void> {
    await db.transaction('rw', db.categories, async () => {
      await db.categories.clear();
      await db.categories.bulkPut([...cs]);
    });
  },

  /** 假刪（冪等）：不出現在選單，但歷史紀錄與統計金額完全不變（§15.1-14）。找不到 id 時無聲返回。 */
  async deleteCategory(id: string): Promise<void> {
    const c = await db.categories.get(id);
    if (!c) return;
    await db.categories.put(softDelete(c));
  },

  /** 刪分類確認窗要顯示的「已用在 N 筆紀錄」。只計算主分類使用次數。 */
  async countTxnsOf(mainCategoryId: string): Promise<number> {
    return db.txns.where('mainId').equals(mainCategoryId)
      .filter((t) => !t.deleted).count();
  },

  async listTxns(r?: Range): Promise<Txn[]> {
    const rows = r
      ? await db.txns.where('date').between(r.start, r.end, true, false).toArray()
      : await db.txns.toArray();
    return rows.filter((t) => !t.deleted);
  },

  /**
   * 同步用：含已刪除的紀錄。
   *
   * 刪除是假刪（deleted=true），必須一起推上 Sheet，對方那邊才會消失。
   * listTxns 會把它們濾掉——拿它當同步來源的話，本機刪掉的帳永遠傳不出去。
   */
  async allTxnsForSync(): Promise<Txn[]> {
    return db.txns.toArray();
  },

  /**
   * 同步合併後寫回本機。不進 outbox：這批資料要嘛是從 Sheet 拉下來的、要嘛是
   * 剛推上去的，再排進 outbox 就會在下一輪又推一次。
   */
  async saveSyncedTxns(ts: readonly Txn[]): Promise<void> {
    await db.txns.bulkPut([...ts]);
  },

  /**
   * 這台裝置改記另一本帳：清掉原本那本的紀錄與待推項目。
   * 不清的話，下一輪同步會把舊帳本的紀錄當成本機新增的，推進新的帳本裡。
   * 原本的紀錄還在它自己的試算表，沒有遺失。
   */
  async clearTxns(): Promise<void> {
    await db.transaction('rw', db.txns, db.outbox, async () => {
      await db.txns.clear();
      await db.outbox.clear();
    });
  },

  /** §7.3 的持久化偏好設定（開關等），存在 meta key-value 表（I9） */
  async getMeta<T>(key: string): Promise<T | undefined> {
    const row = await db.meta.get(key);
    return row?.value as T | undefined;
  },

  async setMeta(key: string, value: unknown): Promise<void> {
    await db.meta.put({ key, value });
  },

  /** §15.1-6：金額為 0 不寫入，回傳 null */
  async addTxn(input: NewTxnInput): Promise<Txn | null> {
    if (input.amountCents === 0) return null;

    const names = await snapshot(input.mainId, input.subId);
    const now = new Date().toISOString();
    const t: Txn = {
      id: newId(),
      ...input,
      // §14.4：CAD 時實扣等於原幣金額
      actualCadCents: input.currency === 'CAD' ? input.amountCents : input.actualCadCents,
      ...names,
      createdAt: now,
      updatedAt: now,
      deleted: false,
    };

    // 本地寫入與 outbox 排隊包在同一個 transaction：若後者失敗，前者也要一起
    // 回滾，不能留下「本地有、outbox 沒有、永遠不會同步到 Sheet」的孤兒列（I4）。
    await db.transaction('rw', db.txns, db.outbox, async () => {
      await db.txns.put(t);
      await enqueue('add', t);
    });
    return t;
  },

  /** 更新交易。改分類時重新快照名稱；非 CAD 幣別下異動金額卻未供給 actualCadCents 時拋錯。找不到 id 時拋錯。 */
  async updateTxn(id: string, patch: Partial<NewTxnInput>): Promise<Txn> {
    const cur = await db.txns.get(id);
    if (!cur) throw new Error(`找不到紀錄 ${id}`);

    const merged = { ...cur, ...patch };

    // 幣別變更、或金額變更但幣別（不論新舊）本來就非 CAD，都會讓舊的
    // actualCadCents 失真，此時必須由呼叫端重新供給，否則拋錯（I3）。
    // 只檢查 patch.currency 會漏掉「幣別不變、只改金額」的情況：一筆已經是
    // TWD 的紀錄改金額卻不給 actualCadCents，統計金額就會悄悄錯下去。
    const effectiveCurrency = patch.currency ?? cur.currency;
    const touchesActualCad = patch.currency !== undefined || patch.amountCents !== undefined;
    if (effectiveCurrency !== 'CAD' && touchesActualCad && patch.actualCadCents === undefined) {
      throw new Error(`非 CAD 幣別下變更幣別或金額時必須供給 actualCadCents（紀錄 ${id}）`);
    }

    // 無條件重新快照分類名稱：若分類被改名，下次任何編輯都要捕捉新名稱；
    // 查不到分類（例如被硬刪）時退回這筆紀錄目前的快照，而不是清空（I2）。
    const names = await snapshot(merged.mainId, merged.subId, {
      mainName: cur.mainName, subName: cur.subName,
    });

    const next: Txn = {
      ...merged,
      ...names,
      actualCadCents: merged.currency === 'CAD' ? merged.amountCents : merged.actualCadCents,
      updatedAt: new Date().toISOString(),
    };

    await db.transaction('rw', db.txns, db.outbox, async () => {
      await db.txns.put(next);
      await enqueue('update', next);
    });
    return next;
  },

  /** 軟刪：列還在（Sheets 的 deleted 欄轉 TRUE），但不再出現 */
  async deleteTxn(id: string): Promise<void> {
    const cur = await db.txns.get(id);
    if (!cur) return;
    const next: Txn = { ...cur, deleted: true, updatedAt: new Date().toISOString() };
    await db.transaction('rw', db.txns, db.outbox, async () => {
      await db.txns.put(next);
      await enqueue('delete', next);
    });
  },
};
