# 不登入使用與登入／登出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 開始畫面可以「先不登入，直接使用」，配置頁可以登入／登出；換帳號登入時先確認要合併、改用雲端還是取消。

**Architecture:** 本機模式＝沒有接上的帳本（meta 的 `spreadsheetId` 是空的），App 其餘部分照舊。登入要做什麼由純函式 `planSignIn` 決定，執行放在 `sync/account.ts`，畫面只負責在點擊裡叫 `connect()`、顯示確認視窗。`App.tsx` 的 `Gate` 把「接上的帳本」變成 React 狀態交給 `Shell`，同步控制器依 sid 重新啟動。

**Tech Stack:** React 19、TypeScript、Zustand（`useLedger`）、Dexie（IndexedDB meta 表）、Vitest + Testing Library（jsdom、fake-indexeddb）。

**Spec:** `docs/superpowers/specs/2026-09-18-guest-mode-and-account-design.md`

## Global Constraints

- 畫面文字一律繁體中文，照設計文件的用詞：「先不登入，直接使用」「只存在這台手機」「登入 Google」「登出」「合併／改用雲端／取消」。
- `tokens.connect()` 必須在點擊事件裡**同步**呼叫（前面不能有 `await`），Safari 才不會擋 Google 視窗。
- 不新增 OAuth 權限範圍：帳號用 Drive `about.get`，現有的 `drive.file` 就夠。
- 新的狀態全部放 IndexedDB 的 meta 表（`ledgerRepo.getMeta/setMeta`），不放 localStorage。
- 登入途中任何一步失敗：不寫 `spreadsheetId`，本機資料不動。清手機資料只在確定讀得到目標帳本之後才做。
- 程式註解用中文，寫「為什麼」，跟周圍的註解密度一致。
- 每個 task 結束時：`npx vitest run <這個 task 的測試>` 通過、`npm run typecheck` 通過，再提交。
- Commit 訊息：英文 conventional 標題＋中文內文，結尾加
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## 檔案地圖

| 檔案 | 動作 | 負責 |
| --- | --- | --- |
| `src/sheets/client.ts` | 改 | 多 `aboutUser()` |
| `src/sync/accountState.ts` | 新 | meta 的 key 與讀寫：`readLink`、`lastAccount`、`lastLedger`、`localFacts` |
| `src/sync/categoryRemap.ts` | 新 | 合併時分類依名稱對應（純函式） |
| `src/sync/account.ts` | 新 | `planSignIn`／`planJoin`（純函式）、`signIn`、`resolveAsk`、`finishLink`、`signOut`、`recordAccountIfMissing` |
| `src/sync/state.ts`、`syncLabels.ts` | 改 | 新狀態 `local` |
| `src/components/SyncStatus.tsx`、`.module.css` | 改 | `local` 可以點 |
| `src/invite/LoginPage.tsx`、`.module.css` | 改 | 「先不登入，直接使用」 |
| `src/components/AccountSwitchDialog.tsx`、`.module.css` | 新 | 合併／改用雲端／取消 |
| `src/screens/settings/SettingsScreen.tsx`、`.module.css` | 改 | 「帳號」區 |
| `src/invite/useSignIn.ts` | 新 | 登入流程的 React hook |
| `src/App.tsx` | 改 | `Gate` 持有連結狀態、`Shell` 依 sid 同步、`Join` 先問 |

---

### Task 1: SheetsClient 讀目前登入的帳號

**Files:**
- Modify: `src/sheets/client.ts`（在 `findLedgers` 前面加方法）
- Test: `src/sheets/client.about.test.ts`

**Interfaces:**
- Produces: `client.aboutUser(): Promise<{ id: string; email: string }>`；讀不到 `permissionId` 時丟 `Error('no_account')`。

- [ ] **Step 1: 寫失敗的測試**

```ts
// src/sheets/client.about.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createSheetsClient } from './client';

function client(body: unknown) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    calls.push(String(url));
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
  });
  return { api: createSheetsClient({ token: async () => 'TK', fetch: fetchImpl as unknown as typeof fetch }), calls };
}

describe('aboutUser', () => {
  it('只要帳號的 permissionId 與信箱', async () => {
    const c = client({ user: { permissionId: 'P1', emailAddress: 'a@gmail.com' } });
    expect(await c.api.aboutUser()).toEqual({ id: 'P1', email: 'a@gmail.com' });
    expect(c.calls[0]).toContain('/drive/v3/about?');
    expect(decodeURIComponent(c.calls[0]!)).toContain('fields=user(emailAddress,permissionId)');
  });

  it('沒有 permissionId 就當作讀不到帳號', async () => {
    const c = client({ user: { emailAddress: 'a@gmail.com' } });
    await expect(c.api.aboutUser()).rejects.toThrow('no_account');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/sheets/client.about.test.ts`
Expected: FAIL，`c.api.aboutUser is not a function`

- [ ] **Step 3: 實作**

在 `src/sheets/client.ts` 回傳物件裡、`findLedgers` 之前加：

```ts
    /**
     * 目前登入的 Google 帳號。換帳號登入時用 permissionId 比對（不會變），信箱只拿來顯示。
     * drive.file 權限就讀得到，不必多要權限
     */
    async aboutUser(): Promise<{ id: string; email: string }> {
      const params = new URLSearchParams({ fields: 'user(emailAddress,permissionId)' });
      const r = await call<{ user?: { emailAddress?: string; permissionId?: string } }>(`${DRIVE}/about?${params}`);
      if (!r.user?.permissionId) throw new Error('no_account');
      return { id: r.user.permissionId, email: r.user.emailAddress ?? '' };
    },
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/sheets/client.about.test.ts && npm run typecheck`
Expected: 2 passed，typecheck 沒有錯誤

- [ ] **Step 5: Commit**

```bash
git add src/sheets/client.ts src/sheets/client.about.test.ts
git commit -m "feat(sheets): read the signed-in Google account" -m "換帳號登入時要比對是不是同一個帳號：用 Drive about.get 讀 permissionId 與信箱，drive.file 就夠，不多要權限。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: 本機記的連結狀態

**Files:**
- Create: `src/sync/accountState.ts`
- Test: `src/sync/accountState.test.ts`

**Interfaces:**
- Consumes: `joinedSid()`（`src/sync/ledgerId.ts`）、`ledgerRepo.getMeta/setMeta/listTxns`
- Produces:
  - `LOCAL_MODE_KEY = 'localMode'`、`LAST_ACCOUNT_KEY = 'lastAccount'`、`LAST_LEDGER_KEY = 'lastLedger'`
  - `type Account = { id: string; email: string }`
  - `type LedgerRef = { sid: string; self: Person }`
  - `type Link = 'login' | { sid: string | null }`
  - `type LocalFacts = { count: number; people: ReadonlySet<Person> }`
  - `readLink(): Promise<Link>`、`enterLocalMode(): Promise<void>`
  - `lastAccount(): Promise<Account | null>`、`rememberAccount(a: Account): Promise<void>`
  - `lastLedger(): Promise<LedgerRef | null>`
  - `localFacts(): Promise<LocalFacts>`

- [ ] **Step 1: 寫失敗的測試**

```ts
// src/sync/accountState.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../db/schema';
import { ledgerRepo } from '../repo/ledgerRepo';
import {
  LAST_LEDGER_KEY, enterLocalMode, lastAccount, lastLedger, localFacts, readLink, rememberAccount,
} from './accountState';
import { setJoinedSid } from './ledgerId';

beforeEach(async () => {
  await resetDb();
  await ledgerRepo.bootstrap();
});

describe('readLink：開 App 時要去哪', () => {
  it('什麼都沒記過：開始畫面', async () => {
    expect(await readLink()).toBe('login');
  });

  it('選過「先不登入」：本機模式', async () => {
    await enterLocalMode();
    expect(await readLink()).toEqual({ sid: null });
  });

  it('接著帳本就進那一本，不管 localMode', async () => {
    await enterLocalMode();
    await setJoinedSid('S1');
    expect(await readLink()).toEqual({ sid: 'S1' });
  });
});

describe('上次的帳號與帳本', () => {
  it('存了讀得回來', async () => {
    await rememberAccount({ id: 'P1', email: 'a@gmail.com' });
    expect(await lastAccount()).toEqual({ id: 'P1', email: 'a@gmail.com' });
    await ledgerRepo.setMeta(LAST_LEDGER_KEY, { sid: 'S1', self: '妻' });
    expect(await lastLedger()).toEqual({ sid: 'S1', self: '妻' });
  });

  it('沒存過或內容壞掉都當作沒有', async () => {
    expect(await lastAccount()).toBeNull();
    await ledgerRepo.setMeta(LAST_LEDGER_KEY, { sid: 3 });
    expect(await lastLedger()).toBeNull();
  });
});

describe('localFacts：手機上有沒有帳、是誰記的', () => {
  it('只算沒刪掉的帳', async () => {
    const [c] = await ledgerRepo.listCategories();
    const base = {
      date: '2026-09-18', mainId: c!.id, subId: c!.subs[0]!.id,
      amountCents: 100, currency: 'CAD' as const, actualCadCents: 100, note: '',
    };
    await ledgerRepo.addTxn({ ...base, by: '我' });
    const gone = await ledgerRepo.addTxn({ ...base, by: '妻' });
    await ledgerRepo.deleteTxn(gone!.id);

    const f = await localFacts();
    expect(f.count).toBe(1);
    expect([...f.people]).toEqual(['我']);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/sync/accountState.test.ts`
Expected: FAIL，找不到 `./accountState`

- [ ] **Step 3: 實作**

```ts
// src/sync/accountState.ts
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/sync/accountState.test.ts && npm run typecheck`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/sync/accountState.ts src/sync/accountState.test.ts
git commit -m "feat(sync): remember local mode, the last account and the last ledger" -m "本機模式、上次登入的帳號、登出時接著的帳本都記在 meta 表；readLink 決定開 App 時進開始畫面、本機模式還是那本帳。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: 登入要做什麼（純函式）

**Files:**
- Create: `src/sync/account.ts`（這個 task 只放型別與兩個純函式，後面的 task 往下加）
- Test: `src/sync/account.plan.test.ts`

**Interfaces:**
- Consumes: `Account`、`LedgerRef`、`LocalFacts`（Task 2）
- Produces:
  - `type SignInFacts = { account: Account; lastAccount: Account | null; lastLedger: LedgerRef | null; ownLedger: string | null; local: LocalFacts }`
  - `type AskPlan = { kind: 'ask'; from: string | null; to: string; target: string | null; self: Person; count: number; canMerge: boolean; account: Account }`
  - `type SignInPlan = { kind: 'rejoin'; sid: string; self: Person } | { kind: 'attach'; sid: string } | { kind: 'create' } | AskPlan`
  - `planSignIn(f: SignInFacts): SignInPlan`
  - `planJoin(f: { account: Account; lastAccount: Account | null; inviteSid: string; local: LocalFacts }): { kind: 'join' } | AskPlan`

- [ ] **Step 1: 寫失敗的測試**

```ts
// src/sync/account.plan.test.ts
import { describe, expect, it } from 'vitest';
import type { Person } from '../domain/types';
import { planJoin, planSignIn, type SignInFacts } from './account';

const A = { id: 'PA', email: 'a@gmail.com' };
const B = { id: 'PB', email: 'b@gmail.com' };
const local = (count: number, ...people: Person[]) => ({ count, people: new Set(people) });
const facts = (over: Partial<SignInFacts> = {}): SignInFacts => ({
  account: A, lastAccount: null, lastLedger: null, ownLedger: null, local: local(0), ...over,
});

describe('planSignIn', () => {
  it('同一個帳號登出後再登入：接回上次那本，身分照舊', () => {
    expect(planSignIn(facts({ lastAccount: A, lastLedger: { sid: 'S', self: '妻' }, local: local(3, '我', '妻') })))
      .toEqual({ kind: 'rejoin', sid: 'S', self: '妻' });
  });

  it('手機上沒帳：有自己的帳本就接上，沒有就開新的', () => {
    expect(planSignIn(facts({ ownLedger: 'OWN' }))).toEqual({ kind: 'attach', sid: 'OWN' });
    expect(planSignIn(facts())).toEqual({ kind: 'create' });
  });

  it('第一次登入、帳號還沒有帳本、手機上是一個人記的帳：開新帳本帶過去，不問', () => {
    expect(planSignIn(facts({ local: local(4, '我') }))).toEqual({ kind: 'create' });
  });

  it('帳號已經有帳本、手機上也有帳：問，目標是那本帳', () => {
    expect(planSignIn(facts({ ownLedger: 'OWN', local: local(2, '我') }))).toEqual({
      kind: 'ask', from: null, to: 'a@gmail.com', target: 'OWN', self: '我', count: 2, canMerge: true, account: A,
    });
  });

  it('換了帳號、新帳號沒有帳本：還是要問，目標是 null（會開新帳本）', () => {
    const p = planSignIn(facts({ account: B, lastAccount: A, local: local(1, '我') }));
    expect(p).toMatchObject({ kind: 'ask', from: 'a@gmail.com', to: 'b@gmail.com', target: null, canMerge: true });
  });

  it('手機上的帳混著兩個人記的：問，而且不能合併', () => {
    const p = planSignIn(facts({ account: B, lastAccount: A, ownLedger: 'OWN', local: local(5, '我', '妻') }));
    expect(p).toMatchObject({ kind: 'ask', canMerge: false });
    // 帳號沒有帳本也一樣：混著兩個人的帳不直接帶進新帳本
    expect(planSignIn(facts({ local: local(5, '我', '妻') }))).toMatchObject({ kind: 'ask', target: null, canMerge: false });
  });
});

describe('planJoin：用邀請連結加入時', () => {
  it('手機上沒帳：直接加入', () => {
    expect(planJoin({ account: A, lastAccount: null, inviteSid: 'INV', local: local(0) })).toEqual({ kind: 'join' });
  });

  it('手機上有帳：問，目標是對方的帳本，身分是「妻」', () => {
    expect(planJoin({ account: A, lastAccount: null, inviteSid: 'INV', local: local(2, '我') })).toEqual({
      kind: 'ask', from: null, to: 'a@gmail.com', target: 'INV', self: '妻', count: 2, canMerge: true, account: A,
    });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/sync/account.plan.test.ts`
Expected: FAIL，找不到 `./account`

- [ ] **Step 3: 實作**

```ts
// src/sync/account.ts
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/sync/account.plan.test.ts && npm run typecheck`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add src/sync/account.ts src/sync/account.plan.test.ts
git commit -m "feat(sync): decide what signing in should do" -m "planSignIn：同帳號接回上次那本、手機沒帳就接上或開新的、第一次登入帶著手機上的帳開新帳本，其他情況要問；手機上的帳混著兩個人記的不能合併。planJoin：用邀請連結加入時手機上有帳就先問。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: 合併時分類依名稱對應

**Files:**
- Create: `src/sync/categoryRemap.ts`
- Test: `src/sync/categoryRemap.test.ts`

**Interfaces:**
- Produces: `remapToLedger(local: readonly Category[], remote: readonly Category[], txns: readonly Txn[], now: number): { categories: Category[]; txns: Txn[] }`

規則（設計文件「合併」第 1 點，細節在這裡定死）：
- 主分類用「收支類型＋名稱（去頭尾空白）」對到雲端；雲端同名的有好幾個時，優先對到沒被刪的。
- 對到的主分類底下，子分類用名稱對；雲端沒有、而且有帳在用的子分類加進那個雲端分類，並把它的 `updatedAt` 改成 `now`（同步時才會推上去）。
- 對不上的主分類：只有被帳用到的才帶過去（沒用到的預設分類不要塞進對方的帳本），`order` 排在雲端分類後面，`updatedAt = now`。
- 帳的 `mainId`／`subId` 改指向對到的雲端 id；對不上的維持原本的 id（跟著帶過去的分類）。

- [ ] **Step 1: 寫失敗的測試**

```ts
// src/sync/categoryRemap.test.ts
import { describe, expect, it } from 'vitest';
import type { Category, Txn } from '../domain/types';
import { remapToLedger } from './categoryRemap';

const cat = (id: string, name: string, subs: [string, string][], over: Partial<Category> = {}): Category => ({
  id, kind: 'expense', name, icon: 'bus', budgetCents: null,
  subs: subs.map(([sid, sname]) => ({ id: sid, name: sname })),
  colorSet: 0, order: 0, active: true, updatedAt: 1, ...over,
});
const txn = (id: string, mainId: string, subId: string): Txn => ({
  id, date: '2026-09-18', mainId, subId, mainName: '', subName: '',
  amountCents: 100, currency: 'CAD', actualCadCents: 100, by: '我', note: '',
  createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z', deleted: false,
});
const NOW = 999;

describe('remapToLedger', () => {
  it('同名的主分類與子分類改指向雲端的 id，雲端分類不變', () => {
    const local = [cat('L1', '外食', [['l1a', '午餐']])];
    const remote = [cat('R1', '外食', [['r1a', '午餐']], { order: 3 })];
    const r = remapToLedger(local, remote, [txn('t1', 'L1', 'l1a')], NOW);
    expect(r.txns[0]).toMatchObject({ mainId: 'R1', subId: 'r1a' });
    expect(r.categories).toEqual(remote);
  });

  it('收支類型不同就不算同一個', () => {
    const local = [cat('L1', '獎金', [['l1a', '獎金']], { kind: 'income' })];
    const remote = [cat('R1', '獎金', [['r1a', '獎金']])];
    const r = remapToLedger(local, remote, [txn('t1', 'L1', 'l1a')], NOW);
    expect(r.txns[0]).toMatchObject({ mainId: 'L1', subId: 'l1a' });
    expect(r.categories.map((c) => c.id)).toEqual(['R1', 'L1']);
  });

  it('雲端沒有的主分類：有帳在用才帶過去，排在後面、帶修改時間；沒在用的不帶', () => {
    const local = [cat('L1', '寵物', [['l1a', '飼料']]), cat('L2', '健身', [['l2a', '月費']])];
    const remote = [cat('R1', '外食', [['r1a', '午餐']], { order: 4 })];
    const r = remapToLedger(local, remote, [txn('t1', 'L1', 'l1a')], NOW);
    expect(r.categories.map((c) => c.id)).toEqual(['R1', 'L1']);
    expect(r.categories[1]).toMatchObject({ order: 5, updatedAt: NOW });
  });

  it('對到的主分類底下，雲端沒有、又有帳在用的子分類加進去，那個分類的修改時間跟著更新', () => {
    const local = [cat('L1', '外食', [['l1a', '午餐'], ['l1b', '宵夜'], ['l1c', '早餐']])];
    const remote = [cat('R1', '外食', [['r1a', '午餐']])];
    const r = remapToLedger(local, remote, [txn('t1', 'L1', 'l1b')], NOW);
    expect(r.categories[0]!.subs.map((s) => s.name)).toEqual(['午餐', '宵夜']);
    expect(r.categories[0]!.updatedAt).toBe(NOW);
    expect(r.txns[0]).toMatchObject({ mainId: 'R1', subId: 'l1b' });
  });

  it('雲端同名的分類一個被刪、一個還在用：對到還在用的', () => {
    const local = [cat('L1', '外食', [['l1a', '午餐']])];
    const remote = [cat('OLD', '外食', [['o', '午餐']], { active: false }), cat('R1', '外食', [['r1a', '午餐']])];
    const r = remapToLedger(local, remote, [txn('t1', 'L1', 'l1a')], NOW);
    expect(r.txns[0]!.mainId).toBe('R1');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/sync/categoryRemap.test.ts`
Expected: FAIL，找不到 `./categoryRemap`

- [ ] **Step 3: 實作**

```ts
// src/sync/categoryRemap.ts
import type { Category, Txn } from '../domain/types';

export type Remapped = {
  /** 合併後這台手機要用的分類：那本帳的分類（可能多了子分類），加上帶過去的本機分類 */
  categories: Category[];
  /** 改指向那本帳分類 id 的紀錄 */
  txns: Txn[];
};

const nameKey = (kind: Category['kind'], name: string) => `${kind}\u0000${name.trim()}`;

/**
 * 手機上的帳要併進另一本帳（換帳號登入、訪客加入邀請時選「合併」）。
 *
 * 兩邊的分類是各自產生的，同樣叫「外食」內部 id 也不同；不對應的話，帶過去的帳在那本帳裡
 * 找不到分類。所以依「收支類型＋名稱」對到那本帳的分類，帳改指向它的 id。
 * 對不上的只帶有帳在用的：沒用到的預設分類不該塞進對方的帳本。
 * 帶過去的分類與加了子分類的分類修改時間設成 now，同步時逐一合併才會推上去。
 */
export function remapToLedger(
  local: readonly Category[],
  remote: readonly Category[],
  txns: readonly Txn[],
  now: number
): Remapped {
  // 雲端同名的有好幾個時優先對到還在用的：排序讓沒被刪的後寫進 Map、蓋過被刪的
  const remoteByKey = new Map<string, Category>();
  for (const c of [...remote].sort((a, b) => Number(a.active) - Number(b.active))) {
    remoteByKey.set(nameKey(c.kind, c.name), c);
  }

  const out = new Map(remote.map((c) => [c.id, { ...c, subs: [...c.subs] }]));
  const usedMain = new Set(txns.map((t) => t.mainId));
  const usedSub = new Set(txns.map((t) => `${t.mainId}/${t.subId}`));
  const mainMap = new Map<string, string>();
  const subMap = new Map<string, string>();
  const extras: Category[] = [];
  let order = remote.reduce((m, c) => Math.max(m, c.order), -1) + 1;

  for (const l of local) {
    const r = remoteByKey.get(nameKey(l.kind, l.name));
    if (!r) {
      if (usedMain.has(l.id)) extras.push({ ...l, order: order++, updatedAt: now });
      continue;
    }
    mainMap.set(l.id, r.id);
    const target = out.get(r.id)!;
    for (const s of l.subs) {
      const key = `${l.id}/${s.id}`;
      const hit = target.subs.find((x) => x.name.trim() === s.name.trim());
      if (hit) { subMap.set(key, hit.id); continue; }
      if (!usedSub.has(key)) continue;
      target.subs.push({ ...s });
      target.updatedAt = now;
      subMap.set(key, s.id);
    }
  }

  const moved = txns.map((t) => {
    const main = mainMap.get(t.mainId);
    if (!main) return t;
    return { ...t, mainId: main, subId: subMap.get(`${t.mainId}/${t.subId}`) ?? t.subId };
  });
  return { categories: [...out.values(), ...extras], txns: moved };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/sync/categoryRemap.test.ts && npm run typecheck`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/sync/categoryRemap.ts src/sync/categoryRemap.test.ts
git commit -m "feat(sync): map this phone's categories onto another ledger's by name" -m "合併時兩邊的分類 id 不同：依收支類型＋名稱對到那本帳的分類，帳改指向它；對不上的只帶有帳在用的，帶修改時間讓同步推上去。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: 執行登入（接回、接上、開新帳本）

**Files:**
- Modify: `src/sync/account.ts`（接在 Task 3 的內容後面）
- Test: `src/sync/account.signIn.test.ts`

**Interfaces:**
- Consumes: `aboutUser`（Task 1）、`lastAccount/lastLedger/localFacts/rememberAccount/LOCAL_MODE_KEY/LAST_LEDGER_KEY`（Task 2）、`planSignIn`（Task 3）、既有的 `joinLedger`、`joinOutcomeText`（`./joinLedger`）、`createLedger`、`ledgerTitles`、`ledgerEnvOf`、`ENV_RANGE`（`../sheets/ledgerSheet`）、`setJoinedSid`、`setSelfPerson`（`./ledgerId`）、`connectErrorText`（`./cloud`）
- Produces:
  - `type AccountDeps = { client: SheetsClient; tokens: Pick<TokenProvider, 'disconnect'>; env: LedgerEnv; now?(): number }`
  - `type Linked = { kind: 'linked'; sid: string }`
  - `class SignInError extends Error`（message 就是給人看的文字）
  - `signInErrorText(e: unknown): string`
  - `finishLink(account: Account, sid: string, self: Person): Promise<void>`
  - `signIn(d: AccountDeps): Promise<Linked | AskPlan>`
  - 內部共用：`createWithLocal(d, account)`、`rewriteBy(self)`、`findOwnLedger(client, env)`

- [ ] **Step 1: 寫失敗的測試**

```ts
// src/sync/account.signIn.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../db/schema';
import { ledgerRepo } from '../repo/ledgerRepo';
import { SheetsError, type SheetsClient } from '../sheets/client';
import { CATEGORIES_RANGE, ENV_RANGE } from '../sheets/ledgerSheet';
import { categoryToRows } from '../sheets/rows';
import { defaultCategories } from '../domain/categories';
import type { Person } from '../domain/types';
import { signIn } from './account';
import { LAST_LEDGER_KEY, LOCAL_MODE_KEY, lastAccount, rememberAccount } from './accountState';
import { joinedSid, SELF_KEY } from './ledgerId';

const A = { id: 'PA', email: 'a@gmail.com' };

/** 假的 Sheets／Drive：sheets 是「帳本 id → 分類」，forbidden 裡的帳本讀了回 403 */
function fakeClient(o: {
  account?: { id: string; email: string };
  owned?: string[];
  sheets?: Record<string, string[][]>;
  forbidden?: string[];
} = {}) {
  return {
    aboutUser: vi.fn(async () => o.account ?? A),
    findLedgers: vi.fn(async () => (o.owned ?? []).map((id) => ({ id, ownedByMe: true }))),
    get: vi.fn(async (sid: string, range: string) => {
      if (o.forbidden?.includes(sid)) throw new SheetsError(403, '');
      if (range === ENV_RANGE) return [['dev']];
      if (range === CATEGORIES_RANGE) return o.sheets?.[sid] ?? [];
      return [];
    }),
    createSpreadsheet: vi.fn(async () => 'NEW'),
    update: vi.fn(async () => ({})),
  } as unknown as SheetsClient & Record<'aboutUser' | 'findLedgers' | 'get' | 'createSpreadsheet', ReturnType<typeof vi.fn>>;
}

const deps = (client: SheetsClient) => ({ client, tokens: { disconnect: vi.fn(async () => {}) }, env: 'dev' as const });

async function addTxn(by: Person) {
  const [c] = await ledgerRepo.listCategories();
  return ledgerRepo.addTxn({
    date: '2026-09-18', mainId: c!.id, subId: c!.subs[0]!.id,
    amountCents: 100, currency: 'CAD', actualCadCents: 100, by, note: '',
  });
}

beforeEach(async () => {
  await resetDb();
  await ledgerRepo.bootstrap();
  await ledgerRepo.setMeta(LOCAL_MODE_KEY, true);
});

describe('signIn', () => {
  it('第一次登入、帳號還沒有帳本：開新帳本，手機上的帳帶過去，記下帳號、離開本機模式', async () => {
    await addTxn('我');
    const client = fakeClient();
    expect(await signIn(deps(client))).toEqual({ kind: 'linked', sid: 'NEW' });
    expect(client.createSpreadsheet).toHaveBeenCalled();
    expect(await joinedSid()).toBe('NEW');
    expect(await lastAccount()).toEqual(A);
    expect(await ledgerRepo.getMeta(LOCAL_MODE_KEY)).toBe(false);
    expect(await ledgerRepo.getMeta(SELF_KEY)).toBe('我');
  });

  it('同一個帳號登出後再登入：接回上次那本，身分照舊、分類不換', async () => {
    await rememberAccount(A);
    await ledgerRepo.setMeta(LAST_LEDGER_KEY, { sid: 'THEIRS', self: '妻' });
    const before = await ledgerRepo.listCategories();
    const client = fakeClient({ sheets: { THEIRS: defaultCategories(() => `r-${Math.random()}`).flatMap(categoryToRows) } });

    expect(await signIn(deps(client))).toEqual({ kind: 'linked', sid: 'THEIRS' });
    expect(await ledgerRepo.getMeta(SELF_KEY)).toBe('妻');
    expect(await ledgerRepo.getMeta(LAST_LEDGER_KEY)).toBeNull();
    expect(await ledgerRepo.listCategories()).toEqual(before);
  });

  it('接回時對方已經取消共用：改走一般流程（手機上混著兩個人的帳 → 要問、不能合併）', async () => {
    await rememberAccount(A);
    await ledgerRepo.setMeta(LAST_LEDGER_KEY, { sid: 'THEIRS', self: '妻' });
    await addTxn('我');
    await addTxn('妻');
    const r = await signIn(deps(fakeClient({ forbidden: ['THEIRS'] })));
    expect(r).toMatchObject({ kind: 'ask', target: null, canMerge: false });
    expect(await joinedSid()).toBeNull();
  });

  it('手機上沒帳、帳號已經有帳本：接上並換成那本的分類', async () => {
    const remote = defaultCategories(() => `r-${Math.random()}`);
    const client = fakeClient({ owned: ['OWN'], sheets: { OWN: remote.flatMap(categoryToRows) } });
    expect(await signIn(deps(client))).toEqual({ kind: 'linked', sid: 'OWN' });
    expect((await ledgerRepo.listCategories()).map((c) => c.id).sort()).toEqual(remote.map((c) => c.id).sort());
  });

  it('帳號已經有帳本、手機上也有帳：回傳要問的方案，手機資料不動', async () => {
    await addTxn('我');
    const r = await signIn(deps(fakeClient({ owned: ['OWN'] })));
    expect(r).toMatchObject({ kind: 'ask', target: 'OWN', canMerge: true, count: 1 });
    expect(await joinedSid()).toBeNull();
    expect((await ledgerRepo.listTxns())).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/sync/account.signIn.test.ts`
Expected: FAIL，`signIn` 沒有匯出

- [ ] **Step 3: 實作**

把 `src/sync/account.ts` 開頭的兩行 import 換成下面這組（只放這個 task 用到的；Task 6、7 會再各自補幾個）：

```ts
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
```

在檔案最後加：

```ts
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/sync/account.signIn.test.ts src/sync/account.plan.test.ts && npm run typecheck`
Expected: 13 passed

- [ ] **Step 5: Commit**

```bash
git add src/sync/account.ts src/sync/account.signIn.test.ts
git commit -m "feat(sync): sign in by rejoining, attaching or creating a ledger" -m "登入後讀帳號、上次的帳號與帳本、這個帳號自己的帳本和手機上的帳，照 planSignIn 執行：同帳號接回上次那本（分類交給同步合併），沒帳就接上或開新的，第一次登入帶著手機上的帳開新帳本；要問的情況回傳方案、不動手機資料。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: 執行使用者的選擇（合併／改用雲端／取消）

**Files:**
- Modify: `src/sync/account.ts`（檔案最後）
- Test: `src/sync/account.resolve.test.ts`

**Interfaces:**
- Consumes: Task 5 的 `AccountDeps`、`Linked`、`SignInError`、`finishLink`、`createWithLocal`；Task 4 的 `remapToLedger`；既有 `CATEGORIES_DIRTY_KEY`、`MEMBERS_DIRTY_KEY`、`resetLocalMembers`
- Produces:
  - `type AskChoice = 'merge' | 'cloud' | 'cancel'`
  - `resolveAsk(plan: AskPlan, choice: AskChoice, d: AccountDeps): Promise<Linked | { kind: 'cancelled' }>`

- [ ] **Step 1: 寫失敗的測試**

```ts
// src/sync/account.resolve.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../db/schema';
import type { Category, Person } from '../domain/types';
import { ledgerRepo } from '../repo/ledgerRepo';
import { SheetsError, type SheetsClient } from '../sheets/client';
import { CATEGORIES_RANGE, ENV_RANGE } from '../sheets/ledgerSheet';
import { categoryToRows } from '../sheets/rows';
import { resolveAsk, type AskPlan } from './account';
import { lastAccount } from './accountState';
import { CATEGORIES_DIRTY_KEY } from './categoriesSync';
import { joinedSid, SELF_KEY } from './ledgerId';
import { MEMBERS_DIRTY_KEY } from './members';

const A = { id: 'PA', email: 'a@gmail.com' };
const plan = (over: Partial<AskPlan> = {}): AskPlan => ({
  kind: 'ask', from: null, to: A.email, target: 'OWN', self: '我', count: 1, canMerge: true, account: A, ...over,
});

function client(remote: Category[], forbidden = false) {
  return {
    get: vi.fn(async (_sid: string, range: string) => {
      if (forbidden) throw new SheetsError(403, '');
      if (range === ENV_RANGE) return [['dev']];
      if (range === CATEGORIES_RANGE) return remote.flatMap(categoryToRows);
      return [];
    }),
    createSpreadsheet: vi.fn(async () => 'NEW'),
    update: vi.fn(async () => ({})),
  } as unknown as SheetsClient;
}
const deps = (c: SheetsClient) => ({ client: c, tokens: { disconnect: vi.fn(async () => {}) }, env: 'dev' as const, now: () => 5_000 });

/** 雲端那本：一個「外食」，id 跟手機上的不同 */
const REMOTE: Category[] = [{
  id: 'R-FOOD', kind: 'expense', name: '外食', icon: 'bus', budgetCents: null,
  subs: [{ id: 'R-LUNCH', name: '午餐' }], colorSet: 0, order: 0, active: true, updatedAt: 1,
}];

async function seedLocal(by: Person) {
  await ledgerRepo.replaceCategories([{ ...REMOTE[0]!, id: 'L-FOOD', subs: [{ id: 'L-LUNCH', name: '午餐' }] }]);
  await ledgerRepo.addTxn({
    date: '2026-09-18', mainId: 'L-FOOD', subId: 'L-LUNCH',
    amountCents: 100, currency: 'CAD', actualCadCents: 100, by, note: '',
  });
}

beforeEach(async () => { await resetDb(); });

describe('resolveAsk', () => {
  it('取消：斷開 Google，什麼都不寫', async () => {
    await seedLocal('我');
    const d = deps(client(REMOTE));
    expect(await resolveAsk(plan(), 'cancel', d)).toEqual({ kind: 'cancelled' });
    expect(d.tokens.disconnect).toHaveBeenCalled();
    expect(await joinedSid()).toBeNull();
    expect(await lastAccount()).toBeNull();
  });

  it('合併進既有帳本：帳改指向雲端分類、算成自己的身分；分類要推、成員名稱以雲端為準', async () => {
    await seedLocal('我');
    await ledgerRepo.setMeta(MEMBERS_DIRTY_KEY, true);
    expect(await resolveAsk(plan(), 'merge', deps(client(REMOTE)))).toEqual({ kind: 'linked', sid: 'OWN' });
    const [t] = await ledgerRepo.listTxns();
    expect(t).toMatchObject({ mainId: 'R-FOOD', subId: 'R-LUNCH', by: '我' });
    expect((await ledgerRepo.listCategories()).map((c) => c.id)).toEqual(['R-FOOD']);
    expect(await ledgerRepo.getMeta(CATEGORIES_DIRTY_KEY)).toBe(true);
    expect(await ledgerRepo.getMeta(MEMBERS_DIRTY_KEY)).toBe(false);
    expect(await joinedSid()).toBe('OWN');
  });

  it('訪客加入邀請選合併：手機上的帳都算加入者（妻）', async () => {
    await seedLocal('我');
    await resolveAsk(plan({ target: 'INV', self: '妻' }), 'merge', deps(client(REMOTE)));
    expect((await ledgerRepo.listTxns())[0]!.by).toBe('妻');
    expect(await ledgerRepo.getMeta(SELF_KEY)).toBe('妻');
  });

  it('改用雲端：清掉手機上的帳、換成雲端的分類', async () => {
    await seedLocal('我');
    await resolveAsk(plan(), 'cloud', deps(client(REMOTE)));
    expect(await ledgerRepo.listTxns()).toHaveLength(0);
    expect((await ledgerRepo.listCategories()).map((c) => c.id)).toEqual(['R-FOOD']);
    expect(await joinedSid()).toBe('OWN');
  });

  it('目標是 null：合併就用手機上的帳開新帳本；改用雲端就開一本空的', async () => {
    await seedLocal('我');
    expect(await resolveAsk(plan({ target: null }), 'merge', deps(client([])))).toEqual({ kind: 'linked', sid: 'NEW' });
    expect(await ledgerRepo.listTxns()).toHaveLength(1);

    await resetDb();
    await seedLocal('我');
    await resolveAsk(plan({ target: null }), 'cloud', deps(client([])));
    expect(await ledgerRepo.listTxns()).toHaveLength(0);
  });

  it('讀不到目標帳本：丟出給人看的錯誤，手機資料不動', async () => {
    await seedLocal('我');
    await expect(resolveAsk(plan(), 'cloud', deps(client(REMOTE, true)))).rejects.toThrow('還讀不到這本帳');
    expect(await ledgerRepo.listTxns()).toHaveLength(1);
    expect(await joinedSid()).toBeNull();
  });

  it('不能合併的方案選了合併：擋下來', async () => {
    await seedLocal('我');
    await expect(resolveAsk(plan({ canMerge: false }), 'merge', deps(client(REMOTE)))).rejects.toThrow('不能合併');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/sync/account.resolve.test.ts`
Expected: FAIL，`resolveAsk` 沒有匯出

- [ ] **Step 3: 實作**

`src/sync/account.ts` 的 import 改成／補上這幾行：

```ts
import type { Category, Person } from '../domain/types';
import { CATEGORIES_DIRTY_KEY } from './categoriesSync';
import { remapToLedger } from './categoryRemap';
import { MEMBERS_DIRTY_KEY, resetLocalMembers } from './members';
```

檔案最後加：

```ts
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

  // 這個帳號還沒有帳本：開一本新的。改用雲端＝不帶手機上的帳
  if (plan.target === null) {
    if (choice === 'cloud') {
      await ledgerRepo.clearTxns();
      await resetLocalMembers();
    }
    return createWithLocal(d, plan.account);
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/sync/account.resolve.test.ts src/sync/account.signIn.test.ts && npm run typecheck`
Expected: 12 passed

- [ ] **Step 5: Commit**

```bash
git add src/sync/account.ts src/sync/account.resolve.test.ts
git commit -m "feat(sync): carry out merge, use-the-cloud or cancel" -m "合併：分類依名稱對到那本帳、手機上的帳算成自己在那本帳的身分，分類標記待推、成員以雲端為準。改用雲端：確定讀得到那本帳之後才清手機上的帳、換成雲端分類。取消：斷開 Google、什麼都不寫。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: 登出，以及舊版手機補記帳號

**Files:**
- Modify: `src/sync/account.ts`（檔案最後）
- Test: `src/sync/account.signOut.test.ts`

**Interfaces:**
- Consumes: `joinedSid`、`clearJoinedSid`、`SELF_KEY`（`./ledgerId`）、`enterLocalMode`、`lastAccount`、`rememberAccount`、`LAST_LEDGER_KEY`（Task 2）
- Produces:
  - `signOut(d: { tokens: Pick<TokenProvider, 'disconnect'>; syncNow(): Promise<void>; waitMs?: number }): Promise<void>`
  - `recordAccountIfMissing(client: Pick<SheetsClient, 'aboutUser'>): Promise<Account | null>`（補記到了才回傳帳號）

- [ ] **Step 1: 寫失敗的測試**

```ts
// src/sync/account.signOut.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../db/schema';
import { ledgerRepo } from '../repo/ledgerRepo';
import { recordAccountIfMissing, signOut } from './account';
import { LAST_LEDGER_KEY, lastAccount, readLink, rememberAccount } from './accountState';
import { joinedSid, setJoinedSid, setSelfPerson } from './ledgerId';

beforeEach(async () => { await resetDb(); });

describe('signOut', () => {
  it('先同步、記下這本帳與身分、回到本機模式、斷開 Google', async () => {
    await setJoinedSid('S1');
    await setSelfPerson('妻');
    const order: string[] = [];
    const tokens = { disconnect: vi.fn(async () => { order.push('disconnect'); }) };
    await signOut({ tokens, syncNow: async () => { order.push('sync'); } });

    expect(order).toEqual(['sync', 'disconnect']);
    expect(await joinedSid()).toBeNull();
    expect(await ledgerRepo.getMeta(LAST_LEDGER_KEY)).toEqual({ sid: 'S1', self: '妻' });
    expect(await readLink()).toEqual({ sid: null });
  });

  it('同步卡住或失敗也照樣登出：帳留在手機上，下次同帳號登入補推', async () => {
    await setJoinedSid('S1');
    const tokens = { disconnect: vi.fn(async () => {}) };
    await signOut({ tokens, syncNow: () => new Promise(() => {}), waitMs: 10 });
    expect(await joinedSid()).toBeNull();
    await signOut({ tokens, syncNow: async () => { throw new Error('offline'); }, waitMs: 10 });
    expect(tokens.disconnect).toHaveBeenCalledTimes(2);
  });
});

describe('recordAccountIfMissing：舊版升上來的手機', () => {
  it('沒記過帳號：補記並回傳', async () => {
    const a = { id: 'PA', email: 'a@gmail.com' };
    expect(await recordAccountIfMissing({ aboutUser: async () => a })).toEqual(a);
    expect(await lastAccount()).toEqual(a);
  });

  it('記過就不再問 Google，也不覆蓋', async () => {
    await rememberAccount({ id: 'OLD', email: 'old@gmail.com' });
    const aboutUser = vi.fn(async () => ({ id: 'PA', email: 'a@gmail.com' }));
    expect(await recordAccountIfMissing({ aboutUser })).toBeNull();
    expect(aboutUser).not.toHaveBeenCalled();
  });

  it('讀不到帳號（離線）就算了，下次連上再補', async () => {
    expect(await recordAccountIfMissing({ aboutUser: async () => { throw new TypeError('Failed to fetch'); } })).toBeNull();
    expect(await lastAccount()).toBeNull();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/sync/account.signOut.test.ts`
Expected: FAIL，`signOut` 沒有匯出

- [ ] **Step 3: 實作**

`src/sync/account.ts` 的 import 改成這兩行（其餘不變）：

```ts
import {
  LAST_LEDGER_KEY, LOCAL_MODE_KEY, enterLocalMode, lastAccount, lastLedger, localFacts, rememberAccount,
  type Account, type LedgerRef, type LocalFacts,
} from './accountState';
import { clearJoinedSid, joinedSid, SELF_KEY, setJoinedSid, setSelfPerson } from './ledgerId';
```

檔案最後加：

```ts
/**
 * 登出：帳留在手機上變回本機模式，同一個帳號再登入時接回這一本。
 * 不撤銷 Google 那邊的授權，只清掉這台手機上的通行證與續期憑證，之後再登入比較快。
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/sync && npm run typecheck`
Expected: `src/sync` 全部通過（含既有的測試）

- [ ] **Step 5: Commit**

```bash
git add src/sync/account.ts src/sync/account.signOut.test.ts
git commit -m "feat(sync): sign out to local mode and backfill the account on older installs" -m "登出先試著同步（最多等 5 秒），記下這本帳與身分、回到本機模式、斷開 Google，帳留在手機上。這個功能上線前就登入的手機第一次連上時補記帳號。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: 同步狀態「只存在這台手機」

**Files:**
- Modify: `src/sync/state.ts:1-6`（`SyncState` 型別與註解）
- Modify: `src/sync/syncLabels.ts`（`syncLabel` 的 switch）
- Modify: `src/components/SyncStatus.tsx`（可點的條件）
- Modify: `src/components/SyncStatus.module.css:27-28, 63-64`
- Test: `src/sync/syncLabels.test.ts`（附加）、`src/components/SyncStatus.test.tsx`（附加）

**Interfaces:**
- Produces: `SyncState` 多一個 `'local'`；`syncLabel('local', …) === '只存在這台手機'`；`SyncStatus` 在 `local` 且有 `onRetry` 時是按鈕。

- [ ] **Step 1: 寫失敗的測試**

附加到 `src/sync/syncLabels.test.ts` 最後：

```ts
describe('本機模式', () => {
  it('寫「只存在這台手機」，不管有沒有同步過', () => {
    expect(syncLabel('local', null)).toBe('只存在這台手機');
    expect(syncLabel('local', Date.now())).toBe('只存在這台手機');
  });
});
```

附加到 `src/components/SyncStatus.test.tsx` 最後（檔案已經 import 了 `render`、`screen`、`fireEvent`、`vi`；沒有的話補上）：

```ts
describe('SyncStatus 的本機模式', () => {
  it('點一下就是登入', () => {
    const onRetry = vi.fn();
    render(<SyncStatus state="local" lastSyncAt={null} onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId('sync-status'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sync-text')).toHaveTextContent('只存在這台手機');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/sync/syncLabels.test.ts src/components/SyncStatus.test.tsx`
Expected: FAIL（型別上 `'local'` 不是 SyncState；label 回傳「尚未同步」）

- [ ] **Step 3: 實作**

`src/sync/state.ts`：

```ts
/**
 * needs-auth：Google 的 access token 過期了，要使用者點一下重新連線。
 * 它不是 error——token model 沒有 refresh token，過期是常態，亮紅燈會讓人以為壞了。
 * local：沒接上雲端帳本（使用者選了不登入或登出了），帳只存在這台手機；點一下就是登入。
 */
export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'needs-auth' | 'local';
```

`src/sync/syncLabels.ts` 的 `syncLabel` switch 加一條（放在 `needs-auth` 後面）：

```ts
    case 'local': return '只存在這台手機';
```

`src/components/SyncStatus.tsx`：

```tsx
  // 失敗時點一下重試；需要重新連線、或還沒登入時點一下就是連線（Google 要求由使用者操作觸發）。
  // 其他狀態點下去沒有意義，做成按鈕只會誤導
  if ((state === 'error' || state === 'needs-auth' || state === 'local') && onRetry) {
```

`src/components/SyncStatus.module.css`：

```css
.dot[data-state="offline"],
.dot[data-state="local"]   { background: var(--c-text-4); }
```

並把第 63–64 行的選擇器改成：

```css
.textPill[data-state="offline"],
.textPill[data-state="local"],
.textPill[data-state="error"] { color: var(--c-text-3); }
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/sync src/components && npm run typecheck`
Expected: 全部通過；typecheck 若指出別處有對 `SyncState` 做窮舉的 switch，照同樣的文字補上 `'local'`

- [ ] **Step 5: Commit**

```bash
git add src/sync/state.ts src/sync/syncLabels.ts src/sync/syncLabels.test.ts src/components/SyncStatus.tsx src/components/SyncStatus.module.css src/components/SyncStatus.test.tsx
git commit -m "feat(sync): show 'only on this phone' in local mode, tap to sign in" -m "新的同步狀態 local：沒接上雲端帳本時寫「只存在這台手機」，灰色圓點，點一下就是登入。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: 開始畫面的「先不登入，直接使用」

**Files:**
- Modify: `src/invite/LoginPage.tsx`
- Modify: `src/invite/LoginPage.module.css`（檔案最後）
- Test: `src/invite/LoginPage.local.test.tsx`

**Interfaces:**
- Produces: `LoginPage` 多一個選填 prop `onUseLocally?(): void`；按鈕 `data-testid="login-local"`。

- [ ] **Step 1: 寫失敗的測試**

```tsx
// src/invite/LoginPage.local.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage 的「先不登入，直接使用」', () => {
  it('有接上時顯示，按了回報', () => {
    const onUseLocally = vi.fn();
    render(<LoginPage onSignIn={() => {}} onUseLocally={onUseLocally} />);
    fireEvent.click(screen.getByTestId('login-local'));
    expect(onUseLocally).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('login-local-hint')).toHaveTextContent('帳只存在這台手機');
  });

  it('沒接上時不顯示', () => {
    render(<LoginPage onSignIn={() => {}} />);
    expect(screen.queryByTestId('login-local')).not.toBeInTheDocument();
  });

  it('正在確認建立帳本時收起來，連線中停用', () => {
    const { rerender } = render(<LoginPage onSignIn={() => {}} onUseLocally={() => {}} />);
    fireEvent.click(screen.getByTestId('login-google'));
    expect(screen.queryByTestId('login-local')).not.toBeInTheDocument();
    rerender(<LoginPage onSignIn={() => {}} onUseLocally={() => {}} busy />);
    expect(screen.getByTestId('login-local')).toBeDisabled();
  });
});
```

（第三個測試的 `rerender` 帶 `busy` 時 `confirming` 仍為 true，但 `confirming && !busy` 才顯示確認框，所以按鈕會回來而且被停用。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/invite/LoginPage.local.test.tsx`
Expected: FAIL，找不到 `login-local`

- [ ] **Step 3: 實作**

`Props` 型別加：

```ts
  /** 不登入也能用：帳只存在這台手機，之後可以在配置頁登入（使用者要求） */
  onUseLocally?(): void;
```

函式參數加上 `onUseLocally`：

```tsx
export function LoginPage({ onSignIn, disabled = false, busy = false, error = null, onJoinLink, onUseLocally }: Props) {
```

在 `{disabled && (` 那段之前加：

```tsx
        {onUseLocally && !(confirming && !busy) && (
          <>
            <button
              type="button" className={styles.localBtn} onClick={onUseLocally}
              disabled={busy} data-testid="login-local"
            >先不登入，直接使用</button>
            <p className={styles.localHint} data-testid="login-local-hint">
              帳只存在這台手機，之後可以在配置頁登入
            </p>
          </>
        )}
```

`src/invite/LoginPage.module.css` 最後加：

```css
/* 不登入直接使用：比兩條主要的路低一階，文字按鈕加底線 */
.localBtn {
  border: 0;
  background: none;
  padding: 10px 8px 0;
  font-family: var(--f-body);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--c-text-2);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.localBtn:disabled {
  opacity: .5;
  cursor: default;
}

.localHint {
  margin: -4px 0 0;
  font-family: var(--f-body);
  font-size: 11px;
  color: var(--c-text-3);
  text-align: center;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/invite && npm run typecheck`
Expected: 全部通過

- [ ] **Step 5: Commit**

```bash
git add src/invite/LoginPage.tsx src/invite/LoginPage.module.css src/invite/LoginPage.local.test.tsx
git commit -m "feat(login): let people use the app without signing in" -m "開始畫面加「先不登入，直接使用」與一句說明：帳只存在這台手機，之後可以在配置頁登入。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: 換帳號的確認視窗

**Files:**
- Create: `src/components/AccountSwitchDialog.tsx`
- Create: `src/components/AccountSwitchDialog.module.css`
- Test: `src/components/AccountSwitchDialog.test.tsx`

**Interfaces:**
- Consumes: `AskPlan`、`AskChoice`（Task 3、6）；沿用 `ConfirmDialog.module.css` 的 `scrim`、`box`、`title`、`desc`、`cancel`、`confirm`
- Produces: `AccountSwitchDialog({ plan, busy?, error?, onChoose }: { plan: AskPlan; busy?: boolean; error?: string | null; onChoose(c: AskChoice): void })`；testid：`account-switch`、`account-switch-merge`、`account-switch-cloud`、`account-switch-cancel`、`account-switch-error`

- [ ] **Step 1: 寫失敗的測試**

```tsx
// src/components/AccountSwitchDialog.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AskPlan } from '../sync/account';
import { AccountSwitchDialog } from './AccountSwitchDialog';

const A = { id: 'PA', email: 'a@gmail.com' };
const plan = (over: Partial<AskPlan> = {}): AskPlan => ({
  kind: 'ask', from: 'old@gmail.com', to: A.email, target: 'OWN', self: '我', count: 3, canMerge: true, account: A, ...over,
});

describe('AccountSwitchDialog', () => {
  it('寫出幾筆帳、上次與這次的帳號，三個選擇各自回報', () => {
    const onChoose = vi.fn();
    render(<AccountSwitchDialog plan={plan()} onChoose={onChoose} />);
    const box = screen.getByTestId('account-switch');
    expect(box).toHaveTextContent('這台手機上有 3 筆帳');
    expect(box).toHaveTextContent('old@gmail.com');
    expect(box).toHaveTextContent('a@gmail.com');

    fireEvent.click(screen.getByTestId('account-switch-merge'));
    fireEvent.click(screen.getByTestId('account-switch-cloud'));
    fireEvent.click(screen.getByTestId('account-switch-cancel'));
    expect(onChoose.mock.calls.map((c) => c[0])).toEqual(['merge', 'cloud', 'cancel']);
  });

  it('不能合併時沒有合併按鈕，並說明原因', () => {
    render(<AccountSwitchDialog plan={plan({ canMerge: false })} onChoose={() => {}} />);
    expect(screen.queryByTestId('account-switch-merge')).not.toBeInTheDocument();
    expect(screen.getByTestId('account-switch')).toHaveTextContent('兩個人記的');
  });

  it('這個帳號還沒有帳本：改用雲端的按鈕寫「開一本新的空帳本」', () => {
    render(<AccountSwitchDialog plan={plan({ target: null })} onChoose={() => {}} />);
    expect(screen.getByTestId('account-switch-cloud')).toHaveTextContent('開一本新的空帳本');
  });

  it('加入邀請時說的是對方的帳本', () => {
    render(<AccountSwitchDialog plan={plan({ self: '妻', target: 'INV', from: null })} onChoose={() => {}} />);
    expect(screen.getByTestId('account-switch-merge')).toHaveTextContent('對方的帳本');
  });

  it('處理中按鈕停用；顯示錯誤', () => {
    render(<AccountSwitchDialog plan={plan()} busy error="還讀不到這本帳" onChoose={() => {}} />);
    expect(screen.getByTestId('account-switch-merge')).toBeDisabled();
    expect(screen.getByTestId('account-switch-error')).toHaveTextContent('還讀不到這本帳');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/components/AccountSwitchDialog.test.tsx`
Expected: FAIL，找不到 `./AccountSwitchDialog`

- [ ] **Step 3: 實作**

```tsx
// src/components/AccountSwitchDialog.tsx
import type { AskChoice, AskPlan } from '../sync/account';
import dialog from './ConfirmDialog.module.css';
import styles from './AccountSwitchDialog.module.css';

type Props = {
  plan: AskPlan;
  busy?: boolean;
  error?: string | null;
  onChoose(choice: AskChoice): void;
};

/**
 * 換帳號登入、或手機上有帳又要加入邀請時：問手機上的帳要合併、改用雲端還是取消
 * （使用者要求：可能蓋掉現有帳戶的資料，要再確認一次）。
 * 點遮罩不關：三個選擇都有後果，要使用者明確選一個。
 */
export function AccountSwitchDialog({ plan, busy = false, error = null, onChoose }: Props) {
  const joining = plan.self === '妻';
  const where = joining ? '對方的帳本' : plan.target ? '這個帳號的帳本' : '這個帳號的新帳本';
  const cloudLabel = plan.target === null
    ? '開一本新的空帳本'
    : joining ? '改用對方帳本裡的帳' : '改用這個帳號雲端上的帳';
  const intro = plan.from && plan.from !== plan.to
    ? `上次登入的是 ${plan.from}，這次是 ${plan.to}。`
    : joining ? '你要加入對方的帳本。' : `${plan.to} 已經有一本帳。`;

  return (
    <div className={dialog.scrim} data-testid="account-switch-scrim">
      <div
        className={dialog.box}
        role="alertdialog" aria-modal="true" aria-label="手機上的帳要怎麼處理"
        data-testid="account-switch"
      >
        <h2 className={dialog.title}>這台手機上有 {plan.count} 筆帳</h2>
        <p className={dialog.desc}>{intro}手機上的帳要怎麼處理？</p>

        <div className={styles.choices}>
          {plan.canMerge && (
            <button
              type="button" className={styles.merge} disabled={busy}
              onClick={() => onChoose('merge')} data-testid="account-switch-merge"
            >合併進{where}</button>
          )}
          <button
            type="button" className={`${dialog.confirm} ${styles.choice}`} disabled={busy}
            onClick={() => onChoose('cloud')} data-testid="account-switch-cloud"
          >{cloudLabel}</button>
          <button
            type="button" className={`${dialog.cancel} ${styles.choice}`} disabled={busy}
            onClick={() => onChoose('cancel')} data-testid="account-switch-cancel"
          >{joining ? '取消' : '取消，先不登入'}</button>
        </div>

        <p className={styles.note}>
          {plan.canMerge
            ? `合併不會刪掉雲端原本的帳；選「${cloudLabel}」會清掉這台手機上的帳。`
            : `手機上的帳有兩個人記的，合併過去會算錯人，所以只能選「${cloudLabel}」或取消。`}
        </p>
        {error && <p className={styles.error} role="alert" data-testid="account-switch-error">{error}</p>}
      </div>
    </div>
  );
}
```

```css
/* src/components/AccountSwitchDialog.module.css */
/* 三個選擇直排：字比較長，並排會擠成兩行 */
.choices {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.choice { width: 100%; }

.merge {
  width: 100%;
  border: 0;
  border-radius: var(--r-pill);
  /* §0：可點元素 ≥44px */
  min-height: 44px;
  background: var(--c-primary-deep);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.merge:disabled,
.choice:disabled {
  opacity: .6;
  cursor: default;
}

.note {
  margin: 12px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--c-text-3);
}

.error {
  margin: 8px 0 0;
  font-size: 11.5px;
  color: var(--c-expense);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/components/AccountSwitchDialog.test.tsx && npm run typecheck`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/components/AccountSwitchDialog.tsx src/components/AccountSwitchDialog.module.css src/components/AccountSwitchDialog.test.tsx
git commit -m "feat(ui): ask whether to merge, use the cloud or cancel" -m "換帳號登入或手機上有帳又要加入邀請時的確認視窗：寫出幾筆帳、上次與這次的帳號；手機上的帳混著兩個人記的就不給合併並說明原因。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: 配置頁的「帳號」區

**Files:**
- Modify: `src/screens/settings/SettingsScreen.tsx`
- Modify: `src/screens/settings/SettingsScreen.module.css`（檔案最後）
- Test: `src/screens/settings/SettingsScreen.account.test.tsx`

**Interfaces:**
- Produces:
  - `export type AccountSection = { email: string | null; busy?: boolean; error?: string | null; onSignIn(): void; onSignOut(): Promise<void> }`
  - `SettingsScreen` 多一個選填 prop `account?: AccountSection`；testid：`account-section`、`account-email`、`account-sign-in`、`account-sign-out`、`account-sign-out-confirm`、`account-sign-out-go`、`account-sign-out-cancel`、`account-error`

- [ ] **Step 1: 寫失敗的測試**

```tsx
// src/screens/settings/SettingsScreen.account.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../../db/schema';
import { useLedger } from '../../store/useLedger';
import { SettingsScreen } from './SettingsScreen';

const initialState = useLedger.getState();

beforeEach(async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
  await resetDb();
  useLedger.setState(initialState, true);
  await useLedger.getState().load();
});
afterEach(() => vi.unstubAllGlobals());

const BASE = { onInvite: () => {}, syncState: 'local' as const, lastSyncAt: null, onRetrySync: () => {} };
const account = (over = {}) => ({ email: null, onSignIn: vi.fn(), onSignOut: vi.fn(async () => {}), ...over });

describe('配置頁的帳號區', () => {
  it('沒設定 Google（開發的純本機模式）就沒有這一區', () => {
    render(<SettingsScreen {...BASE} />);
    expect(screen.queryByTestId('account-section')).not.toBeInTheDocument();
  });

  it('本機模式：寫未登入，按登入 Google 回報', () => {
    const a = account();
    render(<SettingsScreen {...BASE} account={a} />);
    expect(screen.getByTestId('account-section')).toHaveTextContent('帳只存在這台手機');
    fireEvent.click(screen.getByTestId('account-sign-in'));
    expect(a.onSignIn).toHaveBeenCalledTimes(1);
  });

  it('連線中：登入按鈕停用並寫連線中', () => {
    render(<SettingsScreen {...BASE} account={account({ busy: true })} />);
    expect(screen.getByTestId('account-sign-in')).toBeDisabled();
    expect(screen.getByTestId('account-sign-in')).toHaveTextContent('連線中…');
  });

  it('已登入：顯示信箱；登出要先確認，取消就回來', () => {
    const a = account({ email: 'a@gmail.com' });
    render(<SettingsScreen {...BASE} syncState="synced" account={a} />);
    expect(screen.getByTestId('account-email')).toHaveTextContent('a@gmail.com');
    fireEvent.click(screen.getByTestId('account-sign-out'));
    expect(screen.getByTestId('account-sign-out-confirm')).toHaveTextContent('帳會留在這台手機');
    fireEvent.click(screen.getByTestId('account-sign-out-cancel'));
    expect(screen.queryByTestId('account-sign-out-confirm')).not.toBeInTheDocument();
    expect(a.onSignOut).not.toHaveBeenCalled();
  });

  it('確定登出就回報', async () => {
    const a = account({ email: 'a@gmail.com' });
    render(<SettingsScreen {...BASE} syncState="synced" account={a} />);
    fireEvent.click(screen.getByTestId('account-sign-out'));
    fireEvent.click(screen.getByTestId('account-sign-out-go'));
    await waitFor(() => expect(a.onSignOut).toHaveBeenCalledTimes(1));
  });

  it('本機模式的「邀請成員」提示要先登入', () => {
    render(<SettingsScreen {...BASE} account={account()} />);
    expect(screen.getByTestId('invite-member')).toHaveTextContent('先登入');
  });

  it('顯示登入錯誤', () => {
    render(<SettingsScreen {...BASE} account={account({ error: '連不到 Google，請確認網路後再試一次。' })} />);
    expect(screen.getByTestId('account-error')).toHaveTextContent('連不到 Google');
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `npx vitest run src/screens/settings/SettingsScreen.account.test.tsx`
Expected: FAIL，找不到 `account-sign-in`（第一個測試會過）

- [ ] **Step 3: 實作**

`Props` 型別加：

```ts
  /**
   * 帳號區，有設定 Google 時才有。email 是 null＝本機模式，帳只存在這台手機。
   * onSignIn 要在點擊事件裡同步呼叫 connect，Google 視窗才不會被擋
   */
  account?: AccountSection;
```

在 `type MemberManageProps` 前面加：

```ts
export type AccountSection = {
  email: string | null;
  /** 正在連線 Google 或接上帳本 */
  busy?: boolean;
  error?: string | null;
  onSignIn(): void;
  onSignOut(): Promise<void>;
};
```

在 `MemberManage` 函式後面加元件：

```tsx
/**
 * 登入／登出（使用者要求：不登入也能用，之後想同步再登入；登入的人也能登出）。
 * 登出後帳留在這台手機、變回本機模式，同一個帳號再登入就接回這本帳。
 */
function AccountCard({ email, busy = false, error = null, onSignIn, onSignOut }: AccountSection) {
  const [confirming, setConfirming] = useState(false);
  const [leaving, setLeaving] = useState(false);

  function signOut() {
    setLeaving(true);
    void onSignOut().finally(() => { setLeaving(false); setConfirming(false); });
  }

  return (
    <div className={styles.card} data-testid="account-section">
      <div className={styles.accountRow}>
        <div className={styles.memberText}>
          <span className={styles.memberName} data-testid="account-email">{email ?? '未登入'}</span>
          <span className={styles.rowSub}>{email ? '帳會同步到你的 Google 試算表' : '帳只存在這台手機'}</span>
        </div>
        {!confirming && (email ? (
          <button
            type="button" className={styles.accountBtn}
            onClick={() => setConfirming(true)} data-testid="account-sign-out"
          >登出</button>
        ) : (
          <button
            type="button" className={styles.accountBtn}
            onClick={onSignIn} disabled={busy} data-testid="account-sign-in"
          >{busy ? '連線中…' : '登入 Google'}</button>
        ))}
      </div>

      {confirming && (
        <div className={styles.confirmBox} role="group" aria-label="登出" data-testid="account-sign-out-confirm">
          <p className={styles.confirmText}>
            登出後帳會留在這台手機，但不再同步，對方新記的帳也看不到。之後用同一個帳號登入就會接回這本帳。
          </p>
          <div className={styles.manageRow}>
            <button
              type="button" className={`${styles.manageBtn} ${styles.danger}`}
              onClick={signOut} disabled={leaving} data-testid="account-sign-out-go"
            >{leaving ? '登出中…' : '確定登出'}</button>
            <button
              type="button" className={styles.manageBtn}
              onClick={() => setConfirming(false)} disabled={leaving} data-testid="account-sign-out-cancel"
            >取消</button>
          </div>
        </div>
      )}

      {!email && <p className={styles.accountHint}>登入後帳會存進你的 Google 試算表，才能跟對方共用。</p>}
      {error && <p className={styles.manageError} role="alert" data-testid="account-error">{error}</p>}
    </div>
  );
}
```

`SettingsScreen` 的參數解構加上 `account`：

```tsx
export function SettingsScreen({
  onInvite, syncState, lastSyncAt, onRetrySync, onMembersChanged, invitee = null, onRemoveInvitee,
  onCategoriesChanged, account,
}: Props) {
```

把原本的「帳本成員」section 開頭：

```tsx
        <section className={styles.section}>
          <h2 className={styles.titleFirst}>帳本成員</h2>
```

換成：

```tsx
        {account && (
          <section className={styles.section}>
            <h2 className={styles.titleFirst}>帳號</h2>
            <AccountCard {...account} />
          </section>
        )}

        <section className={styles.section}>
          <h2 className={account ? styles.title : styles.titleFirst}>帳本成員</h2>
```

「邀請成員」那一列的提示改成：

```tsx
                <span className={styles.inviteHint}>{account && !account.email ? '先登入 ›' : '分享連結 ›'}</span>
```

`src/screens/settings/SettingsScreen.module.css` 最後加：

```css
/* 帳號區：信箱（或「未登入」）在左，登入／登出在右 */
.accountRow {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.accountBtn {
  flex: none;
  border: 2px solid rgba(74, 63, 54, .12);
  border-radius: var(--r-pill);
  background: var(--c-card);
  padding: 8px 14px;
  font-family: var(--f-body);
  font-size: 12.5px;
  font-weight: 700;
  color: var(--c-text);
  cursor: pointer;
}

.accountBtn:disabled {
  opacity: .6;
  cursor: default;
}

.accountHint {
  margin: 0 0 10px;
  font-family: var(--f-body);
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--c-text-3);
}
```

（`confirmBox` 在帳號卡片裡要跟下面留一點距離：若畫面上貼太緊，在 `.card > .confirmBox` 加 `margin-bottom: 10px`。）

- [ ] **Step 4: 跑測試確認通過**

Run: `npx vitest run src/screens/settings && npm run typecheck`
Expected: 全部通過（含既有的配置頁測試：沒傳 `account` 時畫面跟以前一樣）

- [ ] **Step 5: Commit**

```bash
git add src/screens/settings/SettingsScreen.tsx src/screens/settings/SettingsScreen.module.css src/screens/settings/SettingsScreen.account.test.tsx
git commit -m "feat(settings): add an account section to sign in and out" -m "配置頁最上面加帳號區：本機模式顯示「登入 Google」與說明，已登入顯示信箱與「登出」，登出先就地確認。本機模式的邀請成員提示要先登入。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: 接進 App（Gate、Shell、Join）

**Files:**
- Create: `src/invite/useSignIn.ts`
- Modify: `src/App.tsx`（`Gate`、`Join`、`Shell` 三個函式，細節如下）
- Test: `src/App.gate.test.tsx`

**Interfaces:**
- Consumes: Task 2 的 `readLink`、`enterLocalMode`、`lastAccount`、`localFacts`、`type Link`、`type Account`；Task 3、5、6、7 的 `planJoin`、`finishLink`、`resolveAsk`、`signIn`、`signInErrorText`、`signOut`、`recordAccountIfMissing`、`type AskPlan`、`type AskChoice`；Task 9 的 `onUseLocally`；Task 10 的 `AccountSwitchDialog`；Task 11 的 `account` prop
- Produces:
  - `useSignIn(cloud: Cloud | null, onLinked: (sid: string) => void): { busy: boolean; error: string | null; ask: AskPlan | null; start(): void; choose(c: AskChoice): void }`
  - `App.tsx` 匯出 `Gate`（給測試用）

- [ ] **Step 1: 寫 hook**

```ts
// src/invite/useSignIn.ts
import { useCallback, useState } from 'react';
import { resolveAsk, signIn, signInErrorText, type AskChoice, type AskPlan } from '../sync/account';
import type { Cloud } from '../sync/cloud';

export type SignInState = {
  busy: boolean;
  error: string | null;
  /** 要使用者選合併、改用雲端還是取消；null＝沒在問 */
  ask: AskPlan | null;
  /** 開始登入。要在點擊事件裡呼叫：connect 會在裡面同步叫出 Google 視窗 */
  start(): void;
  choose(c: AskChoice): void;
};

/** 開始畫面與配置頁共用的登入流程（設計見 docs/superpowers/specs/2026-09-18-guest-mode-and-account-design.md） */
export function useSignIn(cloud: Cloud | null, onLinked: (sid: string) => void): SignInState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<AskPlan | null>(null);

  const start = useCallback(() => {
    if (!cloud) return;
    setError(null);
    setBusy(true);
    // connect 必須在這個點擊事件裡同步呼叫，瀏覽器才不會擋掉 Google 視窗
    cloud.tokens.connect()
      .then(() => signIn({ client: cloud.client, tokens: cloud.tokens, env: cloud.env }))
      .then((r) => { if (r.kind === 'linked') onLinked(r.sid); else setAsk(r); })
      .catch((e) => {
        setError(signInErrorText(e));
        // 接不上帳本就不要留著半套連線：畫面還是本機模式，連著反而讓人以為登入了
        if (cloud.tokens.isConnected()) void cloud.tokens.disconnect();
      })
      .finally(() => setBusy(false));
  }, [cloud, onLinked]);

  const choose = useCallback((c: AskChoice) => {
    if (!cloud || !ask) return;
    setError(null);
    setBusy(true);
    resolveAsk(ask, c, { client: cloud.client, tokens: cloud.tokens, env: cloud.env })
      .then((r) => { setAsk(null); if (r.kind === 'linked') onLinked(r.sid); })
      .catch((e) => setError(signInErrorText(e)))
      .finally(() => setBusy(false));
  }, [cloud, ask, onLinked]);

  return { busy, error, ask, start, choose };
}
```

- [ ] **Step 2: 寫失敗的測試**

```tsx
// src/App.gate.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Gate } from './App';
import { NeedsConnectError, type TokenProvider } from './auth/gis';
import { resetDb } from './db/schema';
import { ledgerRepo } from './repo/ledgerRepo';
import type { SheetsClient } from './sheets/client';
import { useLedger } from './store/useLedger';
import { LAST_LEDGER_KEY, LOCAL_MODE_KEY, lastAccount, rememberAccount } from './sync/accountState';
import type { Cloud } from './sync/cloud';
import { joinedSid, setJoinedSid } from './sync/ledgerId';

const initialState = useLedger.getState();
const A = { id: 'PA', email: 'a@gmail.com' };

function fakeTokens(): TokenProvider & { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> } {
  let on = false;
  const listeners = new Set<(c: boolean) => void>();
  const emit = () => listeners.forEach((l) => l(on));
  return {
    preload: vi.fn(async () => {}),
    connect: vi.fn(async () => { on = true; emit(); }),
    renewSilently: vi.fn(async () => false),
    expiresInMs: () => (on ? 3_600_000 : 0),
    token: vi.fn(async () => { if (!on) throw new NeedsConnectError(); return 'TK'; }),
    isConnected: () => on,
    disconnect: vi.fn(async () => { on = false; emit(); }),
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

/** 什麼都回空的假 Sheets：同步控制器跑起來也不會壞 */
function fakeClient(): SheetsClient {
  return {
    aboutUser: vi.fn(async () => A),
    findLedgers: vi.fn(async () => []),
    get: vi.fn(async () => []),
    append: vi.fn(async () => ({ updates: { updatedRange: '紀錄!A2:N2' } })),
    update: vi.fn(async () => ({})),
    clear: vi.fn(async () => ({})),
    createSpreadsheet: vi.fn(async () => 'NEW-SID'),
    shareWith: vi.fn(async () => ({})),
    listPermissions: vi.fn(async () => []),
    removePermission: vi.fn(async () => {}),
  } as unknown as SheetsClient;
}

const cloud = (): Cloud => ({ tokens: fakeTokens(), client: fakeClient(), env: 'dev' });

beforeEach(async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
  await resetDb();
  useLedger.setState(initialState, true);
  await useLedger.getState().load();
});
afterEach(() => vi.unstubAllGlobals());

describe('Gate：開 App 時去哪、登入與登出', () => {
  it('沒記過任何東西：開始畫面；按「先不登入」進 App，狀態寫只存在這台手機', async () => {
    render(<Gate cloud={cloud()} />);
    fireEvent.click(await screen.findByTestId('login-local'));
    await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('sync-text')).toHaveTextContent('只存在這台手機'));
    expect(await ledgerRepo.getMeta(LOCAL_MODE_KEY)).toBe(true);
  });

  it('本機模式在配置頁登入：第一次登入開新帳本，配置頁顯示信箱', async () => {
    await ledgerRepo.setMeta(LOCAL_MODE_KEY, true);
    render(<Gate cloud={cloud()} />);
    await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('tab-settings'));
    fireEvent.click(screen.getByTestId('account-sign-in'));

    await waitFor(() => expect(screen.getByTestId('account-email')).toHaveTextContent('a@gmail.com'));
    expect(await joinedSid()).toBe('NEW-SID');
    expect(await lastAccount()).toEqual(A);
  });

  it('已登入按登出：確認後回到本機模式，記住這本帳，斷開 Google', async () => {
    await setJoinedSid('S1');
    await rememberAccount(A);
    const c = cloud();
    render(<Gate cloud={c} />);
    await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('tab-settings'));
    expect(screen.getByTestId('account-email')).toHaveTextContent('a@gmail.com');

    fireEvent.click(screen.getByTestId('account-sign-out'));
    fireEvent.click(screen.getByTestId('account-sign-out-go'));

    await waitFor(() => expect(screen.getByTestId('account-email')).toHaveTextContent('未登入'));
    expect(await joinedSid()).toBeNull();
    expect(await ledgerRepo.getMeta(LAST_LEDGER_KEY)).toEqual({ sid: 'S1', self: '我' });
    expect(c.tokens.disconnect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npx vitest run src/App.gate.test.tsx`
Expected: FAIL，`Gate` 沒有匯出

- [ ] **Step 4: 改 `App.tsx`**

**4a. import**（在既有 import 旁邊補上；已經有的不要重複）：

```ts
import { AccountSwitchDialog } from './components/AccountSwitchDialog';
import { useSignIn } from './invite/useSignIn';
import {
  finishLink, planJoin, recordAccountIfMissing, resolveAsk, signInErrorText, signOut, type AskPlan,
} from './sync/account';
import { enterLocalMode, lastAccount, localFacts, readLink, type Account, type Link } from './sync/accountState';
```

並把 `./sync/cloud` 那行 import 改成（`ensureLedger` 與 `connectErrorText` 改由 `sync/account.ts` 負責，App 不再直接用）：

```ts
import { createCloudWithProxy, type Cloud } from './sync/cloud';
```

**4b. 整個 `Gate` 換成：**

```tsx
/**
 * 未設定 client id：直接進主程式（純本機模式，開發用）。
 * 設定了：接著帳本就進那一本；選過「先不登入」或登出過就進本機模式；都沒有才給開始畫面。
 * 接上的帳本是這裡的狀態：登入、登出之後 Shell 跟著換，同步控制器依 sid 重新啟動。
 */
export function Gate({ cloud }: { cloud: Cloud | null }) {
  // undefined＝還在讀
  const [link, setLink] = useState<Link | undefined>(cloud ? undefined : { sid: null });
  const [email, setEmail] = useState<string | null>(null);
  // 開始畫面貼錯的邀請連結
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    void readLink().then(async (l) => {
      const a = typeof l === 'object' && l.sid ? await lastAccount() : null;
      if (!alive) return;
      setEmail(a?.email ?? null);
      setLink(l);
    });
    // 先把 Google 的 script 載好：之後按登入時才能在同一個點擊事件裡叫出視窗
    cloud.tokens.preload().catch(() => {});
    return () => { alive = false; };
  }, [cloud]);

  // 接上帳本之後：本機資料可能換過（合併、改用雲端），重讀一次再進那本帳
  const onLinked = useCallback((sid: string) => {
    void Promise.all([lastAccount(), useLedger.getState().load()]).then(([a]) => {
      setEmail(a?.email ?? null);
      setLink({ sid });
    });
  }, []);
  const signin = useSignIn(cloud, onLinked);

  if (!cloud) return <Shell cloud={null} sid={null} />;
  if (link === undefined) return null;

  const dialog = signin.ask && (
    <AccountSwitchDialog plan={signin.ask} busy={signin.busy} error={signin.error} onChoose={signin.choose} />
  );
  // 確認視窗開著時錯誤寫在視窗裡，外面不重複
  const error = signin.ask ? null : signin.error;

  if (link === 'login') {
    return (
      <>
        <LoginPage
          busy={signin.busy}
          error={error ?? linkError}
          onSignIn={() => { setLinkError(null); signin.start(); }}
          onJoinLink={(raw) => {
            try {
              const u = new URL(raw);
              location.assign(`${appPath('join')}${u.search}`);
            } catch {
              setLinkError('這不是有效的邀請連結，請整條複製後再貼一次。');
            }
          }}
          onUseLocally={() => { void enterLocalMode().then(() => setLink({ sid: null })); }}
        />
        {dialog}
      </>
    );
  }

  return (
    <>
      <Shell
        cloud={cloud}
        sid={link.sid}
        account={{
          email,
          busy: signin.busy,
          error,
          onSignIn: signin.start,
          onSignedOut: () => { setEmail(null); setLink({ sid: null }); },
          onAccountKnown: (a) => setEmail(a.email),
        }}
      />
      {dialog}
    </>
  );
}
```

**4c. 整個 `Join` 換成：**（跟原本的差別：加了 `ask` 狀態；連上 Google 之後先讀帳號，手機上有帳又沒接著別本帳時先問；加入成功改用 `finishLink`；確認視窗疊在 `JoinPage` 上面）

```tsx
/**
 * §8.1 接受邀請頁。連結檢查與本機帳本 id 都是 async，所以先給 null 再補上。
 *
 * 加入＝連線 Google → 確認這個帳號讀得到那本帳 → 搬對方的分類 → 記下帳本。
 * 讀不到（對方還沒分享）就停在這頁說明原因，不記下一本打不開的帳。
 * 手機上有帳、又沒接著別本帳（訪客或登出後）時，先問要合併、清掉還是取消。
 */
function Join({ search, cloud }: { search: string; cloud: Cloud | null }) {
  const [state, setState] = useState<JoinState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<AskPlan | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([checkInvite(search), joinedSid()]).then(([check, sid]) => {
      if (!alive) return;
      // 已經在帳本裡的手機按上一頁（iPhone 右滑）回到舊的邀請頁：直接回主程式（使用者回報右滑跳回邀請頁）
      if (sid && arrivedByHistory()) { replaceLocation(appPath()); return; }
      setState(joinStateOf({ check, joinedSid: sid, preview: isPreview(search) }));
    });
    cloud?.tokens.preload().catch(() => {});
    return () => { alive = false; };
  }, [search, cloud]);

  useEffect(() => {
    // 從返回快取還原的頁面不會重跑上面那段，右滑回來時在這裡再判斷一次
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void joinedSid().then((sid) => { if (sid) replaceLocation(appPath()); });
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  if (!state) return null;

  // 用 replace 不用 href：接受邀請頁不留在歷史紀錄裡，iPhone 右滑（上一頁）才不會跳回邀請頁
  const goHome = () => { location.replace(appPath()); };

  const join = () => {
    // 預覽只是給邀請的人看畫面，按下去就回主程式，不加入任何東西
    if (state.kind !== 'invite' || state.preview) { goHome(); return; }
    const sid = state.sid;
    // 這台原本記的是另一本帳：加入成功才清掉那本的紀錄，免得被推進對方的帳本
    const switching = state.switching === true;
    const forgetOldLedger = async () => {
      if (!switching) return;
      await ledgerRepo.clearTxns();
      await resetLocalMembers();
    };

    // 純本機模式（沒設定 Google）：只記下帳本 id
    // 用邀請連結加入的人：這台裝置之後記帳都記成「妻」
    if (!cloud) {
      void forgetOldLedger()
        .then(() => Promise.all([setJoinedSid(sid), setSelfPerson('妻')]))
        .then(goHome);
      return;
    }

    setError(null);
    setBusy(true);
    // 已連線就不再叫視窗；沒連線時 connect 要在這個點擊事件裡同步呼叫
    const ready = cloud.tokens.isConnected() ? Promise.resolve() : cloud.tokens.connect();
    ready
      .then(async () => {
        const account: Account = await cloud.client.aboutUser();
        // 已經接著別本帳的走原本的切換流程（先提醒、加入成功才清掉）；沒接著又有帳就先問
        if (!switching) {
          const plan = planJoin({ account, lastAccount: await lastAccount(), inviteSid: sid, local: await localFacts() });
          if (plan.kind === 'ask') { setAsk(plan); return; }
        }
        const r = await joinLedger(cloud.client, sid, cloud.env, {
          replaceCategories: (cs) => ledgerRepo.replaceCategories(cs),
          setJoinedSid: async (id) => { await forgetOldLedger(); await setJoinedSid(id); },
        });
        const msg = joinOutcomeText(r);
        if (msg) { setError(msg); return; }
        // 記成「妻」，順便記下帳號、離開本機模式
        await finishLink(account, sid, '妻');
        goHome();
      })
      .catch((e) => setError(signInErrorText(e)))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <JoinPage
        state={state}
        busy={busy}
        error={ask ? null : error}
        onJoin={join}
        onBrowse={() => setState({ kind: 'browsing' })}
        onHome={goHome}
      />
      {ask && cloud && (
        <AccountSwitchDialog
          plan={ask}
          busy={busy}
          error={error}
          onChoose={(c) => {
            setError(null);
            setBusy(true);
            resolveAsk(ask, c, { client: cloud.client, tokens: cloud.tokens, env: cloud.env })
              .then((r) => { setAsk(null); if (r.kind === 'linked') goHome(); })
              .catch((e) => setError(signInErrorText(e)))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </>
  );
}
```

**4d. `Shell`：** 簽名改成：

```tsx
/** Gate 交給 Shell 的帳號操作（有設定 Google 時才有） */
type ShellAccount = {
  email: string | null;
  busy: boolean;
  error: string | null;
  /** 在點擊事件裡呼叫：會同步叫出 Google 視窗 */
  onSignIn(): void;
  /** 登出完成、本機已經是本機模式之後通知外層 */
  onSignedOut(): void;
  /** 這個功能上線前就登入的手機第一次連上 Google 時補記到帳號 */
  onAccountKnown(a: Account): void;
};

function Shell({ cloud, sid, account }: { cloud: Cloud | null; sid: string | null; account?: ShellAccount }) {
```

在 `const syncRef = useRef<SyncController | null>(null);` 下面加：

```tsx
  // account 每次重繪都是新物件；放進 effect 的依賴會讓同步一直重啟，所以經由 ref 讀
  const accountRef = useRef(account);
  accountRef.current = account;
```

同步 effect（`// 雲端同步：每 5 秒輪詢…` 那個 `useEffect`）改四處：

1. `if (!cloud) return;` 後面加：

```tsx
    // 本機模式：沒有帳本可以同步，狀態寫「只存在這台手機」，點它就登入
    if (!sid) { useLedger.getState().setSyncState('local'); return; }
    const sidNow = sid;
```

   並刪掉原本的 `let sidNow: string | null = null;`。
2. 原本的 `void joinedSid().then(async (v) => { … });` 換成：

```tsx
    void (async () => {
      // 升到逐一合併分類的版本時跑一次：受邀者之前改的分類第一次合併時以本機為準（見 migrateCategorySync）
      await migrateCategorySync();
      // 打開 App 時本機已經有的紀錄不算對方新記的
      arrivals = createArrivalWatcher((await ledgerRepo.allTxnsForSync()).map((t) => t.id));
      if (!alive) return;
      stop = ctl.start();
    })();
```

3. `cloud.tokens.subscribe(...)` 那行換成：

```tsx
    // 這個功能上線前就登入的手機沒記過帳號：第一次連上時補記，之後換帳號登入才比得出來
    const noteAccount = () => {
      void recordAccountIfMissing(cloud.client).then((a) => { if (a) accountRef.current?.onAccountKnown(a); });
    };
    if (cloud.tokens.isConnected()) noteAccount();
    // 使用者點「連線 Google」成功後立刻補同步，不必等下一次輪詢
    const unsubscribe = cloud.tokens.subscribe((connected) => {
      if (!connected) return;
      void ctl.syncNow();
      noteAccount();
    });
```

4. 依賴陣列 `[cloud]` 改成 `[cloud, sid]`。

`retrySync` 改成：

```tsx
  // 點同步狀態：本機模式就是登入；連著就立刻同步；token 過期就在這個點擊裡叫出 Google 視窗
  const retrySync = useCallback(() => {
    if (!cloud) return;
    if (!sid) { accountRef.current?.onSignIn(); return; }
    if (cloud.tokens.isConnected()) { void syncRef.current?.syncNow(); return; }
    cloud.tokens.connect().catch(() => useLedger.getState().setSyncState('needs-auth'));
  }, [cloud, sid]);
```

在 `removeInvitee` 後面加：

```tsx
  // 登出：先同步、記下這本帳，回到本機模式；帳留在手機上
  const signOutHere = useCallback(async (): Promise<void> => {
    if (!cloud) return;
    await signOut({ tokens: cloud.tokens, syncNow: () => syncRef.current?.syncNow() ?? Promise.resolve() });
    await useLedger.getState().load();
    accountRef.current?.onSignedOut();
  }, [cloud]);
```

受邀者那個 effect 的依賴 `[cloud]` 改成 `[cloud, sid]`（換了帳本要重新問共用給了誰）。

`SettingsScreen` 的 props：

```tsx
          <SettingsScreen
            onInvite={() => {
              // 本機模式沒有帳本可以分享：先登入（在這個點擊裡叫出 Google 視窗）
              if (cloud && !sid) { accountRef.current?.onSignIn(); return; }
              void Promise.all([joinedSid(), ledgerRepo.getMeta<string>(SHARED_WITH_KEY)])
                .then(async ([s, shared]) => {
                  setInvite({
                    url: s ? await buildInviteUrl(appRoot(location.origin), s) : null,
                    sharedWith: shared ?? null,
                  });
                });
            }}
            syncState={syncState}
            lastSyncAt={lastSyncAt}
            onRetrySync={retrySync}
            onMembersChanged={pushSoon}
            onCategoriesChanged={pushSoon}
            invitee={invitee}
            {...(cloud && sid ? { onRemoveInvitee: removeInvitee } : {})}
            {...(cloud && account ? {
              account: {
                email: account.email,
                busy: account.busy,
                error: account.error,
                onSignIn: account.onSignIn,
                onSignOut: signOutHere,
              },
            } : {})}
          />
```

`App()` 裡 `return <Gate cloud={cloud} />;` 不變。

- [ ] **Step 5: 跑測試確認通過**

Run: `npx vitest run src/App.gate.test.tsx src/App.test.tsx && npm run typecheck`
Expected: 全部通過（`App.test.tsx` 沒有 Google 設定，走 `Shell cloud={null} sid={null}`，行為不變）

- [ ] **Step 6: 跑全部單元測試**

Run: `npx vitest run`
Expected: 全部通過

- [ ] **Step 7: Commit**

```bash
git add src/invite/useSignIn.ts src/App.tsx src/App.gate.test.tsx
git commit -m "feat(app): use the app without signing in, sign in and out from settings" -m "Gate 持有接上的帳本：沒記過就給開始畫面，選過不登入或登出過就進本機模式，登入後換成那本帳；Shell 的同步依 sid 重新啟動，本機模式寫「只存在這台手機」、點它或邀請成員就登入。配置頁可以登出。換帳號或手機上有帳時跳確認視窗；加入邀請時手機上有帳也先問。舊版手機第一次連上時補記帳號。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: 文件、全面驗證、部署

**Files:**
- Modify: `docs/PROGRESS.md`（在「記一筆的鍵盤跑出畫面」那一條後面加一條）
- Modify: `README.md`（功能說明加一行）
- Modify: `docs/superpowers/specs/2026-09-18-guest-mode-and-account-design.md`（狀態改成「已實作」）

- [ ] **Step 1: 寫文件**

`docs/PROGRESS.md` 加：

```markdown
- **不登入使用與登入／登出**（使用者要求，2026-09-18）：開始畫面可以「先不登入，直接使用」，帳只存在這台手機；配置頁最上面的帳號區可以登入、登出。登出後帳留在手機上變回本機模式，同帳號再登入接回那本帳（受邀者接回對方的帳本）。換了帳號、或帳號雲端已經有帳本而手機上也有帳時，跳確認視窗選合併／改用雲端／取消；手機上的帳混著兩個人記的不能合併。合併時分類依「收支類型＋名稱」對到那本帳（`sync/categoryRemap.ts`），帳改算成自己在那本帳的身分，成員名稱以雲端為準。帳號用 Drive `about.get` 的 permissionId 比對，不多要權限；上線前就登入的手機第一次連上時補記。登入判斷是純函式 `planSignIn`（`sync/account.ts`），設計見 `docs/superpowers/specs/2026-09-18-guest-mode-and-account-design.md`。
```

`README.md` 在功能說明（「有新版時，切回 App 會自動換成新版…」那一段附近）加：

```markdown
- 不登入也能用：開始畫面選「先不登入，直接使用」，帳只存在這台手機；之後到配置頁登入 Google 就會同步，也能登出
```

設計文件第 3 行改成：`日期：2026-09-18。狀態：已實作（計畫見 docs/superpowers/plans/2026-09-18-guest-mode-and-account.md）。`

- [ ] **Step 2: 全面驗證**

Run:
```bash
npx vitest run
npm run typecheck
npx playwright test --project=ip13 --reporter=line
```
Expected: 單元測試全過、typecheck 乾淨、e2e（本機模式，沒有 Google 設定）全過。e2e 用的 dev server 不帶用戶端 ID，走 `Shell cloud={null}`，這次的改動不應該影響它。

- [ ] **Step 3: Commit 並推送**

```bash
git add docs/PROGRESS.md README.md docs/superpowers/specs/2026-09-18-guest-mode-and-account-design.md
git commit -m "docs: record using the app without signing in, and signing in and out" -m "PROGRESS 與 README 記下不登入使用、配置頁登入／登出、換帳號確認；設計文件狀態改為已實作。" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push origin main
```

- [ ] **Step 4: 確認部署**

Run: `gh run list --workflow deploy.yml --limit 1`
Expected: 最新一筆是剛推的 commit、`completed success`。之後請使用者在手機上：配置頁看到帳號區與信箱；登出 → 頂端寫「只存在這台手機」→ 再登入 → 接回同一本帳。
