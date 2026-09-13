import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NeedsConnectError } from '../auth/gis';
import { db, resetDb } from '../db/schema';
import { defaultCategories } from '../domain/categories';
import { ledgerRepo } from '../repo/ledgerRepo';
import { SheetsError, type SheetsClient } from '../sheets/client';
import { categoryToRows } from '../sheets/rows';
import { joinLedger, joinOutcomeText } from './joinLedger';

beforeEach(async () => {
  await resetDb();
  await ledgerRepo.bootstrap();
});

let n = 0;
const THEIRS = defaultCategories(() => `husband-${n++}`);

function clientWith(get: SheetsClient['get']) {
  return { get } as unknown as SheetsClient;
}

const persist = () => ({
  replaceCategories: vi.fn(async (cs: Parameters<typeof ledgerRepo.replaceCategories>[0]) => ledgerRepo.replaceCategories(cs)),
  setJoinedSid: vi.fn(async () => {}),
});

describe('joinLedger', () => {
  it('讀得到帳本：用對方的分類取代本機預設，並記下帳本', async () => {
    const p = persist();
    const rows = THEIRS.flatMap(categoryToRows);
    const r = await joinLedger(clientWith(async () => rows), 'SID', p);

    expect(r).toEqual({ kind: 'ok', categories: THEIRS.length });
    expect(p.setJoinedSid).toHaveBeenCalledWith('SID');
    const local = await ledgerRepo.listCategories();
    expect(local.map((c) => c.id).sort()).toEqual(THEIRS.map((c) => c.id).sort());
  });

  it('對方還沒分享（403）：什麼都不寫', async () => {
    const p = persist();
    const r = await joinLedger(clientWith(async () => { throw new SheetsError(403, 'denied'); }), 'SID', p);
    expect(r.kind).toBe('not-shared');
    expect(p.setJoinedSid).not.toHaveBeenCalled();
    expect(p.replaceCategories).not.toHaveBeenCalled();
  });

  it('帳本不存在（404）', async () => {
    const r = await joinLedger(clientWith(async () => { throw new SheetsError(404, 'gone'); }), 'SID', persist());
    expect(r.kind).toBe('not-found');
  });

  it('需要重新連線：丟回給呼叫端，不當成加入失敗', async () => {
    await expect(
      joinLedger(clientWith(async () => { throw new NeedsConnectError(); }), 'SID', persist())
    ).rejects.toBeInstanceOf(NeedsConnectError);
  });

  it('對方配置頁是空的：保留本機預設分類，仍然記下帳本', async () => {
    const p = persist();
    const before = await db.categories.count();
    const r = await joinLedger(clientWith(async () => []), 'SID', p);
    expect(r).toEqual({ kind: 'ok', categories: 0 });
    expect(p.replaceCategories).not.toHaveBeenCalled();
    expect(await db.categories.count()).toBe(before);
    expect(p.setJoinedSid).toHaveBeenCalledWith('SID');
  });

  it('沒分享時的說明會叫對方去邀請面板輸入帳號', () => {
    expect(joinOutcomeText({ kind: 'not-shared' })).toContain('分享帳本');
    expect(joinOutcomeText({ kind: 'ok', categories: 3 })).toBeNull();
  });
});

describe('ledgerRepo.replaceCategories', () => {
  it('整批取代，舊的預設分類不會殘留', async () => {
    const mine = await ledgerRepo.listCategories();
    await ledgerRepo.replaceCategories(THEIRS);
    const ids = (await ledgerRepo.listCategories()).map((c) => c.id);
    expect(ids).toHaveLength(THEIRS.length);
    expect(ids).not.toContain(mine[0]!.id);
  });
});
