import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NeedsConnectError } from '../auth/gis';
import { db, resetDb } from '../db/schema';
import { defaultCategories } from '../domain/categories';
import { ledgerRepo } from '../repo/ledgerRepo';
import { SheetsError, type SheetsClient } from '../sheets/client';
import { ENV_RANGE } from '../sheets/ledgerSheet';
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

/** 一本讀得到的帳：環境標記格與配置頁分開回應；env 省略＝加標記之前建的舊帳本 */
function ledgerClient(opts: { env?: string; rows?: string[][] }) {
  const get = vi.fn(async (_sid: string, range: string) =>
    range === ENV_RANGE ? (opts.env === undefined ? [] : [[opts.env]]) : (opts.rows ?? []));
  return { client: clientWith(get), get };
}

const persist = () => ({
  replaceCategories: vi.fn(async (cs: Parameters<typeof ledgerRepo.replaceCategories>[0]) => ledgerRepo.replaceCategories(cs)),
  setJoinedSid: vi.fn(async () => {}),
});

describe('joinLedger', () => {
  it('讀得到帳本：用對方的分類取代本機預設，並記下帳本', async () => {
    const p = persist();
    const rows = THEIRS.flatMap(categoryToRows);
    const r = await joinLedger(ledgerClient({ env: 'dev', rows }).client, 'SID', 'dev', p);

    expect(r).toEqual({ kind: 'ok', categories: THEIRS.length });
    expect(p.setJoinedSid).toHaveBeenCalledWith('SID');
    const local = await ledgerRepo.listCategories();
    expect(local.map((c) => c.id).sort()).toEqual(THEIRS.map((c) => c.id).sort());
  });

  it('對方還沒分享（403）：什麼都不寫', async () => {
    const p = persist();
    const r = await joinLedger(clientWith(async () => { throw new SheetsError(403, 'denied'); }), 'SID', 'dev', p);
    expect(r.kind).toBe('not-shared');
    expect(p.setJoinedSid).not.toHaveBeenCalled();
    expect(p.replaceCategories).not.toHaveBeenCalled();
  });

  it('帳本不存在（404）', async () => {
    const r = await joinLedger(clientWith(async () => { throw new SheetsError(404, 'gone'); }), 'SID', 'dev', persist());
    expect(r.kind).toBe('not-found');
  });

  it('需要重新連線：丟回給呼叫端，不當成加入失敗', async () => {
    await expect(
      joinLedger(clientWith(async () => { throw new NeedsConnectError(); }), 'SID', 'dev', persist())
    ).rejects.toBeInstanceOf(NeedsConnectError);
  });

  it('對方配置頁是空的：保留本機預設分類，仍然記下帳本', async () => {
    const p = persist();
    const before = await db.categories.count();
    const r = await joinLedger(ledgerClient({ env: 'dev', rows: [] }).client, 'SID', 'dev', p);
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

describe('joinLedger 的環境檢查', () => {
  it('正式版打開開發帳本的連結：拒絕加入，不搬分類、不記下帳本，連配置頁都不讀', async () => {
    const p = persist();
    const f = ledgerClient({ env: 'dev', rows: THEIRS.flatMap(categoryToRows) });
    const r = await joinLedger(f.client, 'SID', 'prod', p);
    expect(r).toEqual({ kind: 'wrong-env', ledger: 'dev' });
    expect(p.replaceCategories).not.toHaveBeenCalled();
    expect(p.setJoinedSid).not.toHaveBeenCalled();
    expect(f.get).toHaveBeenCalledTimes(1);
  });

  it('開發版打開正式帳本的連結：同樣拒絕', async () => {
    const p = persist();
    const r = await joinLedger(ledgerClient({ env: 'prod', rows: [] }).client, 'SID', 'dev', p);
    expect(r).toEqual({ kind: 'wrong-env', ledger: 'prod' });
    expect(p.setJoinedSid).not.toHaveBeenCalled();
  });

  it('正式版加入正式帳本', async () => {
    const rows = THEIRS.flatMap(categoryToRows);
    const r = await joinLedger(ledgerClient({ env: 'prod', rows }).client, 'SID', 'prod', persist());
    expect(r).toEqual({ kind: 'ok', categories: THEIRS.length });
  });

  it('沒有環境標記的舊帳本算開發帳本：開發版可以加入，正式版不行', async () => {
    expect((await joinLedger(ledgerClient({}).client, 'SID', 'dev', persist())).kind).toBe('ok');
    expect(await joinLedger(ledgerClient({}).client, 'SID', 'prod', persist()))
      .toEqual({ kind: 'wrong-env', ledger: 'dev' });
  });

  it('說明文字講清楚是哪一種帳本', () => {
    expect(joinOutcomeText({ kind: 'wrong-env', ledger: 'dev' })).toContain('開發版建立的測試帳本');
    expect(joinOutcomeText({ kind: 'wrong-env', ledger: 'prod' })).toContain('正式版的帳本');
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
