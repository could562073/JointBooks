import type { TokenProvider } from '../auth/gis';
import type { Person } from '../domain/types';
import { ledgerRepo } from '../repo/ledgerRepo';
import type { SheetsClient } from '../sheets/client';
import { createLedger, ENV_RANGE, ledgerEnvOf, ledgerTitles, type LedgerEnv } from '../sheets/ledgerSheet';
import {
  LAST_LEDGER_KEY, LOCAL_MODE_KEY, lastAccount, lastLedger, localFacts, rememberAccount,
  type Account, type LedgerRef, type LocalFacts,
} from './accountState';
import { connectErrorText } from './cloud';
import { joinLedger, joinOutcomeText } from './joinLedger';
import { setJoinedSid, setSelfPerson } from './ledgerId';

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

export type AccountDeps = {
  client: SheetsClient;
  tokens: Pick<TokenProvider, 'disconnect'>;
  env: LedgerEnv;
  now?(): number;
};

export type Linked = { kind: 'linked'; sid: string };

/** 登入途中給人看的錯誤：message 就是畫面上的文字 */
export class SignInError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignInError';
  }
}

export function signInErrorText(e: unknown): string {
  if (e instanceof SignInError) return e.message;
  // 離線時 fetch 丟 TypeError；讀不到帳號是 no_account
  if (e instanceof TypeError || (e instanceof Error && e.message === 'no_account')) {
    return '連不到 Google，請確認網路後再試一次。';
  }
  return connectErrorText(e);
}

const yearOf = (d: AccountDeps) => new Date(d.now?.() ?? Date.now()).getFullYear();

/** 這個帳號自己建過、而且是這個環境的帳本（同名的舊帳本可能屬於另一個環境） */
async function findOwnLedger(client: SheetsClient, env: LedgerEnv): Promise<string | null> {
  for (const f of await client.findLedgers(ledgerTitles(env))) {
    if (!f.ownedByMe) continue;
    if (ledgerEnvOf((await client.get(f.id, ENV_RANGE))[0]?.[0]) === env) return f.id;
  }
  return null;
}

/** 接上帳本之後一律做的事：記下帳本、身分與帳號，離開本機模式，忘掉登出時的那本 */
export async function finishLink(account: Account, sid: string, self: Person): Promise<void> {
  await setJoinedSid(sid);
  await setSelfPerson(self);
  await rememberAccount(account);
  await ledgerRepo.setMeta(LOCAL_MODE_KEY, false);
  await ledgerRepo.setMeta(LAST_LEDGER_KEY, null);
}

/** 手機上的帳全部改成這個身分。只在帳都是同一個人記的時候用（canMerge） */
async function rewriteBy(self: Person): Promise<void> {
  const ts = await ledgerRepo.allTxnsForSync();
  if (ts.every((t) => t.by === self)) return;
  await ledgerRepo.saveSyncedTxns(ts.map((t) => ({ ...t, by: self })));
}

/** 用手機上的分類開一本新帳本，手機上的帳算建立者的，同步時會推上去 */
async function createWithLocal(d: AccountDeps, account: Account): Promise<Linked> {
  const sid = await createLedger(d.client, await ledgerRepo.listCategories(), yearOf(d), d.env);
  await rewriteBy('我');
  await finishLink(account, sid, '我');
  return { kind: 'linked', sid };
}

/**
 * 登入：在 tokens.connect() 成功之後呼叫（connect 本身要在點擊事件裡由畫面叫）。
 * 需要使用者選擇時回傳 AskPlan，手機資料都還沒動；選好再交給 resolveAsk。
 */
export async function signIn(d: AccountDeps): Promise<Linked | AskPlan> {
  const facts: SignInFacts = {
    account: await d.client.aboutUser(),
    lastAccount: await lastAccount(),
    lastLedger: await lastLedger(),
    ownLedger: await findOwnLedger(d.client, d.env),
    local: await localFacts(),
  };
  return carryOut(d, facts);
}

async function carryOut(d: AccountDeps, facts: SignInFacts): Promise<Linked | AskPlan> {
  const plan = planSignIn(facts);
  switch (plan.kind) {
    case 'rejoin': {
      // 接回上次那本：只確認讀得到，分類不換——登出期間在手機上改的分類交給同步逐一合併
      const r = await joinLedger(d.client, plan.sid, d.env, {
        replaceCategories: async () => {},
        setJoinedSid: async () => {},
      });
      // 對方取消共用或帳本被刪：當作沒有上次那本，重新判斷
      if (r.kind === 'not-shared' || r.kind === 'not-found') return carryOut(d, { ...facts, lastLedger: null });
      if (r.kind !== 'ok') throw new SignInError(joinOutcomeText(r) ?? r.kind);
      await finishLink(facts.account, plan.sid, plan.self);
      return { kind: 'linked', sid: plan.sid };
    }
    case 'attach': {
      const r = await joinLedger(d.client, plan.sid, d.env, {
        replaceCategories: (cs) => ledgerRepo.replaceCategories(cs),
        setJoinedSid: async () => {},
      });
      if (r.kind !== 'ok') throw new SignInError(joinOutcomeText(r) ?? r.kind);
      await finishLink(facts.account, plan.sid, '我');
      return { kind: 'linked', sid: plan.sid };
    }
    case 'create':
      return createWithLocal(d, facts.account);
    case 'ask':
      return plan;
  }
}
