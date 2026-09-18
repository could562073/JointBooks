import type { Person } from '../domain/types';
import type { Account, LedgerRef, LocalFacts } from './accountState';

/**
 * 登入、登出、換帳號（設計見 docs/superpowers/specs/2026-09-18-guest-mode-and-account-design.md）。
 * 要做什麼由 planSignIn／planJoin 這兩個純函式決定，執行的部分在下面。
 */

export type SignInFacts = {
  /** 這次登入的帳號 */
  account: Account;
  lastAccount: Account | null;
  lastLedger: LedgerRef | null;
  /** 這個帳號自己建過、而且是這個環境的帳本 */
  ownLedger: string | null;
  local: LocalFacts;
};

/** 要使用者選合併、改用雲端還是取消 */
export type AskPlan = {
  kind: 'ask';
  /** 上次登入的帳號信箱；沒登入過是 null */
  from: string | null;
  to: string;
  /** 要接上的帳本；null＝這個帳號還沒有帳本，會開一本新的 */
  target: string | null;
  /** 在那本帳裡的身分：自己的帳本是「我」，加入對方的是「妻」 */
  self: Person;
  /** 手機上有幾筆帳 */
  count: number;
  /** 手機上的帳都是同一個人記的才能合併，不然會把對方記的算到自己頭上 */
  canMerge: boolean;
  account: Account;
};

export type SignInPlan =
  | { kind: 'rejoin'; sid: string; self: Person }
  | { kind: 'attach'; sid: string }
  | { kind: 'create' }
  | AskPlan;

export function planSignIn(f: SignInFacts): SignInPlan {
  const same = f.lastAccount !== null && f.lastAccount.id === f.account.id;
  // 同一個帳號登出後再登入：接回上次那本（受邀者接回對方的帳本）
  if (same && f.lastLedger) return { kind: 'rejoin', sid: f.lastLedger.sid, self: f.lastLedger.self };
  // 手機上沒帳：沒有東西會被蓋掉或帶錯地方，不用問
  if (f.local.count === 0) return f.ownLedger ? { kind: 'attach', sid: f.ownLedger } : { kind: 'create' };
  const canMerge = f.local.people.size <= 1;
  // 第一次登入（或同帳號）而且還沒有帳本：開新帳本把手機上的帳帶過去
  if (!f.ownLedger && (f.lastAccount === null || same) && canMerge) return { kind: 'create' };
  return {
    kind: 'ask', from: f.lastAccount?.email ?? null, to: f.account.email,
    target: f.ownLedger, self: '我', count: f.local.count, canMerge, account: f.account,
  };
}

/** 用邀請連結加入、而手機沒接著別本帳時：手機上有帳就先問 */
export function planJoin(f: {
  account: Account; lastAccount: Account | null; inviteSid: string; local: LocalFacts;
}): { kind: 'join' } | AskPlan {
  if (f.local.count === 0) return { kind: 'join' };
  return {
    kind: 'ask', from: f.lastAccount?.email ?? null, to: f.account.email,
    target: f.inviteSid, self: '妻', count: f.local.count, canMerge: f.local.people.size <= 1, account: f.account,
  };
}
