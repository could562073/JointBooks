import { beforeEach, describe, expect, it } from 'vitest';
import { db, resetDb } from '../db/schema';
import type { Txn } from '../domain/types';
import { ledgerRepo } from './ledgerRepo';

function txn(id: string): Txn {
  return {
    id, date: '2026-09-10', mainId: 'c1', subId: 's1', mainName: '外食', subName: '飲料',
    amountCents: 1_000, currency: 'CAD', actualCadCents: 1_000, by: '我', note: '',
    createdAt: '2026-09-10T10:00:00.000Z', updatedAt: '2026-09-10T10:00:00.000Z', deleted: false,
  };
}

beforeEach(async () => {
  await resetDb();
  await ledgerRepo.bootstrap();
});

describe('ledgerRepo.clearTxns（改記另一本帳）', () => {
  it('清掉原本那本的紀錄與待推項目，分類不動', async () => {
    await ledgerRepo.saveSyncedTxns([txn('a'), txn('b')]);
    const categories = await db.categories.count();

    await ledgerRepo.clearTxns();

    expect(await ledgerRepo.allTxnsForSync()).toEqual([]);
    expect(await db.outbox.count()).toBe(0);
    expect(await db.categories.count()).toBe(categories);
  });
});
