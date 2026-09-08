import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb } from './schema';
import { defaultCategories } from '../domain/categories';
import type { Txn } from '../domain/types';

const txn = (over: Partial<Txn> & { id: string; date: string }): Txn => ({
  mainId: 'm1', subId: 's1', mainName: '超市', subName: '食材',
  amountCents: 1_000, currency: 'CAD', actualCadCents: 1_000,
  by: '我', note: '',
  createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', deleted: false,
  ...over,
});

describe('LedgerDb', () => {
  beforeEach(async () => { await resetDb(); });

  it('四張表都存在', () => {
    expect(db.txns).toBeDefined();
    expect(db.categories).toBeDefined();
    expect(db.outbox).toBeDefined();
    expect(db.meta).toBeDefined();
  });

  it('txns 可依 date 範圍查詢（月曆與統計都靠這個）', async () => {
    await db.txns.bulkPut([
      txn({ id: 'a', date: '2026-08-31' }),
      txn({ id: 'b', date: '2026-09-01' }),
      txn({ id: 'c', date: '2026-09-30' }),
      txn({ id: 'd', date: '2026-10-01' }),
    ]);
    const rows = await db.txns.where('date').between('2026-09-01', '2026-10-01', true, false).toArray();
    expect(rows.map((r) => r.id).sort()).toEqual(['b', 'c']);
  });

  it('txns 可依 mainId 查詢（預算條用）', async () => {
    await db.txns.bulkPut([
      txn({ id: 'a', date: '2026-09-01', mainId: 'x' }),
      txn({ id: 'b', date: '2026-09-02', mainId: 'y' }),
    ]);
    expect(await db.txns.where('mainId').equals('x').count()).toBe(1);
  });

  it('categories 以 id 為主鍵，可整批寫入預設值', async () => {
    const cats = defaultCategories();
    await db.categories.bulkPut(cats);
    expect(await db.categories.count()).toBe(7);
    expect((await db.categories.get(cats[0]!.id))!.name).toBe('租屋');
  });

  it('outbox 的 seq 自增，保證回線時依序處理（§14.6）', async () => {
    const t = txn({ id: 'a', date: '2026-09-01' });
    await db.outbox.add({ txnId: 'a', op: 'add', payload: t, queuedAt: '1', serverRowId: null, attempts: 0 });
    await db.outbox.add({ txnId: 'b', op: 'add', payload: t, queuedAt: '2', serverRowId: null, attempts: 0 });
    const items = await db.outbox.orderBy('seq').toArray();
    expect(items.map((i) => i.txnId)).toEqual(['a', 'b']);
    expect(items[0]!.seq).toBeLessThan(items[1]!.seq!);
  });

  it('meta 存 key-value（spreadsheetId 之類）', async () => {
    await db.meta.put({ key: 'spreadsheetId', value: '1aB9kQ' });
    expect((await db.meta.get('spreadsheetId'))!.value).toBe('1aB9kQ');
  });

  it('resetDb 清空所有表', async () => {
    // 填入四張表的資料
    await db.txns.put(txn({ id: 'a', date: '2026-09-01' }));
    await db.categories.bulkPut(defaultCategories());
    const t = txn({ id: 'b', date: '2026-09-01' });
    await db.outbox.add({ txnId: 'b', op: 'add', payload: t, queuedAt: '1', serverRowId: null, attempts: 0 });
    await db.meta.put({ key: 'spreadsheetId', value: '1aB9kQ' });

    // 確認四張表都有資料
    expect(await db.txns.count()).toBeGreaterThan(0);
    expect(await db.categories.count()).toBeGreaterThan(0);
    expect(await db.outbox.count()).toBeGreaterThan(0);
    expect(await db.meta.count()).toBeGreaterThan(0);

    // 清空所有表
    await resetDb();

    // 確認四張表都已清空
    expect(await db.txns.count()).toBe(0);
    expect(await db.categories.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.meta.count()).toBe(0);
  });
});
