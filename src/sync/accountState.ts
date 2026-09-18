import type { Person } from '../domain/types';
import { ledgerRepo } from '../repo/ledgerRepo';
import { joinedSid } from './ledgerId';

/**
 * 不登入使用與登入／登出要記的東西（設計見 docs/superpowers/specs/2026-09-18-guest-mode-and-account-design.md）。
 * 跟 spreadsheetId 一樣放 IndexedDB 的 meta 表：resetDb 一起清，不會留下半殘狀態。
 */

/** 使用者選過「先不登入」或登出過：開 App 直接進本機模式，不再停在開始畫面 */
export const LOCAL_MODE_KEY = 'localMode';
/** 最後一次登入的 Google 帳號：換帳號登入時比對用 */
export const LAST_ACCOUNT_KEY = 'lastAccount';
/** 登出時接著的帳本與身分：同一個帳號再登入時接回這一本 */
export const LAST_LEDGER_KEY = 'lastLedger';

export type Account = { id: string; email: string };
export type LedgerRef = { sid: string; self: Person };
/** 'login'＝顯示開始畫面；sid 是 null＝本機模式 */
export type Link = 'login' | { sid: string | null };
/** 手機上沒刪掉的帳有幾筆、是誰記的 */
export type LocalFacts = { count: number; people: ReadonlySet<Person> };

export async function readLink(): Promise<Link> {
  const sid = await joinedSid();
  if (sid) return { sid };
  return (await ledgerRepo.getMeta<boolean>(LOCAL_MODE_KEY)) === true ? { sid: null } : 'login';
}

export async function enterLocalMode(): Promise<void> {
  await ledgerRepo.setMeta(LOCAL_MODE_KEY, true);
}

export async function lastAccount(): Promise<Account | null> {
  const v = await ledgerRepo.getMeta<Partial<Account> | null>(LAST_ACCOUNT_KEY);
  return v && typeof v.id === 'string' && typeof v.email === 'string' ? { id: v.id, email: v.email } : null;
}

export async function rememberAccount(a: Account): Promise<void> {
  await ledgerRepo.setMeta(LAST_ACCOUNT_KEY, { id: a.id, email: a.email });
}

export async function lastLedger(): Promise<LedgerRef | null> {
  const v = await ledgerRepo.getMeta<Partial<LedgerRef> | null>(LAST_LEDGER_KEY);
  return v && typeof v.sid === 'string' && (v.self === '我' || v.self === '妻')
    ? { sid: v.sid, self: v.self }
    : null;
}

export async function localFacts(): Promise<LocalFacts> {
  const ts = await ledgerRepo.listTxns();
  return { count: ts.length, people: new Set(ts.map((t) => t.by)) };
}
