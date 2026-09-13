import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb } from '../db/schema';
import { ledgerRepo, type NewTxnInput } from './ledgerRepo';

beforeEach(async () => {
  await resetDb();
  await ledgerRepo.bootstrap();
});

const input = (cents: number): NewTxnInput => ({
  date: '2026-09-10', mainId: 'x', subId: 'y',
  amountCents: cents, currency: 'CAD', actualCadCents: cents, by: '我', note: '',
});

describe('ledgerRepo 的同步來源', () => {
  it('allTxnsForSync 含已刪除的紀錄，listTxns 不含', async () => {
    const a = (await ledgerRepo.addTxn(input(100)))!;
    await ledgerRepo.addTxn(input(200));
    await ledgerRepo.deleteTxn(a.id);

    expect(await ledgerRepo.listTxns()).toHaveLength(1);
    const all = await ledgerRepo.allTxnsForSync();
    expect(all).toHaveLength(2);
    expect(all.find((t) => t.id === a.id)!.deleted).toBe(true);
  });

  it('saveSyncedTxns 寫回本機，但不排進 outbox', async () => {
    const t = (await ledgerRepo.addTxn(input(300)))!;
    const queued = await db.outbox.count();

    await ledgerRepo.saveSyncedTxns([{ ...t, note: '從 Sheet 拉下來' }, { ...t, id: 'remote-1' }]);

    expect(await db.outbox.count()).toBe(queued);
    expect((await db.txns.get(t.id))!.note).toBe('從 Sheet 拉下來');
    expect(await db.txns.get('remote-1')).toBeDefined();
  });
});
