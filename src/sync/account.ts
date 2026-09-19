import type { TokenProvider } from '../auth/gis';
import type { Category, Person } from '../domain/types';
import { ledgerRepo } from '../repo/ledgerRepo';
import type { SheetsClient } from '../sheets/client';
import { createLedger, ENV_RANGE, ledgerEnvOf, ledgerTitles, type LedgerEnv } from '../sheets/ledgerSheet';
import {
  LAST_LEDGER_KEY, LOCAL_MODE_KEY, enterLocalMode, lastAccount, lastLedger, localFacts, rememberAccount,
  type Account, type LedgerRef, type LocalFacts,
} from './accountState';
import { CATEGORIES_DIRTY_KEY } from './categoriesSync';
import { remapToLedger } from './categoryRemap';
import { connectErrorText } from './cloud';
import { joinLedger, joinOutcomeText } from './joinLedger';
import { clearJoinedSid, joinedSid, SELF_KEY, setJoinedSid, setSelfPerson } from './ledgerId';
import { MEMBERS_DIRTY_KEY, resetLocalMembers } from './members';

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

/**
 * 用邀請連結加入、而手機沒接著別本帳時：手機上有帳就先問。
 * 但如果這個邀請連結正是登出前接著的那本，不問——手機上的帳這時混著兩個人記的
 * （登出後任何一方都可能在本機記帳），既不能合併也不該被「改用對方帳本」清掉，
 * 直接接回去，交給同步逐一合併（I2）。
 */
export function planJoin(f: {
  account: Account; lastAccount: Account | null; inviteSid: string; local: LocalFacts; lastLedger: LedgerRef | null;
}): { kind: 'join' } | { kind: 'rejoin'; self: Person } | AskPlan {
  if (f.lastLedger?.sid === f.inviteSid) return { kind: 'rejoin', self: f.lastLedger.self };
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

/**
 * 用手機上的分類開一本新帳本，手機上的帳算建立者的，同步時會推上去。
 * discardLocal＝true（改用雲端、沒有既有帳本可接）時開完帳本才清掉手機上的帳：
 * 建立失敗（離線、配額）不能先把資料清掉，不然帳就沒了（I1）。
 * 先 bootstrap 再讀分類：全新安裝的分類表還是空的，不然會開出一本沒有分類的帳（M1）。
 */
async function createWithLocal(d: AccountDeps, account: Account, discardLocal = false): Promise<Linked> {
  await ledgerRepo.bootstrap();
  const sid = await createLedger(d.client, await ledgerRepo.listCategories(), yearOf(d), d.env);
  if (discardLocal) {
    await ledgerRepo.clearTxns();
    await resetLocalMembers();
  }
  await rewriteBy('我');
  await finishLink(account, sid, '我');
  return { kind: 'linked', sid };
}

/**
 * 登入：在 tokens.connect() 成功之後呼叫（connect 本身要在點擊事件裡由畫面叫）。
 * 需要使用者選擇時回傳 AskPlan，手機資料都還沒動；選好再交給 resolveAsk。
 */
export async function signIn(d: AccountDeps): Promise<Linked | AskPlan> {
  // 已經接著一本帳：這時該做的是重新連線（同步狀態那顆），不是重跑登入判斷——
  // 否則可能讓人選「改用雲端」「開新帳本」而清掉手機上的帳
  if (await joinedSid()) throw new SignInError('這台手機已經接著一本帳。');
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

export type AskChoice = 'merge' | 'cloud' | 'cancel';

export async function resolveAsk(
  plan: AskPlan,
  choice: AskChoice,
  d: AccountDeps
): Promise<Linked | { kind: 'cancelled' }> {
  if (choice === 'cancel') {
    // 不接任何帳本就不要留著連線：畫面還是本機模式，連著反而讓人以為登入了
    await d.tokens.disconnect();
    return { kind: 'cancelled' };
  }
  if (choice === 'merge' && !plan.canMerge) {
    throw new SignInError('手機上的帳有兩個人記的，不能合併。');
  }

  // 這個帳號還沒有帳本：開一本新的。改用雲端＝不帶手機上的帳，但要等帳本真的建好才清
  if (plan.target === null) {
    return createWithLocal(d, plan.account, choice === 'cloud');
  }

  // 先確定讀得到那本帳、拿到它的分類，才動手機上的資料
  let remote: Category[] = [];
  const r = await joinLedger(d.client, plan.target, d.env, {
    replaceCategories: async (cs) => { remote = [...cs]; },
    setJoinedSid: async () => {},
  });
  if (r.kind !== 'ok') throw new SignInError(joinOutcomeText(r) ?? r.kind);

  if (choice === 'cloud') {
    await ledgerRepo.clearTxns();
    await resetLocalMembers();
    if (remote.length > 0) await ledgerRepo.replaceCategories(remote);
    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, false);
  } else {
    const local = await ledgerRepo.listCategories();
    const txns = await ledgerRepo.allTxnsForSync();
    // 那本帳的配置頁是空的（被手動清掉）就沿用手機上的分類，不要把分類清成只剩用到的
    const m = remote.length > 0
      ? remapToLedger(local, remote, txns, d.now?.() ?? Date.now())
      : { categories: local, txns };
    await ledgerRepo.replaceCategories(m.categories);
    await ledgerRepo.saveSyncedTxns(m.txns.map((t) => ({ ...t, by: plan.self })));
    // 帶過去的分類要推上去；成員名稱與顏色以那本帳為準，不拿手機上的蓋過去
    await ledgerRepo.setMeta(CATEGORIES_DIRTY_KEY, true);
    await ledgerRepo.setMeta(MEMBERS_DIRTY_KEY, false);
  }
  await finishLink(plan.account, plan.target, plan.self);
  return { kind: 'linked', sid: plan.target };
}

/**
 * 登出：帳留在手機上變回本機模式，同一個帳號再登入時接回這一本。
 * 清掉這台手機上的通行證並撤銷 Google 的授權：授權碼流程只有顯示同意畫面時才發續期憑證，不撤銷的話下次登入會失敗。
 */
export async function signOut(d: {
  tokens: Pick<TokenProvider, 'disconnect'>;
  syncNow(): Promise<void>;
  waitMs?: number;
}): Promise<void> {
  // 先試著把還沒推的帳推上去；離線或太久就算了，帳留在手機上，同帳號再登入時補推
  await Promise.race([
    d.syncNow().catch(() => {}),
    new Promise<void>((r) => setTimeout(r, d.waitMs ?? 5_000)),
  ]);
  const sid = await joinedSid();
  if (sid) {
    const self: Person = (await ledgerRepo.getMeta<string>(SELF_KEY)) === '妻' ? '妻' : '我';
    await ledgerRepo.setMeta(LAST_LEDGER_KEY, { sid, self } satisfies LedgerRef);
  }
  await clearJoinedSid();
  await enterLocalMode();
  await d.tokens.disconnect();
}

/**
 * 這個功能上線前就登入的手機沒記過帳號：第一次連上 Google 時補記，之後換帳號登入才比得出來。
 * 讀不到（離線）就算了，下次連上再補。補記到了才回傳帳號，讓畫面顯示信箱
 */
export async function recordAccountIfMissing(client: Pick<SheetsClient, 'aboutUser'>): Promise<Account | null> {
  if (await lastAccount()) return null;
  try {
    const a = await client.aboutUser();
    await rememberAccount(a);
    return a;
  } catch {
    return null;
  }
}
