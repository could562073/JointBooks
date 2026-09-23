import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, resetDb } from '../db/schema';
import { ledgerRepo } from '../repo/ledgerRepo';
import type { SheetsClient } from '../sheets/client';
import { rowToTxn, txnToRow } from '../sheets/rows';
import { createSyncEngine, TXN_RANGE } from '../sync/syncEngine';

const SID = '1aB9kQ';

beforeEach(async () => {
  await resetDb();
  await ledgerRepo.bootstrap();
});

/**
 * 一張「真的」試算表：用陣列存列，append 就 push、update 就改該列。
 * §15.1-22 要驗的是「回線後只多一列」，用假 client 的呼叫次數去算會漏掉
 * 「append 兩次但其中一次其實寫到同一列」這種情況，直接看紙上有幾列才準。
 */
function fakeSheet(opts: { appendThrowsFirst?: boolean } = {}) {
  const rows: string[][] = [];
  let appendCalls = 0;

  const client = {
    get: vi.fn(async () => rows.map((r) => [...r])),
    append: vi.fn(async (_s: string, _r: string, incoming: string[][]) => {
      appendCalls += 1;
      // 模擬「伺服器收到並寫入了，但回應在路上逾時」：列已經進去，呼叫端卻收到錯誤
      rows.push(...incoming.map((r) => [...r]));
      if (opts.appendThrowsFirst && appendCalls === 1) throw new Error('timeout');
      return { updates: { updatedRange: 'x' } };
    }),
    update: vi.fn(async (_s: string, range: string, incoming: string[][]) => {
      const line = Number(range.match(/A(\d+):/)![1]);
      rows[line - 2] = [...incoming[0]!];
    }),
    createSpreadsheet: vi.fn(),
    shareWith: vi.fn(),
  } as unknown as SheetsClient;

  return { client, rows, get appendCalls() { return appendCalls; } };
}

function engineOn(sheet: ReturnType<typeof fakeSheet>, online: () => boolean) {
  return createSyncEngine({
    client: sheet.client,
    spreadsheetId: () => SID,
    localTxns: () => ledgerRepo.listTxns(),
    saveTxns: async (ts) => { await db.txns.bulkPut([...ts]); },
    isOnline: online,
    onState: () => {},
    // 這份驗收測試不管稅欄標頭，跟 controller 的預設值一樣給空函式
    ensureTaxHeader: async () => {},
  });
}

const add = (cents: number) =>
  ledgerRepo.addTxn({
    date: '2026-09-10', mainId: 'x', subId: 'y',
    amountCents: cents, currency: 'CAD', actualCadCents: cents,
    by: '我', note: '',
  });

describe('§15.1-22 離線新增 → 進 outbox；回線後只 append 一列', () => {
  it('離線記三筆都進 outbox，且本地立刻看得到', async () => {
    await add(1_000);
    await add(2_000);
    await add(3_000);

    expect(await db.outbox.count()).toBe(3);
    expect(await ledgerRepo.listTxns()).toHaveLength(3);
  });

  it('離線時同步不打任何 API', async () => {
    const sheet = fakeSheet();
    let online = false;
    const engine = engineOn(sheet, () => online);

    await add(1_000);
    const r = await engine.syncOnce();

    expect(r.state).toBe('offline');
    expect(sheet.client.get).not.toHaveBeenCalled();
    expect(sheet.client.append).not.toHaveBeenCalled();
  });

  it('回線後三筆各上去一列，不多不少', async () => {
    const sheet = fakeSheet();
    let online = false;
    const engine = engineOn(sheet, () => online);

    await add(1_000);
    await add(2_000);
    await add(3_000);
    await engine.syncOnce();                 // 離線，什麼都不做

    online = true;
    const r = await engine.syncOnce();

    expect(r.pushed).toBe(3);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.rows.map((row) => rowToTxn(row)!.actualCadCents).sort((a, b) => a - b))
      .toEqual([1_000, 2_000, 3_000]);
  });

  it('連續同步兩次不會重複 append', async () => {
    const sheet = fakeSheet();
    const engine = engineOn(sheet, () => true);

    await add(1_000);
    await engine.syncOnce();
    const after1 = sheet.rows.length;
    await engine.syncOnce();

    expect(after1).toBe(1);
    expect(sheet.rows).toHaveLength(1);
  });

  it('append 逾時但其實寫成功時，重試也只留一列（§14.6 去重）', async () => {
    const sheet = fakeSheet({ appendThrowsFirst: true });
    const engine = engineOn(sheet, () => true);

    await add(1_000);
    const first = await engine.syncOnce();
    expect(first.state).toBe('error');         // 呼叫端看到的是失敗
    expect(sheet.rows).toHaveLength(1);        // 但列已經進去了

    const second = await engine.syncOnce();    // 重試
    expect(second.state).toBe('synced');
    expect(sheet.rows).toHaveLength(1);        // 沒有變成兩列
  });

  it('離線改同一筆兩次，回線後那一列是最後的值而不是兩列', async () => {
    const sheet = fakeSheet();
    let online = false;
    const engine = engineOn(sheet, () => online);

    const t = (await add(1_000))!;
    online = true;
    await engine.syncOnce();
    expect(sheet.rows).toHaveLength(1);

    online = false;
    await ledgerRepo.updateTxn(t.id, { amountCents: 1_500, actualCadCents: 1_500 });
    await ledgerRepo.updateTxn(t.id, { amountCents: 2_500, actualCadCents: 2_500 });
    online = true;
    await engine.syncOnce();

    expect(sheet.rows).toHaveLength(1);
    expect(rowToTxn(sheet.rows[0]!)!.actualCadCents).toBe(2_500);
  });

  it('對方在遠端新增的那筆會被拉下來，不會覆蓋掉本地還沒推的那筆', async () => {
    const sheet = fakeSheet();
    const engine = engineOn(sheet, () => true);

    // 遠端先有一筆別人記的
    const theirs = {
      id: 'remote-1', date: '2026-09-10',
      mainId: 'x', subId: 'y', mainName: '外食', subName: '飲料',
      amountCents: 777, currency: 'CAD' as const, actualCadCents: 777,
      by: '妻' as const, note: '',
      createdAt: '2026-09-10T01:00:00.000Z', updatedAt: '2026-09-10T01:00:00.000Z',
      deleted: false,
    };
    sheet.rows.push(txnToRow(theirs));

    await add(1_000);
    await engine.syncOnce();

    expect(sheet.rows).toHaveLength(2);
    const local = await ledgerRepo.listTxns();
    expect(local.map((x) => x.actualCadCents).sort((a, b) => a - b)).toEqual([777, 1_000]);
  });
});

describe('§15.1-22 附帶：outbox 與本地寫入是同一個 transaction', () => {
  it('本地有的每一筆在 outbox 都排得到隊', async () => {
    await add(1_000);
    await add(2_000);
    const local = await ledgerRepo.listTxns();
    const queued = new Set((await db.outbox.toArray()).map((o) => o.txnId));
    for (const t of local) expect(queued.has(t.id)).toBe(true);
  });

  it('紀錄範圍固定從第 2 列起算，標頭不會被當成資料', async () => {
    expect(TXN_RANGE).toBe('紀錄!A2:O');
  });
});
