import { NeedsConnectError } from '../auth/gis';
import type { Category } from '../domain/types';
import { SheetsError, type SheetsClient } from '../sheets/client';
import { ENV_RANGE, ledgerEnvOf, SHEET, type LedgerEnv } from '../sheets/ledgerSheet';
import { rowsToCategories } from '../sheets/rows';

export type JoinOutcome =
  | { kind: 'ok'; categories: number }
  /** 對方還沒把帳本分享給這個 Google 帳號 */
  | { kind: 'not-shared' }
  /** 連結裡的帳本不存在（被刪了，或連結有誤） */
  | { kind: 'not-found' }
  /** 連結指向另一個環境的帳本（開發版的連結貼進正式版，或反過來） */
  | { kind: 'wrong-env'; ledger: LedgerEnv }
  | { kind: 'error'; message: string };

export type JoinPersist = {
  replaceCategories(cs: readonly Category[]): Promise<void>;
  setJoinedSid(sid: string): Promise<void>;
};

/**
 * §8.1 加入對方的帳本：先確認這個 Google 帳號真的讀得到那份試算表、而且是這個
 * 環境的帳本，再把對方的分類搬過來，最後才記下「我加入的是這一本」。
 *
 * 分類一定要搬：兩支手機各自的預設分類 id 不同，不搬的話她記的帳在你那邊對不上
 * 分類，預算與統計會各算各的。讀不到或環境不對就什麼都不寫，免得記下一本打不開
 * 或不該碰的帳。
 */
export async function joinLedger(
  client: SheetsClient,
  sid: string,
  env: LedgerEnv,
  persist: JoinPersist
): Promise<JoinOutcome> {
  let rows: string[][];
  try {
    // 先看環境再讀分類：環境不對就不多讀、什麼都不寫
    const ledger = ledgerEnvOf((await client.get(sid, ENV_RANGE))[0]?.[0]);
    if (ledger !== env) return { kind: 'wrong-env', ledger };
    rows = await client.get(sid, `${SHEET.config}!A2:J`);
  } catch (e) {
    // 需要重新連線交給呼叫端處理（它握有使用者的點擊，才能叫出 Google 視窗）
    if (e instanceof NeedsConnectError) throw e;
    if (e instanceof SheetsError && e.status === 403) return { kind: 'not-shared' };
    if (e instanceof SheetsError && e.status === 404) return { kind: 'not-found' };
    return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
  }

  const categories = rowsToCategories(rows);
  // 對方的配置頁是空的就保留本機預設，不要把分類清成零
  if (categories.length > 0) await persist.replaceCategories(categories);
  await persist.setJoinedSid(sid);
  return { kind: 'ok', categories: categories.length };
}

/** 給畫面用的說明文字 */
export function joinOutcomeText(o: JoinOutcome): string | null {
  switch (o.kind) {
    case 'ok': return null;
    case 'not-shared': return '還讀不到這本帳。請對方在邀請面板輸入你的 Google 帳號並按「分享帳本」，再試一次。';
    case 'not-found': return '找不到這本帳，連結可能有誤或帳本已被刪除。請對方重新產生邀請連結。';
    case 'wrong-env': return o.ledger === 'dev'
      ? '這是開發版建立的測試帳本，正式版不能加入。請對方從正式版的邀請面板重新產生連結。'
      : '這是正式版的帳本，開發版不能加入，免得測試資料寫進真正的帳。';
    case 'error': return `加入失敗：${o.message}`;
  }
}
