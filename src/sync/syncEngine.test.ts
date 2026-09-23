import { describe, it, expect, vi } from 'vitest';
import type { Txn } from '../domain/types';
import { txnToRow } from '../sheets/rows';
import type { SheetsClient } from '../sheets/client';
import { createSyncEngine, TXN_RANGE } from './syncEngine';

function txn(id: string, updatedAt: string, over: Partial<Txn> = {}): Txn {
  return {
    id, date: '2026-09-06',
    mainId: 'c1', subId: 's1', mainName: '外食', subName: '飲料',
    amountCents: 1_000, currency: 'CAD', actualCadCents: 1_000,
    by: '我', note: '',
    createdAt: '2026-09-06T10:00:00.000Z', updatedAt, deleted: false,
    ...over,
  };
}

function setup(opts: {
  remote?: Txn[];
  local?: Txn[];
  online?: boolean;
  sid?: string | null;
  getThrows?: boolean;
  headerThrows?: boolean;
} = {}) {
  const appended: string[][][] = [];
  const updated: { range: string; rows: string[][] }[] = [];
  const saved: Txn[][] = [];
  const states: string[] = [];
  const headered: string[] = [];

  const client = {
    get: vi.fn(async () => {
      if (opts.getThrows) throw new Error('boom');
      return (opts.remote ?? []).map(txnToRow);
    }),
    append: vi.fn(async (_s: string, _r: string, rows: string[][]) => {
      appended.push(rows);
      return { updates: { updatedRange: 'x' } };
    }),
    update: vi.fn(async (_s: string, range: string, rows: string[][]) => {
      updated.push({ range, rows });
    }),
    createSpreadsheet: vi.fn(),
    shareWith: vi.fn(),
  } as unknown as SheetsClient;

  const engine = createSyncEngine({
    client,
    spreadsheetId: () => (opts.sid === undefined ? 'SID' : opts.sid),
    localTxns: async () => opts.local ?? [],
    saveTxns: async (ts) => { saved.push([...ts]); },
    isOnline: () => opts.online ?? true,
    onState: (s) => states.push(s),
    // 真實的 ensureTaxHeader（見 taxHeader.ts）把 try/catch 收進函式自己裡面，
    // 對呼叫端來說永遠不會丟錯——這裡用同樣的形狀模擬「標頭真的沒補成功」：
    // headered 不會記到這個 sid，但函式本身仍然乾乾淨淨地 resolve。
    ensureTaxHeader: async (sid) => {
      try {
        if (opts.headerThrows) throw new Error('403');
        headered.push(sid);
      } catch {
        // 什麼都不做：模擬 ensureTaxHeader 自己吞掉錯誤，不往上丟
      }
    },
  });

  return { engine, client, appended, updated, saved, states, headered };
}

describe('syncOnce 的狀態機', () => {
  it('正常一輪是 syncing → synced', async () => {
    const s = setup();
    await s.engine.syncOnce();
    expect(s.states).toEqual(['syncing', 'synced']);
  });

  it('離線時直接 offline，不會閃一下 syncing', async () => {
    const s = setup({ online: false });
    const r = await s.engine.syncOnce();
    expect(r.state).toBe('offline');
    expect(s.states).toEqual(['offline']);
    expect(s.client.get).not.toHaveBeenCalled();
  });

  it('讀取失敗轉 error', async () => {
    const s = setup({ getThrows: true });
    const r = await s.engine.syncOnce();
    expect(r.state).toBe('error');
    expect(s.states).toEqual(['syncing', 'error']);
  });

  it('還沒有帳本時什麼都不做', async () => {
    const s = setup({ sid: null });
    await s.engine.syncOnce();
    expect(s.states).toEqual([]);
    expect(s.client.get).not.toHaveBeenCalled();
  });

  it('離線一輪之後回線，下一輪能正常同步', async () => {
    const offline = setup({ online: false });
    await offline.engine.syncOnce();

    // 換成連線的環境重跑（模擬回線）
    const s = setup();
    s.engine.setOnline(false);
    s.engine.setOnline(true);
    const r = await s.engine.syncOnce();
    expect(r.state).toBe('synced');
  });
});

describe('syncOnce 的推送', () => {
  it('遠端沒有的本地紀錄用 append', async () => {
    const s = setup({ local: [txn('a', 'T1')] });
    const r = await s.engine.syncOnce();

    expect(s.appended).toHaveLength(1);
    expect(s.appended[0]![0]![8]).toBe('a');
    expect(r.pushed).toBe(1);
  });

  it('遠端已經有這個 id 時改用 update，不會產生重複列（§14.6 去重）', async () => {
    const s = setup({
      local: [txn('a', '2026-09-06T12:00:00.000Z')],
      remote: [txn('a', '2026-09-06T10:00:00.000Z')],
    });
    await s.engine.syncOnce();

    expect(s.appended).toHaveLength(0);
    expect(s.updated).toHaveLength(1);
  });

  it('update 的列號跟著遠端實際位置走', async () => {
    const s = setup({
      local: [txn('b', '2026-09-06T12:00:00.000Z')],
      remote: [txn('a', 'T1'), txn('b', '2026-09-06T10:00:00.000Z')],
    });
    await s.engine.syncOnce();
    // 第 1 列是標頭，b 是資料第 2 筆 → 第 3 列
    expect(s.updated[0]!.range).toBe('紀錄!A3:O3');
  });

  // 少了 O 欄，稅推上去會被切掉；多一欄也不能，會蓋到右邊的空白
  it('推送用的範圍含稅欄', async () => {
    expect(TXN_RANGE).toBe('紀錄!A2:O');
    const s = setup({ local: [txn('a', '2026-09-06T12:00:00.000Z')] });
    await s.engine.syncOnce();
    expect(s.client.append).toHaveBeenCalledWith('SID', '紀錄!A2:O', expect.anything());
  });

  it('遠端較新時不推，避免把新的蓋回去', async () => {
    const s = setup({
      local: [txn('a', '2026-09-06T10:00:00.000Z')],
      remote: [txn('a', '2026-09-06T12:00:00.000Z')],
    });
    const r = await s.engine.syncOnce();
    expect(r.pushed).toBe(0);
    expect(s.appended).toHaveLength(0);
    expect(s.updated).toHaveLength(0);
  });

  it('兩邊都沒變時完全不打寫入 API', async () => {
    const s = setup({ local: [txn('a', 'T1')], remote: [txn('a', 'T1')] });
    await s.engine.syncOnce();
    expect(s.client.append).not.toHaveBeenCalled();
    expect(s.client.update).not.toHaveBeenCalled();
  });
});

describe('syncOnce 的合併結果', () => {
  it('存回本地的是合併後的完整清單', async () => {
    const s = setup({ local: [txn('a', 'T1')], remote: [txn('b', 'T1')] });
    await s.engine.syncOnce();
    expect(s.saved[0]!.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('遠端較新的內容會覆蓋本地', async () => {
    const s = setup({
      local: [txn('a', '2026-09-06T10:00:00.000Z', { note: '舊的' })],
      remote: [txn('a', '2026-09-06T12:00:00.000Z', { note: '新的' })],
    });
    await s.engine.syncOnce();
    expect(s.saved[0]![0]!.note).toBe('新的');
  });

  it('遠端手加的無 id 列被跳過，不會變成一筆改不動的帳', async () => {
    const s = setup();
    (s.client.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      ['2026-09-06', '外食', '飲料', '10.00', 'CAD', '10.00', '我', '', '', '', '', '', 'FALSE', ''],
    ]);
    const r = await s.engine.syncOnce();
    expect(r.pulled).toBe(0);
    expect(s.saved[0]).toEqual([]);
  });

  it('讀的是標頭以下的範圍', async () => {
    const s = setup();
    await s.engine.syncOnce();
    expect(s.client.get).toHaveBeenCalledWith('SID', TXN_RANGE);
    expect(TXN_RANGE).toContain('A2');
  });
});

describe('稅欄標頭', () => {
  it('有東西要推時，推之前先補標頭', async () => {
    const s = setup({ local: [txn('a', '2026-09-06T12:00:00.000Z')] });
    await s.engine.syncOnce();
    expect(s.headered).toEqual(['SID']);
  });

  // 只是輪詢拉資料的那幾十次不該為了一格標頭多打 API
  it('沒東西要推時不補', async () => {
    const s = setup();
    await s.engine.syncOnce();
    expect(s.headered).toEqual([]);
  });

  // 這是這次修正的重點：補標頭失敗（例如使用者在 Google Sheets 上把第 1 列
  // 設成保護範圍，O1 從此永久 403）不可以擋住同步。`syncOnce` 呼叫
  // `deps.ensureTaxHeader` 這一行本身沒有任何 try/catch 保護，它完全仰賴
  // 真實的 ensureTaxHeader（taxHeader.ts）自己把錯誤吞掉、從不往外丟——這支
  // 測試釘住的正是這個契約：即使補標頭那一步實際上失敗了，後面的 append 與
  // saveTxns 還是要照跑，一輪同步依然要跑完、成功，不能卡在 fail。回歸前的舊
  // bug 是：這一步丟錯會讓整輪 syncOnce 掉進 catch，該輪一筆帳都推不出去，
  // 連已經拉回來的遠端資料也不會存進本機。
  it('補標頭失敗時，同步仍然完成：append 與 saveTxns 都會跑，狀態是 synced', async () => {
    const s = setup({ local: [txn('a', '2026-09-06T12:00:00.000Z')], headerThrows: true });
    const r = await s.engine.syncOnce();

    // 標頭那次「呼叫」失敗了，沒有留下任何痕跡——這正是真實情境：不設旗標，
    // 下一輪還會再試
    expect(s.headered).toEqual([]);
    // 但推送與存回本機完全不受影響
    expect(s.appended).toHaveLength(1);
    expect(s.saved).toHaveLength(1);
    expect(r.state).toBe('synced');
    expect(s.states).toEqual(['syncing', 'synced']);
  });
});
