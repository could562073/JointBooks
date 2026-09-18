import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../db/schema';
import { ledgerRepo } from '../repo/ledgerRepo';
import {
  LAST_LEDGER_KEY, enterLocalMode, lastAccount, lastLedger, localFacts, readLink, rememberAccount,
} from './accountState';
import { setJoinedSid } from './ledgerId';

beforeEach(async () => {
  await resetDb();
  await ledgerRepo.bootstrap();
});

describe('readLink：開 App 時要去哪', () => {
  it('什麼都沒記過：開始畫面', async () => {
    expect(await readLink()).toBe('login');
  });

  it('選過「先不登入」：本機模式', async () => {
    await enterLocalMode();
    expect(await readLink()).toEqual({ sid: null });
  });

  it('接著帳本就進那一本，不管 localMode', async () => {
    await enterLocalMode();
    await setJoinedSid('S1');
    expect(await readLink()).toEqual({ sid: 'S1' });
  });
});

describe('上次的帳號與帳本', () => {
  it('存了讀得回來', async () => {
    await rememberAccount({ id: 'P1', email: 'a@gmail.com' });
    expect(await lastAccount()).toEqual({ id: 'P1', email: 'a@gmail.com' });
    await ledgerRepo.setMeta(LAST_LEDGER_KEY, { sid: 'S1', self: '妻' });
    expect(await lastLedger()).toEqual({ sid: 'S1', self: '妻' });
  });

  it('沒存過或內容壞掉都當作沒有', async () => {
    expect(await lastAccount()).toBeNull();
    await ledgerRepo.setMeta(LAST_LEDGER_KEY, { sid: 3 });
    expect(await lastLedger()).toBeNull();
  });
});

describe('localFacts：手機上有沒有帳、是誰記的', () => {
  it('只算沒刪掉的帳', async () => {
    const [c] = await ledgerRepo.listCategories();
    const base = {
      date: '2026-09-18', mainId: c!.id, subId: c!.subs[0]!.id,
      amountCents: 100, currency: 'CAD' as const, actualCadCents: 100, note: '',
    };
    await ledgerRepo.addTxn({ ...base, by: '我' });
    const gone = await ledgerRepo.addTxn({ ...base, by: '妻' });
    await ledgerRepo.deleteTxn(gone!.id);

    const f = await localFacts();
    expect(f.count).toBe(1);
    expect([...f.people]).toEqual(['我']);
  });
});
