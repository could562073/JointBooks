import { NeedsConnectError } from '../auth/gis';
import type { Category } from '../domain/types';
import { SheetsError, type SheetsClient } from '../sheets/client';
import { SHEET } from '../sheets/ledgerSheet';
import { rowsToCategories } from '../sheets/rows';

export type JoinOutcome =
  | { kind: 'ok'; categories: number }
  /** 對方還沒把帳本分享給這個 Google 帳號 */
  | { kind: 'not-shared' }
  /** 連結裡的帳本不存在（被刪了，或連結有誤） */
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

export type JoinPersist = {
  replaceCategories(cs: readonly Category[]): Promise<void>;
  setJoinedSid(sid: string): Promise<void>;
};

/**
 * §8.1 加入對方的帳本：先確認這個 Google 帳號真的讀得到那份試算表，再把對方的
 * 分類搬過來，最後才記下「我加入的是這一本」。
 *
 * 分類一定要搬：兩支手機各自的預設分類 id 不同，不搬的話她記的帳在你那邊對不上
 * 分類，預算與統計會各算各的。讀不到就什麼都不寫，免得記下一本打不開的帳。
 */
export async function joinLedger(
  client: SheetsClient,
  sid: string,
  persist: JoinPersist
): Promise<JoinOutcome> {
  let rows: string[][];
  try {
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
    case 'error': return `加入失敗：${o.message}`;
  }
}
