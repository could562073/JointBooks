import Dexie, { type Table } from 'dexie';
import type { Category, Txn } from '../domain/types';

export type OutboxOp = 'add' | 'update' | 'delete';

export type OutboxItem = {
  /** 自增序號，保證回線時依序處理 */
  seq?: number;
  txnId: string;
  op: OutboxOp;
  payload: Txn;
  queuedAt: string;
  /** append 成功後回填的列號；去重靠它（§14.6） */
  serverRowId: number | null;
  attempts: number;
};

export type MetaRow = { key: string; value: unknown };

export class LedgerDb extends Dexie {
  txns!: Table<Txn, string>;
  categories!: Table<Category, string>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super('joint-books');
    this.version(1).stores({
      // 月曆與統計以 date 篩、預算條以 mainId 篩。
      // deleted 是 boolean，Dexie 不能可靠地索引布林值，故不建索引，改用 filter()。
      txns: 'id, date, mainId, updatedAt',
      categories: 'id, kind, order, active',
      outbox: '++seq, txnId, op',
      meta: 'key',
    });
  }
}

export const db = new LedgerDb();

/** 測試用：清空但不刪除 schema */
export async function resetDb(): Promise<void> {
  await db.open();
  await Promise.all([
    db.txns.clear(), db.categories.clear(), db.outbox.clear(), db.meta.clear(),
  ]);
}
