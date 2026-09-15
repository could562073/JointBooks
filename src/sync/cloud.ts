import { browserTokenStore, createTokenProvider, type TokenProvider } from '../auth/gis';
import type { Category } from '../domain/types';
import { createSheetsClient, type SheetsClient } from '../sheets/client';
import { createLedger, ledgerTitles, type LedgerEnv } from '../sheets/ledgerSheet';
import { joinLedger, joinOutcomeText } from './joinLedger';

/** 雲端＝Google 登入（token 只放記憶體）＋讀寫試算表的客戶端 */
export type Cloud = {
  tokens: TokenProvider;
  client: SheetsClient;
  /** 這一份 App 只建立、加入這個環境的帳本 */
  env: LedgerEnv;
};

export function createCloud(
  clientId: string,
  env: LedgerEnv,
  // token 存 localStorage：到期前重整、重開 App 都不必重新連線
  tokens: TokenProvider = createTokenProvider({ clientId, store: browserTokenStore() })
): Cloud {
  return { tokens, client: createSheetsClient({ token: () => tokens.token() }), env };
}

export type EnsureLedgerDeps = {
  joinedSid(): Promise<string | null>;
  setJoinedSid(sid: string): Promise<void>;
  categories(): Promise<readonly Category[]>;
  /** 接回之前建的帳本時，用那一本的分類取代本機預設 */
  replaceCategories(cs: readonly Category[]): Promise<void>;
  year: number;
  env: LedgerEnv;
};

/**
 * 登入後確保這台裝置有一本帳：已經有（自己建過、或加入過對方的）就沿用，
 * 沒有才在自己的雲端硬碟建一本並記下來。
 *
 * 不能每次登入都建：那會在硬碟裡堆出一串同名的「饅頭記帳」，而且兩台
 * 手機會各自同步到不同的那一本。
 *
 * 沿用時不再檢查環境：本機資料依網址分開，開發版（localhost）與正式版讀不到
 * 彼此記下的帳本 id，會混到的只有「貼別人的邀請連結」，那一關在 joinLedger 擋。
 */
export async function ensureLedger(client: SheetsClient, d: EnsureLedgerDeps): Promise<string> {
  const existing = await d.joinedSid();
  if (existing) return existing;

  // 換了手機、清過資料：先找自己之前用這個 App 建的帳本接回去，不要再建一本。
  // 只接自己擁有的——別人分享過來的不自動加入，使用者選的是「建立自己的帳本」
  const own = (await client.findLedgers(ledgerTitles(d.env))).filter((f) => f.ownedByMe);
  for (const f of own) {
    const r = await joinLedger(client, f.id, d.env, {
      replaceCategories: d.replaceCategories,
      setJoinedSid: d.setJoinedSid,
    });
    if (r.kind === 'ok') return f.id;
    // 同名但屬於另一個環境（例如改名前沒有環境標記的開發帳本）：不是這一本，看下一個
    if (r.kind === 'wrong-env') continue;
    throw new Error(joinOutcomeText(r) ?? r.kind);
  }

  const id = await createLedger(client, await d.categories(), d.year, d.env);
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
