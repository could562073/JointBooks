import { createTokenProvider, type TokenProvider } from '../auth/gis';
import type { Category } from '../domain/types';
import { createSheetsClient, type SheetsClient } from '../sheets/client';
import { createLedger } from '../sheets/ledgerSheet';

/** 雲端＝Google 登入（token 只放記憶體）＋讀寫試算表的客戶端 */
export type Cloud = {
  tokens: TokenProvider;
  client: SheetsClient;
};

export function createCloud(
  clientId: string,
  tokens: TokenProvider = createTokenProvider({ clientId })
): Cloud {
  return { tokens, client: createSheetsClient({ token: () => tokens.token() }) };
}

export type EnsureLedgerDeps = {
  joinedSid(): Promise<string | null>;
  setJoinedSid(sid: string): Promise<void>;
  categories(): Promise<readonly Category[]>;
  year: number;
};

/**
 * 登入後確保這台裝置有一本帳：已經有（自己建過、或加入過對方的）就沿用，
 * 沒有才在自己的雲端硬碟建一本並記下來。
 *
 * 不能每次登入都建：那會在硬碟裡堆出一串同名的「加拿大共用記帳」，而且兩台
 * 手機會各自同步到不同的那一本。
 */
export async function ensureLedger(client: SheetsClient, d: EnsureLedgerDeps): Promise<string> {
  const existing = await d.joinedSid();
  if (existing) return existing;
  const id = await createLedger(client, await d.categories(), d.year);
  await d.setJoinedSid(id);
  return id;
}

/** Google 連線失敗時給人看的說明 */
export function connectErrorText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  switch (m) {
    case 'popup_failed_to_open': return '沒有開出 Google 登入視窗。請允許這個網站的彈出視窗後再試一次。';
    case 'popup_closed': return '登入視窗被關掉了，再按一次就好。';
    case 'access_denied': return '沒有完成 Google 授權。';
    case 'scopes_not_granted': return '請勾選所有權限，帳本才能存到 Google 試算表。';
    case 'gis_load_failed': return '連不到 Google 登入服務，請確認網路後再試一次。';
    default: return `連線失敗：${m}`;
  }
}
