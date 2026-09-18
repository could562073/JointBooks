import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../db/schema';
import { ledgerRepo } from '../repo/ledgerRepo';
import { recordAccountIfMissing, signOut } from './account';
import { LAST_LEDGER_KEY, lastAccount, readLink, rememberAccount } from './accountState';
import { joinedSid, setJoinedSid, setSelfPerson } from './ledgerId';

beforeEach(async () => { await resetDb(); });

describe('signOut', () => {
  it('先同步、記下這本帳與身分、回到本機模式、斷開 Google', async () => {
    await setJoinedSid('S1');
    await setSelfPerson('妻');
    const order: string[] = [];
    const tokens = { disconnect: vi.fn(async () => { order.push('disconnect'); }) };
    await signOut({ tokens, syncNow: async () => { order.push('sync'); } });

    expect(order).toEqual(['sync', 'disconnect']);
    expect(await joinedSid()).toBeNull();
    expect(await ledgerRepo.getMeta(LAST_LEDGER_KEY)).toEqual({ sid: 'S1', self: '妻' });
    expect(await readLink()).toEqual({ sid: null });
  });

  it('同步卡住或失敗也照樣登出：帳留在手機上，下次同帳號登入補推', async () => {
    await setJoinedSid('S1');
    const tokens = { disconnect: vi.fn(async () => {}) };
    await signOut({ tokens, syncNow: () => new Promise(() => {}), waitMs: 10 });
    expect(await joinedSid()).toBeNull();
    await signOut({ tokens, syncNow: async () => { throw new Error('offline'); }, waitMs: 10 });
    expect(tokens.disconnect).toHaveBeenCalledTimes(2);
  });
});

describe('recordAccountIfMissing：舊版升上來的手機', () => {
  it('沒記過帳號：補記並回傳', async () => {
    const a = { id: 'PA', email: 'a@gmail.com' };
    expect(await recordAccountIfMissing({ aboutUser: async () => a })).toEqual(a);
    expect(await lastAccount()).toEqual(a);
  });

  it('記過就不再問 Google，也不覆蓋', async () => {
    await rememberAccount({ id: 'OLD', email: 'old@gmail.com' });
    const aboutUser = vi.fn(async () => ({ id: 'PA', email: 'a@gmail.com' }));
    expect(await recordAccountIfMissing({ aboutUser })).toBeNull();
    expect(aboutUser).not.toHaveBeenCalled();
  });

  it('讀不到帳號（離線）就算了，下次連上再補', async () => {
    expect(await recordAccountIfMissing({ aboutUser: async () => { throw new TypeError('Failed to fetch'); } })).toBeNull();
    expect(await lastAccount()).toBeNull();
  });
});
