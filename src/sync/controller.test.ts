import { describe, it, expect, afterEach, vi } from 'vitest';
import { NeedsConnectError } from '../auth/gis';
import type { Txn } from '../domain/types';
import type { SheetsClient } from '../sheets/client';
import { REV_RANGE } from '../sheets/ledgerSheet';
import { txnToRow } from '../sheets/rows';
import { createSyncController, POLL_MS, PUSH_DEBOUNCE_MS } from './controller';
import { TXN_RANGE } from './syncEngine';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

function txn(id: string, cents = 1_000): Txn {
  return {
    id, date: '2026-09-10', mainId: 'c1', subId: 's1', mainName: '外食', subName: '飲料',
    amountCents: cents, currency: 'CAD', actualCadCents: cents, by: '我', note: '',
    createdAt: '2026-09-10T10:00:00.000Z', updatedAt: '2026-09-10T10:00:00.000Z', deleted: false,
  };
}

/** 一張「真的」試算表：紀錄列＋版本戳記那一格 */
function setup(opts: { connected?: boolean; visible?: boolean } = {}) {
  const sheet = { rows: [] as string[][], rev: '' };
  let local: Txn[] = [];
  const get = vi.fn(async (_s: string, range: string) => {
    if (range === REV_RANGE) return sheet.rev ? [[sheet.rev]] : [];
    return sheet.rows.map((r) => [...r]);
  });
  const client = {
    get,
    append: vi.fn(async (_s: string, _r: string, rows: string[][]) => {
      sheet.rows.push(...rows.map((r) => [...r]));
      return { updates: { updatedRange: 'x' } };
    }),
    update: vi.fn(async (_s: string, range: string, rows: string[][]) => {
      if (range === REV_RANGE) sheet.rev = rows[0]![0]!;
    }),
  } as unknown as SheetsClient;

  const states: string[] = [];
  const onPulled = vi.fn();
  const onSynced = vi.fn();
  let clock = 1_000;
  const ctl = createSyncController({
    client,
    tokens: { isConnected: () => opts.connected ?? true },
    spreadsheetId: () => 'S',
    localTxns: async () => local,
    saveTxns: async (ts) => { local = [...ts]; },
    onPulled, onState: (s) => states.push(s), onSynced,
    isOnline: () => true,
    isVisible: () => opts.visible ?? true,
    now: () => (clock += 1),
  });
  const fullPulls = () => get.mock.calls.filter((c) => c[1] === TXN_RANGE).length;
  return {
    ctl, sheet, client, states, onPulled, onSynced, fullPulls,
    setLocal: (ts: Txn[]) => { local = ts; },
    getLocal: () => local,
  };
}

describe('同步控制器', () => {
  it('一開始完整同步一次：拉資料、畫面重讀、標記同步完成', async () => {
    const s = setup();
    s.sheet.rows.push(txnToRow(txn('remote-1')));
    await s.ctl.syncNow();
    expect(s.fullPulls()).toBe(1);
    expect(s.getLocal().map((t) => t.id)).toEqual(['remote-1']);
    expect(s.onPulled).toHaveBeenCalledTimes(1);
    expect(s.onSynced).toHaveBeenCalledTimes(1);
  });

  it('版本戳記沒變時，輪詢只讀那一格，不拉整張紀錄表', async () => {
    const s = setup();
    await s.ctl.syncNow();
    await s.ctl.syncNow();
    await s.ctl.syncNow();
    expect(s.fullPulls()).toBe(1);
  });

  it('對方推了新帳（戳記變了）：下一輪就完整同步，把它拉下來', async () => {
    const s = setup();
    await s.ctl.syncNow();
    s.sheet.rows.push(txnToRow(txn('from-wife')));
    s.sheet.rev = 'wife-1';
    await s.ctl.syncNow();
    expect(s.fullPulls()).toBe(2);
    expect(s.getLocal().map((t) => t.id)).toContain('from-wife');
  });

  it('本機記帳後推上去並改寫戳記，讓對方知道有新東西', async () => {
    const s = setup();
    await s.ctl.syncNow();
    s.setLocal([txn('mine')]);
    s.ctl.requestPush();
    await s.ctl.syncNow();
    expect(s.sheet.rows).toHaveLength(1);
    expect(s.client.update).toHaveBeenCalledWith('S', REV_RANGE, [[expect.any(String)]]);
    expect(s.sheet.rev).not.toBe('');
  });

  it('推完之後下一輪會再完整同步一次（收下同步途中對方可能推的），之後才閒置', async () => {
    const s = setup();
    await s.ctl.syncNow();
    s.setLocal([txn('mine')]);
    s.ctl.requestPush();
    await s.ctl.syncNow();           // 推
    const afterPush = s.fullPulls();
    await s.ctl.syncNow();           // 戳記是自己剛寫的 → 與推之前讀到的不同 → 完整同步
    await s.ctl.syncNow();           // 這次才閒置
    expect(s.fullPulls()).toBe(afterPush + 1);
  });

  it('連續記好幾筆只推一次（合併 1.2 秒內的變更）', async () => {
    vi.useFakeTimers();
    const s = setup();
    await s.ctl.syncNow();
    const before = s.fullPulls();
    s.ctl.requestPush();
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS / 2);
    s.ctl.requestPush();
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS / 2);
    s.ctl.requestPush();
    await vi.advanceTimersByTimeAsync(PUSH_DEBOUNCE_MS);
    expect(s.fullPulls()).toBe(before + 1);
  });

  it('開始後每 5 秒輪詢一次；App 在背景時不輪詢', async () => {
    vi.useFakeTimers();
    const fg = setup();
    const stop = fg.ctl.start();
    await vi.advanceTimersByTimeAsync(0);
    const readsAfterStart = (fg.client.get as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect((fg.client.get as ReturnType<typeof vi.fn>).mock.calls.length).toBe(readsAfterStart + 3);
    stop();

    const bg = setup({ visible: false });
    const stopBg = bg.ctl.start();
    await vi.advanceTimersByTimeAsync(0);
    const bgReads = (bg.client.get as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect((bg.client.get as ReturnType<typeof vi.fn>).mock.calls.length).toBe(bgReads);
    stopBg();
  });

  it('停止之後不再打任何 API', async () => {
    vi.useFakeTimers();
    const s = setup();
    const stop = s.ctl.start();
    await vi.advanceTimersByTimeAsync(0);
    stop();
    const reads = (s.client.get as ReturnType<typeof vi.fn>).mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_MS * 5);
    expect((s.client.get as ReturnType<typeof vi.fn>).mock.calls.length).toBe(reads);
  });

  it('沒連線 Google 時不打 API，狀態轉成「點一下連線」', async () => {
    const s = setup({ connected: false });
    await s.ctl.syncNow();
    expect(s.client.get).not.toHaveBeenCalled();
    expect(s.states).toContain('needs-auth');
  });

  it('同步途中 token 過期：轉成 needs-auth，不是紅燈的 error', async () => {
    const s = setup();
    (s.client.get as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new NeedsConnectError());
    await s.ctl.syncNow();
    expect(s.states.at(-1)).toBe('needs-auth');
  });

  it('停止之後，卡著等補跑的 again 不會再打 API', async () => {
    const s = setup();
    const realGet = s.client.get;   // 就是 setup() 裡的 get vi.fn，呼叫次數看它
    // 只卡住第一次呼叫：讓 syncNow() 排好 again、stop() 也呼叫完之後才放行
    const gate: { release: (() => void) | null } = { release: null };
    let gated = true;
    (s.client as { get: SheetsClient['get'] }).get = ((...a: Parameters<SheetsClient['get']>) => {
      if (gated) {
        gated = false;
        return new Promise<Awaited<ReturnType<SheetsClient['get']>>>((resolve) => {
          gate.release = () => resolve(realGet(...a));
        });
      }
      return realGet(...a);
    }) as SheetsClient['get'];

    const stop = s.ctl.start();     // 觸發第一輪，卡在第一次 get
    const p1 = s.ctl.syncNow();     // 同步中再叫一次：跟第一輪拿到同一個 promise，排成 again
    stop();                         // 在第一輪結束前停止

    gate.release?.();               // 放行，讓卡住的第一輪繼續跑
    await p1;                       // 等第一輪連同它 .finally 裡「要不要補跑」的判斷都做完
    await new Promise((r) => setTimeout(r, 0));   // 如果沒被擋下，補跑的那一輪這裡會跑完

    // 每一輪一開始都會讀一次版本戳記（REV_RANGE），不管後面是不是提早返回：
    // 卡住等補跑的 again 若沒被 stop() 擋下，這裡就會看到第二次
    const revCalls = (realGet as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[1] === REV_RANGE).length;
    expect(revCalls).toBe(1);
    expect(s.onSynced).toHaveBeenCalledTimes(1);
  });

  it('同步進行中又叫一次：這一輪結束後補跑一輪，不會兩輪同時跑', async () => {
    const s = setup();
    let inFlight = 0;
    let maxInFlight = 0;
    const realGet = s.client.get;
    (s.client as { get: SheetsClient['get'] }).get = async (sid, range) => {
      inFlight += 1; maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      return realGet(sid, range);
    };
    const a = s.ctl.syncNow();
    s.ctl.requestPush();
    void s.ctl.syncNow();
    await a;
    await new Promise((r) => setTimeout(r, 20));
    expect(maxInFlight).toBe(1);
  });
});
