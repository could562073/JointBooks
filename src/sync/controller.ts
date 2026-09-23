import { NeedsConnectError, type TokenProvider } from '../auth/gis';
import type { Txn } from '../domain/types';
import type { SheetsClient } from '../sheets/client';
import { CATEGORIES_RANGE, REV_RANGE, writeCategories } from '../sheets/ledgerSheet';
import { rowsToCategories } from '../sheets/rows';
import type { CategoriesSync } from './categoriesSync';
import { mergeCategories } from './categoryMerge';
import { MEMBERS_RANGE, MEMBERS_READ_RANGE, membersToRows, rowsToMembers } from '../sheets/memberRows';
import type { MembersSync } from './members';
import type { SyncState } from './state';
import { createSyncEngine } from './syncEngine';

/**
 * 兩人同時開著 App 時，對方的新帳要在幾秒內出現（使用者要求）。
 *
 * Google Sheets 沒有推播，只能輪詢。配額是每位使用者每分鐘 60 次讀取：每 5 秒
 * 輪詢一次＝每分鐘 12 次，兩個人加起來 24 次，離上限（每人 60、整個專案 300）
 * 很遠，留得出寫入與重試的餘裕。
 */
export const POLL_MS = 5_000;

/** 本機一改就推，但連續記好幾筆時合成一次，免得每按一下就打一次 API */
export const PUSH_DEBOUNCE_MS = 1_200;

export type SyncControllerDeps = {
  client: SheetsClient;
  tokens: Pick<TokenProvider, 'isConnected'>;
  spreadsheetId(): string | null;
  /** 含已刪除的紀錄（假刪也要推上去，對方那邊才會消失） */
  localTxns(): Promise<Txn[]>;
  saveTxns(ts: readonly Txn[]): Promise<void>;
  /** 成員名稱與饅頭顏色（配置頁可改）；不給就不同步成員 */
  members?: MembersSync;
  /** 分類與月預算；不給就不同步分類 */
  categories?: CategoriesSync;
  /** 補寫紀錄頁的稅欄標頭；不給就不補（測試與舊呼叫點） */
  ensureTaxHeader?(sid: string): Promise<void>;
  /** 同步完成後讓畫面重讀本機資料 */
  onPulled(): Promise<void> | void;
  onState(s: SyncState): void;
  onSynced(at: number): void;
  isOnline?(): boolean;
  isVisible?(): boolean;
  now?(): number;
};

export type SyncController = {
  /** 開始輪詢並監聽上線／回到前景；回傳停止函式 */
  start(): () => void;
  /** 立刻同步一次（同步進行中再叫一次，會在這一輪結束後補跑一輪） */
  syncNow(): Promise<void>;
  /** 本機剛改了帳：標記有東西要推，稍等一下合併後同步 */
  requestPush(): void;
};

export function createSyncController(d: SyncControllerDeps): SyncController {
  const online = () => d.isOnline?.() ?? navigator.onLine;
  const visible = () => d.isVisible?.() ?? document.visibilityState !== 'hidden';
  const now = () => d.now?.() ?? Date.now();

  const engine = createSyncEngine({
    client: d.client,
    spreadsheetId: d.spreadsheetId,
    localTxns: d.localTxns,
    saveTxns: d.saveTxns,
    isOnline: online,
    onState: d.onState,
    ensureTaxHeader: d.ensureTaxHeader ?? (async () => {}),
  });

  // 剛打開 App 時本機可能有離線期間記的帳，第一輪一定完整同步
  let dirty = true;
  let lastRev: string | null = null;
  let running: Promise<void> | null = null;
  let again = false;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  // stop() 之後，卡著等這一輪跑完才補跑的 again 不能再啟動新的一輪——
  // 否則 signOut／換帳號後仍在飛的循環可能在 effect 清乾淨之後才把狀態蓋回去
  let stopped = false;

  async function readRev(sid: string): Promise<string> {
    const rows = await d.client.get(sid, REV_RANGE);
    return rows[0]?.[0] ?? '';
  }

  /**
   * 成員名稱與饅頭顏色：本機改過就推（最後寫入的贏）；沒改過、雲端有變才拉。
   * 回傳有沒有推——推了要改版本戳記，對方才會來拉。
   */
  async function syncMembers(sid: string, localDirty: boolean, remoteChanged: boolean): Promise<boolean> {
    const m = d.members;
    if (!m) return false;
    if (localDirty) {
      const mine = await m.local();
      await d.client.update(sid, MEMBERS_RANGE, membersToRows(mine));
      await m.markPushed(mine);
      return true;
    }
    if (remoteChanged) {
      const pulled = rowsToMembers(await d.client.get(sid, MEMBERS_READ_RANGE));
      if (pulled) await m.save(pulled);
    }
    return false;
  }

  /**
   * 分類與月預算：本機改過或雲端有變時，讀雲端的分類逐一合併（同一個分類修改時間較新的贏）。
   * 合併結果跟雲端不同就整批寫回（年報表跟著重寫），跟本機不同就存回本機。回傳有沒有推。
   *
   * 原本是整份「本機改過就推」：另一支手機還沒拉到新分類時按一次 ✓，就把整份舊的推上去，
   * 蓋掉對方剛改的月預算、圖示、子分類（使用者回報）。雲端的分類區是空的（被人手動清掉）時，
   * 合併結果就是本機那份，會寫回去補上，不會拿空的蓋掉本機。
   */
  async function syncCategories(sid: string, localDirty: boolean, remoteChanged: boolean): Promise<boolean> {
    const c = d.categories;
    if (!c || (!localDirty && !remoteChanged)) return false;
    const remote = rowsToCategories(await d.client.get(sid, CATEGORIES_RANGE));
    const local = await c.local();
    const { merged, pushNeeded, saveNeeded } = mergeCategories(local, remote, await c.preferLocal());
    if (pushNeeded) await writeCategories(d.client, sid, merged, new Date(now()).getFullYear());
    await c.settle(local, saveNeeded ? merged : null);
    return pushNeeded;
  }

  async function cycle(): Promise<void> {
    const sid = d.spreadsheetId();
    if (!sid) return;
    if (!online()) { await engine.syncOnce(); return; }   // 讓狀態機轉成 offline
    // 沒連線就別打 API：token() 反正會丟 NeedsConnectError，白白浪費一次請求
    if (!d.tokens.isConnected()) { d.onState('needs-auth'); return; }

    try {
      // 版本戳記要在同步「之前」讀：同步途中對方剛好也推了，若同步完才讀，
      // 會把對方那次的戳記當成已經拉過，下一輪就錯過它
      const revBefore = await readRev(sid);
      const membersDirty = (await d.members?.dirty()) ?? false;
      const categoriesDirty = (await d.categories?.dirty()) ?? false;
      if (!dirty && !membersDirty && !categoriesDirty && revBefore === lastRev) return;

      const r = await engine.syncOnce();
      if (r.state !== 'synced') return;   // offline／needs-auth／error：保留 dirty，下一輪再來

      const pushedMembers = await syncMembers(sid, membersDirty, revBefore !== lastRev);
      const pushedCategories = await syncCategories(sid, categoriesDirty, revBefore !== lastRev);

      dirty = false;
      lastRev = revBefore;
      if (r.pushed > 0 || pushedMembers || pushedCategories) {
        // 通知對方有新東西。自己不記這個新戳記，下一輪會再完整同步一次，
        // 順便收到同步途中對方可能推上來的變更
        await d.client.update(sid, REV_RANGE, [[String(now())]]);
      }
      await d.onPulled();
      d.onSynced(now());
    } catch (e) {
      d.onState(e instanceof NeedsConnectError ? 'needs-auth' : 'error');
    }
  }

  function syncNow(): Promise<void> {
    if (running) { again = true; return running; }
    running = cycle().finally(() => {
      running = null;
      if (again && !stopped) { again = false; void syncNow(); }
    });
    return running;
  }

  function requestPush(): void {
    dirty = true;
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => { pushTimer = null; void syncNow(); }, PUSH_DEBOUNCE_MS);
  }

  function start(): () => void {
    void syncNow();
    const poll = setInterval(() => { if (visible()) void syncNow(); }, POLL_MS);
    const onOnline = () => { engine.setOnline(true); void syncNow(); };
    const onOffline = () => engine.setOnline(false);
    // iPhone 不讓網頁 App 在背景跑：切回前景時立刻補一輪
    const onVisibility = () => { if (visible()) void syncNow(); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopped = true;
      clearInterval(poll);
      if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }

  return { start, syncNow, requestPush };
}
