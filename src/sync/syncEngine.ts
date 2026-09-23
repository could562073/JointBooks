import { NeedsConnectError } from '../auth/gis';
import type { Txn } from '../domain/types';
import { rowToTxn, txnToRow } from '../sheets/rows';
import type { SheetsClient } from '../sheets/client';
import { mergeTxns, needsAppend } from './merge';
import { nextState, type SyncState } from './state';

/** 紀錄頁的資料範圍。第 1 列是標頭，所以從第 2 列起算；O 欄是稅 */
export const TXN_RANGE = '紀錄!A2:O';

export type SyncDeps = {
  client: SheetsClient;
  spreadsheetId(): string | null;
  localTxns(): Promise<Txn[]>;
  saveTxns(ts: readonly Txn[]): Promise<void>;
  isOnline(): boolean;
  onState(s: SyncState): void;
};

export type SyncResult = {
  state: SyncState;
  pulled: number;
  pushed: number;
};

/**
 * §14.6 的一次同步：拉遠端 → 合併 → 推本地較新的 → 存回本地。
 *
 * 推送一律先判斷該 append 還是 update：遠端已經有這個 id 就 update，
 * 沒有才 append。少了這一步，一次逾時但其實成功的 append 在重試時會變成
 * 兩列一模一樣的帳（§14.6 去重）。
 */
export function createSyncEngine(deps: SyncDeps) {
  let state: SyncState = 'idle';

  function to(e: Parameters<typeof nextState>[1]): SyncState {
    state = nextState(state, e);
    deps.onState(state);
    return state;
  }

  async function syncOnce(): Promise<SyncResult> {
    const sid = deps.spreadsheetId();
    if (!sid) return { state, pulled: 0, pushed: 0 };

    if (!deps.isOnline()) {
      return { state: to({ type: 'offline' }), pulled: 0, pushed: 0 };
    }

    // 上一輪停在 offline 的話要先回到 idle，否則 start 會被 offline 分支吃掉
    if (state === 'offline') to({ type: 'online' });
    to({ type: 'start' });

    try {
      const rows = await deps.client.get(sid, TXN_RANGE);
      // 一併記住每個 id 在第幾列：更新要用列號，而列號會因排序與插入而位移，
      // 所以每次拉取都重建，不能快取
      const rowOf = new Map<string, number>();
      const remote: Txn[] = [];
      rows.forEach((row, i) => {
        const t = rowToTxn(row);
        if (!t) return;
        remote.push(t);
        // +2：第 1 列是標頭，陣列又從 0 起算
        rowOf.set(t.id, i + 2);
      });

      const local = await deps.localTxns();
      const { merged, toPush } = mergeTxns(local, remote);
      const remoteIds = new Set(remote.map((t) => t.id));

      for (const t of toPush) {
        if (needsAppend(t.id, remoteIds)) {
          await deps.client.append(sid, TXN_RANGE, [txnToRow(t)]);
        } else {
          const line = rowOf.get(t.id)!;
          await deps.client.update(sid, `紀錄!A${line}:O${line}`, [txnToRow(t)]);
        }
      }

      await deps.saveTxns(merged);
      return { state: to({ type: 'done' }), pulled: remote.length, pushed: toPush.length };
    } catch (e) {
      // token 過期是 token model 的常態，要請使用者點一下重新連線，不是亮紅燈的失敗
      if (e instanceof NeedsConnectError) return { state: to({ type: 'needs-auth' }), pulled: 0, pushed: 0 };
      return { state: to({ type: 'fail' }), pulled: 0, pushed: 0 };
    }
  }

  return {
    syncOnce,
    get state() { return state; },
    /** 網路狀態變化由外層（online／offline 事件）餵進來 */
    setOnline(online: boolean) { to({ type: online ? 'online' : 'offline' }); },
  };
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
