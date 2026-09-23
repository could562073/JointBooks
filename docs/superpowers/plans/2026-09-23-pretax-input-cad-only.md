# 稅前輸入、只記 CAD，與更短的啟動頁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 記一筆的金額欄改成填稅前、右邊一格稅費、App 算出含稅合計；拿掉目前用不到的多幣別介面；順便把啟動頁從 2.6 秒縮到 1.2 秒。

**Architecture:** 畫面上打稅前，存進去的仍是實付總額（`amountCents = 稅前 + 稅`），所以 Sheet 的欄位意思、統計、年報表與既有幾百筆帳完全不動，也不需要 migration。多幣別拿掉的是**介面**：`Txn.currency`、`Txn.actualCadCents` 與 Sheet 的幣別欄、實扣欄全部保留，未來要加回來不必碰資料層。啟動頁是獨立的兩個常數。

**Tech Stack:** React 19 + TypeScript + CSS Modules、Zustand、Dexie/IndexedDB、Google Sheets API、Vitest + Testing Library、Playwright。

**Spec:** `docs/superpowers/specs/2026-09-23-pretax-input-cad-only-design.md`

## Global Constraints

- 金額一律用**整數分**（`number`）在程式裡流動，字串只在畫面與 Sheet 上出現。
- **存進去的 `amountCents` 是含稅合計（稅前＋稅）**，不是使用者打的那個稅前數字。`actualCadCents` 等於它，`currency` 一律 `'CAD'`。Sheet 的欄位意思一個都不變。
- `Txn.currency`、`Txn.actualCadCents`、Sheet 的幣別欄與實扣欄**保留**。這次拿掉的只有介面。
- 文案逐字：金額欄下方沒稅時 `金額請填稅前`、有稅時 `含稅合計 $17.75`（前綴是 `含稅合計 `）；稅費卡的標籤是 `稅費`。
- 收入沒有稅：稅費卡不出現、下方那行提示也不出現、存進去的 `taxCents` 一律 `undefined`。
- 稅**沒有上限**。v1.3.0 的「稅不能大於金額」連同 `taxError` 一起刪掉——它的前提（稅在金額裡面）已經不存在。
- 顏色只准用 `src/styles/tokens.css` 的 token，不准寫死色碼。
- TypeScript 是 `strict` + `noUncheckedIndexedAccess` + `noUnusedLocals`。
- 每個任務結束前都要跑 `npx tsc -b --noEmit` 與 `npx vitest run`，全綠才 commit。
- 註解寫繁體中文，解釋「為什麼」而不是「做什麼」。
- 所有指令跑前景，不要開背景 job。
- commit 訊息用英文祈使句，結尾帶兩行：
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01UrmcsJY9fsdTM9Fhxf5wf7
  ```

---

### Task 1: 啟動頁從 2.6 秒縮到 1.2 秒

跟其他任務完全無關，先做掉。現在的動畫本身只花 0.74 秒就跑完，後面乾等 1.4 秒才開始淡出。

**Files:**
- Modify: `src/lib/motion.ts:64-65`
- Modify: `src/components/LaunchScreen.tsx:6-13`（檔頭註解）
- Modify: `docs/MOTION.md:48`
- Test: `src/components/LaunchScreen.test.tsx`、`e2e/shell.spec.ts:8-29`

**Interfaces:**
- Consumes: 無
- Produces: `DUR.bootHold === 900`、`DUR.bootOut === 300`（其餘 boot 常數不動）

- [ ] **Step 1: 改測試（會失敗）**

`src/components/LaunchScreen.test.tsx`，把「時間軸」那一支整個換掉：

```ts
  // 動畫 0.74 秒就跑完，原本停到 2.15 秒是乾等（使用者要求縮短到接近 LINE 的啟動頁）
  it('0.9 秒開始淡出，淡出 0.3 秒', () => {
    expect(DUR.bootHold).toBe(900);
    expect(DUR.bootOut).toBe(300);
  });
```

同檔案其他三支用的是 `DUR.` 變數，不用動。

`e2e/shell.spec.ts` 第 8 行那支測試改名與收緊上限：

```ts
test('打開時先蓋啟動畫面，約 1.2 秒後消失；載入前的底色就是同一個淡紫（I48）', async ({ page }) => {
```

同一支裡的 `await expect(splash).toHaveCount(0, { timeout: 4_000 });` 改成：

```ts
  await expect(splash).toHaveCount(0, { timeout: 2_500 });
```

下面那支減少動態效果的（第 25 行）`timeout: 3_500` 改成 `timeout: 2_000`（減少動態時是 900 + 120 = 1.02 秒）。

**為什麼要收緊**：不收的話這個測試永遠不會紅，有人把它調回慢的也抓不到。

- [ ] **Step 2: 跑測試，確認紅**

Run: `npx vitest run src/components/LaunchScreen.test.tsx`
Expected: FAIL，`expected 2150 to be 900`。

- [ ] **Step 3: 改常數**

`src/lib/motion.ts`：

```ts
  bootHold: 900,       // #39 啟動畫面停留（動畫 0.74s 跑完就走，不再乾等）
  bootOut: 300,        // #39 啟動畫面放大淡出，播完就卸載
```

- [ ] **Step 4: 改註解與文件**

`src/components/LaunchScreen.tsx` 檔頭那段：

```tsx
/**
 * 啟動畫面（使用者要求，照原型 v2 的「啟動畫面」）。每次打開 App 蓋在最上層：
 * 兩顆饅頭依序彈起、後面一圈光暈擴散、字標浮現（原型底部的讀取條依使用者要求拿掉），0.9 秒後放大淡出，
 * 淡出播完（約 1.2 秒）就卸載（MOTION #39）。彈起與字標本來就在 0.74 秒內跑完，
 * 原型那個 2.15 秒的停留後半段是乾等，使用者要求縮短到接近 LINE 的啟動頁。
 *
 * 只是蓋在上面的一層，底下的 App 照常載入與同步，不會因此多等資料。
 * 減少動態效果時不播彈起與光暈，淡出改成 120ms。
 */
```

`docs/MOTION.md` 第 48 行那一列裡的 `2.15s 放大淡出` 改成 `0.9s 放大淡出`。

- [ ] **Step 5: 跑測試，確認綠**

Run: `npx vitest run && npx tsc -b --noEmit`
Expected: 全綠。

- [ ] **Step 6: 跑啟動頁的 E2E**

Run: `npx playwright test e2e/shell.spec.ts --project=ip13`
Expected: PASS。啟動頁那三支都在這個檔案裡。

- [ ] **Step 7: Commit**

```bash
git add src/lib/motion.ts src/components/LaunchScreen.tsx src/components/LaunchScreen.test.tsx e2e/shell.spec.ts docs/MOTION.md
git commit -m "feat(shell): cut the splash screen from 2.6s to 1.2s

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UrmcsJY9fsdTM9Fhxf5wf7"
```

---

### Task 2: 記一筆改成稅前輸入、只記 CAD

這是這個計畫的主體。草稿的純函式與面板一起改：面板 import 了那些要刪掉的函式，拆開做會編譯不過。

**Files:**
- Modify: `src/screens/entry/entryDraft.ts`（整個檔案的計算邏輯）
- Modify: `src/screens/entry/EntrySheet.tsx`（金額列、提示行、移除幣別與實扣欄）
- Modify: `src/screens/entry/EntrySheet.module.css`
- Test: `src/screens/entry/entryDraft.test.ts`、`src/screens/entry/EntrySheet.test.tsx`、`src/acceptance/a02-entry.test.tsx`

**Interfaces:**
- Consumes: `Txn.taxCents?: number`（v1.3.0 已有）、`NewTxnInput.taxCents?: number`
- Produces:
  - `type AmountField = 'amount' | 'tax'`
  - `EntryDraft`：`amount`（稅前字串）、`tax`（稅費字串）、`currency`（一律 `'CAD'`），**沒有 `cad` 欄位**
  - `taxCents(d: EntryDraft): number`（收入回 0）
  - `totalCents(d: EntryDraft): number`（稅前＋稅）
  - `canSave`、`toInput`、`draftForNew`、`draftFromTxn`、`setKind`、`setMain` 維持既有簽章
  - 刪除：`needsCadField`、`setCurrency`、`preTaxCents`、`taxError`、`actualCadCents`
  - testid：新增 `amount-hint`；移除 `currency-hint`、`currency-CAD`/`-TWD`/`-USD`、`currencies`、`field-cad`、`cad-panel`、`pre-tax`、`tax-error`；`field-amount`、`field-tax` 保留

- [ ] **Step 1: 改寫 `entryDraft.test.ts` 的稅與幣別部分（會失敗）**

先刪掉這些既有的測試（它們驗的是被拿掉的功能）：
- `describe('setCurrency')` 整段
- `needsCadField` 相關的 `it`
- `actualCadCents` 相關的 `it`
- `describe('其中稅')` 裡用到 `preTaxCents`／`taxError` 的每一支
- import 清單裡的 `actualCadCents`、`needsCadField`、`preTaxCents`、`setCurrency`、`taxError`

import 改成：

```ts
import {
  canSave, draftForNew, draftFromTxn, setKind, setMain, taxCents, toInput, totalCents,
} from './entryDraft';
```

新增一整個 describe（放在檔案最後）：

```ts
describe('稅前輸入', () => {
  const draft = (amount: string, tax = '') => ({ ...NEW(), amount, tax });

  it('新增模式金額與稅都是空的', () => {
    expect(NEW().amount).toBe('');
    expect(NEW().tax).toBe('');
  });

  it('含稅合計是稅前加稅', () => {
    expect(totalCents(draft('16.75', '1.00'))).toBe(1_775);
  });

  it('沒填稅時合計就是金額', () => {
    expect(totalCents(draft('16.75'))).toBe(1_675);
  });

  // 畫面上打稅前，存進去的是實付總額：Sheet 的金額欄與所有統計的意思都不變
  it('存出去的金額是含稅合計，不是打進去的稅前', () => {
    const i = toInput(draft('16.75', '1.00'));
    expect(i.amountCents).toBe(1_775);
    expect(i.actualCadCents).toBe(1_775);
    expect(i.taxCents).toBe(100);
    expect(i.currency).toBe('CAD');
  });

  it('沒填稅時 taxCents 帶 undefined，而不是漏掉這個鍵', () => {
    const i = toInput(draft('16.75'));
    expect('taxCents' in i).toBe(true);
    expect(i.taxCents).toBeUndefined();
  });

  // 稅現在是外加的，不再是金額裡的一部分，沒有上限可言
  it('稅比金額還大也能存', () => {
    const d = draft('1.00', '50.00');
    expect(canSave(d)).toBe(true);
    expect(toInput(d).amountCents).toBe(5_100);
  });

  it('金額 0 還是存不了', () => {
    expect(canSave(draft('', '1.00'))).toBe(false);
  });

  it('收入沒有稅：打了也不算，也不會存進去', () => {
    const income = { ...setKind(NEW(), CATS, 'income'), amount: '100', tax: '5.00' };
    expect(taxCents(income)).toBe(0);
    expect(totalCents(income)).toBe(10_000);
    expect(toInput(income).taxCents).toBeUndefined();
  });

  // 收入沒有稅費欄，焦點留在那裡會變成打字沒有任何反應
  it('切到收入時焦點從稅欄收回金額欄', () => {
    const onTax = { ...NEW(), field: 'tax' as const };
    expect(setKind(onTax, CATS, 'income').field).toBe('amount');
  });
});

describe('編輯模式帶入的金額', () => {
  it('CAD 的帳：金額欄顯示稅前，稅費欄顯示稅', () => {
    const d = draftFromTxn(CATS, txn({ amountCents: 1_775, actualCadCents: 1_775, taxCents: 100 }));
    expect(d.amount).toBe('16.75');
    expect(d.tax).toBe('1.00');
  });

  it('沒有稅的帳：金額欄就是原值，稅費欄空著', () => {
    const d = draftFromTxn(CATS, txn({ amountCents: 1_250, actualCadCents: 1_250 }));
    expect(d.amount).toBe('12.50');
    expect(d.tax).toBe('');
  });

  // v1.3.0 的稅費欄在收入時也看得見，可能已經記過一筆帶稅的收入。
  // 減掉的話那筆收入會在編輯時無聲地變小
  it('帶稅的收入：金額原樣帶入，不減掉稅', () => {
    const inc = txn({
      mainId: INCOME[0]!.id, subId: INCOME[0]!.subs[0]!.id,
      amountCents: 10_000, actualCadCents: 10_000, taxCents: 500,
    });
    const d = draftFromTxn(CATS, inc);
    expect(d.kind).toBe('income');
    expect(d.amount).toBe('100.00');
    expect(d.tax).toBe('');
  });

  // 使用者裁決：舊的外幣紀錄一編輯就轉成 CAD，原幣金額不保留
  it('舊的外幣紀錄：帶入實扣 CAD，幣別變成 CAD', () => {
    const d = draftFromTxn(CATS, txn({ amountCents: 128_000, currency: 'TWD', actualCadCents: 5_800 }));
    expect(d.amount).toBe('58.00');
    expect(d.tax).toBe('');
    expect(d.currency).toBe('CAD');
  });
});
```

`txn()` 這個 helper 在 Task 前就已經在檔案最上層了（前一個計畫搬的），`INCOME` 也是既有的常數，直接用。

- [ ] **Step 2: 跑測試，確認紅**

Run: `npx vitest run src/screens/entry/entryDraft.test.ts`
Expected: FAIL，`totalCents is not a function`。

- [ ] **Step 3: 改寫 `entryDraft.ts`**

整個檔案改成：

```ts
import { selectable } from '../../domain/categories';
import type { Category, CategoryKind, Currency, Person, Txn } from '../../domain/types';
import type { NewTxnInput } from '../../repo/ledgerRepo';
import { toCents } from '../../domain/money';
import { centsToInput } from './amountInput';

/** 數字鍵盤打在哪一個欄位上（§5：兩個欄位共用同一組鍵盤） */
export type AmountField = 'amount' | 'tax';

export type EntryDraft = {
  kind: CategoryKind;
  /** 稅前金額的顯示字串。加拿大的標價本來就不含稅，使用者手上拿著的就是這個數字 */
  amount: string;
  /** 稅費的顯示字串，可不填。外加在金額上，不是金額的一部分 */
  tax: string;
  /**
   * 一律 'CAD'。多幣別的介面已經拿掉（使用者：目前只用得到 CAD），但資料層完整保留，
   * 以後要加回來不必動 Sheet、也不必 migration
   */
  currency: Currency;
  mainId: string;
  subId: string;
  /** YYYY-MM-DD。§5：儲存寫入的是這裡選的日期，不是月曆上的選中日 */
  date: string;
  by: Person;
  note: string;
  field: AmountField;
};

/** 該分類清單裡第一個可選的主分類與它的第一個子分類 */
function firstOf(cats: Category[], kind: CategoryKind): { mainId: string; subId: string } {
  const main = selectable(cats, kind)[0];
  return { mainId: main?.id ?? '', subId: main?.subs[0]?.id ?? '' };
}

/**
 * §5 新增模式。日期預設為月曆上選中那天，不是今天——使用者剛剛才在月曆上
 * 挑了一天，這時候跳回今天等於把他的選擇丟掉。
 */
export function draftForNew(cats: Category[], date: string, by: Person = '我'): EntryDraft {
  return {
    kind: 'expense',
    amount: '', tax: '',
    currency: 'CAD',
    ...firstOf(cats, 'expense'),
    date, by, note: '',
    field: 'amount',
  };
}

/**
 * 編輯模式金額欄要顯示的分。存進去的是含稅合計，畫面上要顯示的是稅前。
 *
 * 三種情況分開處理：
 * - 收入：原樣。v1.3.0 的稅費欄在收入時也看得見，可能已經有一筆帶稅的收入，
 *   減掉的話那筆收入會在編輯時無聲地變小。
 * - 舊的外幣紀錄：顯示實際扣款的 CAD。原幣金額不再出現在畫面上，存檔後也不保留。
 * - 其餘：合計扣掉稅就是稅前。
 */
function editableAmountCents(kind: CategoryKind, t: Txn): number {
  if (kind === 'income') return t.amountCents;
  if (t.currency !== 'CAD') return t.actualCadCents;
  return t.amountCents - (t.taxCents ?? 0);
}

/** §5 編輯模式：欄位帶入原值 */
export function draftFromTxn(cats: Category[], t: Txn): EntryDraft {
  const kind = cats.find((c) => c.id === t.mainId)?.kind ?? 'expense';
  const hasTax = kind === 'expense' && t.currency === 'CAD' && !!t.taxCents;
  return {
    kind,
    amount: centsToInput(editableAmountCents(kind, t)),
    tax: hasTax ? centsToInput(t.taxCents!) : '',
    // 一律帶 CAD：舊的外幣紀錄一存檔就完成轉換（使用者裁決：原幣不保留）
    currency: 'CAD',
    mainId: t.mainId, subId: t.subId,
    date: t.date, by: t.by, note: t.note,
    field: 'amount',
  };
}

/**
 * 切換支出／收入。主分類必須跟著換成該類別的第一個——留著原本那顆的話，
 * 面板會顯示一個不在 chip 清單裡的選取狀態，存下去也會讓 kind 與分類不一致。
 *
 * 切到收入時焦點也要收回金額欄：收入沒有稅費欄，焦點留在那裡會變成打字沒有任何反應。
 */
export function setKind(d: EntryDraft, cats: Category[], kind: CategoryKind): EntryDraft {
  if (kind === d.kind) return d;
  return {
    ...d, kind, ...firstOf(cats, kind),
    field: kind === 'income' ? 'amount' : d.field,
  };
}

/** 換主分類要一併把子分類移到新主分類的第一個，舊的 subId 在新分類裡不存在 */
export function setMain(d: EntryDraft, cats: Category[], mainId: string): EntryDraft {
  const main = cats.find((c) => c.id === mainId);
  return { ...d, mainId, subId: main?.subs[0]?.id ?? '' };
}

/** 稅費的分。收入沒有稅——擋在這一個地方，卡片、合計與儲存全部跟著對 */
export function taxCents(d: EntryDraft): number {
  return d.kind === 'income' ? 0 : toCents(d.tax);
}

/** 含稅合計＝稅前＋稅。存進去的 amountCents 就是這個數字 */
export function totalCents(d: EntryDraft): number {
  return toCents(d.amount) + taxCents(d);
}

/**
 * §5：金額為 0 時不寫入。
 * 稅是外加的，沒有上限，也不參與這個判斷——稅打得比金額大是合法的
 * （例如只買了一個押金品項）。
 */
export function canSave(d: EntryDraft): boolean {
  if (!d.mainId || !d.subId) return false;
  return toCents(d.amount) !== 0;
}

export function toInput(d: EntryDraft): NewTxnInput {
  const total = totalCents(d);
  return {
    date: d.date,
    mainId: d.mainId,
    subId: d.subId,
    // 畫面上打稅前，存進去的是實付總額：Sheet 的金額欄、年報表的 SUMIFS 與所有統計的意思都不變
    amountCents: total,
    currency: 'CAD',
    actualCadCents: total,
    by: d.by,
    note: d.note,
    // 一定要帶這個鍵：編輯時把稅刪掉，patch 少了它舊值就會留著
    taxCents: taxCents(d) || undefined,
  };
}
```

- [ ] **Step 4: 跑純函式的測試，確認綠**

Run: `npx vitest run src/screens/entry/entryDraft.test.ts`
Expected: PASS。`EntrySheet.tsx` 這時還編譯不過，下一步處理。

- [ ] **Step 5: 改寫 `EntrySheet.test.tsx`（會失敗）**

刪掉這四支驗幣別與實扣欄的測試：
- `it('CAD 時沒有實扣欄位，提示是「主幣別 CAD · 直接記錄」')`
- `it('切到外幣才出現實扣欄位與對應提示')`
- `it('點實扣欄位後數字鍵改打在那一欄')`
- `it('切回 CAD 時實扣欄位消失，焦點回到金額欄')`
- `it('外幣沒填實扣時不給存')`

`describe('其中稅（對收據用）')` 整段換成：

```ts
describe('稅費與含稅合計', () => {
  it('支出時有稅費卡，預設是 0 的淡色字，提示是「金額請填稅前」', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.getByTestId('field-tax')).toBeInTheDocument();
    expect(screen.getByTestId('field-tax').querySelector('[data-empty]')).not.toBeNull();
    expect(screen.getByTestId('amount-hint')).toHaveTextContent('金額請填稅前');
  });

  it('點稅費卡之後，數字鍵打進稅費而不是金額', () => {
    render(<EntrySheet {...BASE} />);
    typeAmount('16.75');
    fireEvent.click(screen.getByTestId('field-tax'));
    typeAmount('1.00');
    expect(screen.getByTestId('field-amount')).toHaveTextContent('16.75');
    expect(screen.getByTestId('field-tax')).toHaveTextContent('1.00');
  });

  it('填了稅費，提示變成含稅合計', () => {
    render(<EntrySheet {...BASE} />);
    typeAmount('16.75');
    fireEvent.click(screen.getByTestId('field-tax'));
    typeAmount('1.00');
    expect(screen.getByTestId('amount-hint')).toHaveTextContent('含稅合計 $17.75');
  });

  // 畫面上打稅前，存進去的是實付總額
  it('存出去的金額是含稅合計', () => {
    const onSave = vi.fn();
    render(<EntrySheet {...BASE} onSave={onSave} />);
    typeAmount('16.75');
    fireEvent.click(screen.getByTestId('field-tax'));
    typeAmount('1.00');
    fireEvent.click(screen.getByTestId('key-save'));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      amountCents: 1_775, taxCents: 100, currency: 'CAD', actualCadCents: 1_775,
    }));
  });

  it('收入沒有稅費卡，也沒有那行提示', () => {
    render(<EntrySheet {...BASE} />);
    fireEvent.click(screen.getByTestId('kind-income'));
    expect(screen.queryByTestId('field-tax')).not.toBeInTheDocument();
    expect(screen.queryByTestId('amount-hint')).not.toBeInTheDocument();
  });

  it('編輯一筆有稅的帳：金額欄顯示稅前，稅費欄顯示稅', () => {
    render(<EntrySheet {...BASE} txn={txn({ amountCents: 1_775, actualCadCents: 1_775, taxCents: 100 })} />);
    expect(screen.getByTestId('field-amount')).toHaveTextContent('16.75');
    expect(screen.getByTestId('field-tax')).toHaveTextContent('1.00');
    expect(screen.getByTestId('amount-hint')).toHaveTextContent('含稅合計 $17.75');
  });

  it('畫面上沒有幣別切換，也沒有實扣 CAD 欄', () => {
    render(<EntrySheet {...BASE} />);
    expect(screen.queryByTestId('currencies')).not.toBeInTheDocument();
    expect(screen.queryByTestId('currency-TWD')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-cad')).not.toBeInTheDocument();
  });
});
```

`kind-income` 這個 testid 是 `KindSegment` 既有的（`e2e/entry.spec.ts` 有用到），不用新增。

- [ ] **Step 6: 改寫 `a02-entry.test.tsx` 的幣別驗收（會失敗）**

`describe('§15.1-8 幣別選 TWD 出現實際扣款 CAD 欄位')` 整段刪掉，換成：

```ts
describe('§15.1-8 金額填稅前，存進去的是含稅合計', () => {
  it('打稅前與稅費，明細列顯示的是合計', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('16.75');
    fireEvent.click(screen.getByTestId('field-tax'));
    typeAmount('1.00');
    fireEvent.click(screen.getByTestId('key-save'));

    await settledTxns(1);
    expect(listedRows()[0]!).toContain('17.75');
  });
});
```

- [ ] **Step 7: 跑測試，確認紅**

Run: `npx vitest run src/screens/entry/ src/acceptance/a02-entry.test.tsx`
Expected: FAIL。找不到 `amount-hint`、`field-tax` 還在舊位置。

- [ ] **Step 8: 改 `EntrySheet.tsx`**

import 改成（拿掉 `needsCadField`、`setCurrency`、`preTaxCents`、`taxError`、`actualCadCents`，加上 `taxCents`、`totalCents`）：

```tsx
import {
  canSave, draftForNew, draftFromTxn, setKind, setMain, taxCents, toInput, totalCents,
  type AmountField, type EntryDraft,
} from './entryDraft';
```

同時拿掉 `import type { Category, Currency, Txn }` 裡的 `Currency`，以及檔案上方的 `const CURRENCIES: Currency[] = ['CAD', 'TWD', 'USD'];`。

`showCad` / `cadPanel` / `saveable` 那一區改成：

```tsx
  const main = categories.find((c) => c.id === draft.mainId);
  const sub = main?.subs.find((s) => s.id === draft.subId);
  const saveable = canSave(draft);
  // 收入沒有稅：稅費卡與含稅合計那行都不出現
  const showTax = draft.kind === 'expense';
  const tax = taxCents(draft);
```

（`cadPanel` 那一行 `const cadPanel = usePresence(showCad, DUR.popIn, reduced);` 整行刪掉；`usePresence` 仍然被小月曆用著，import 留著。）

`key` 的分派回到兩路：

```tsx
  const key = useCallback((k: KeypadKey) => {
    const c = keyChar(k);
    setDraft((d) => (d.field === 'tax'
      ? { ...d, tax: pushDigit(d.tax, c) }
      : { ...d, amount: pushDigit(d.amount, c) }));
  }, []);
```

金額列整段（原本的 `.amountRow` 加幣別 chips、提示行、`cadPanel` 區塊、以及下面那張舊的稅卡與 `tax-error`）換成：

```tsx
        <div className={styles.amountRow}>
          <button
            type="button"
            className={styles.amount}
            data-focused={draft.field === 'amount' ? '' : undefined}
            onClick={() => focus('amount')}
            data-testid="field-amount"
          >
            <span className={styles.dollar} aria-hidden="true">$</span>
            <span className={styles.digits} data-empty={isBlank(draft.amount) ? '' : undefined}>
              {draft.amount || '0'}
            </span>
          </button>

          {/* 稅費：跟金額同一排、共用同一組鍵盤。收入沒有稅，整格不出現 */}
          {showTax && (
            <button
              type="button"
              className={styles.tax}
              data-focused={draft.field === 'tax' ? '' : undefined}
              onClick={() => focus('tax')}
              data-testid="field-tax"
            >
              <span className={styles.taxLabel}>稅費</span>
              <span className={styles.dollarSm} aria-hidden="true">$</span>
              <span className={styles.taxDigits} data-empty={isBlank(draft.tax) ? '' : undefined}>
                {draft.tax || '0'}
              </span>
            </button>
          )}
        </div>

        {/* 加拿大的標價不含稅，所以金額欄要的是稅前；填了稅就把實付的總額算給使用者看 */}
        {showTax && (
          <p className={styles.hint} data-testid="amount-hint">
            {tax > 0 ? `含稅合計 ${formatCad(totalCents(draft), 'none')}` : '金額請填稅前'}
          </p>
        )}
```

`formatCad` 已經在這個檔案的 import 裡了，不用加。

- [ ] **Step 9: 改 `EntrySheet.module.css`**

刪掉這些整段規則：`.currencies`、`.currency`、`.currency[data-selected]`、`.cad`、`.cadLine`、`.cadDigits`、`.cadDigits[data-empty]`、`.cadPanel`、`.cadClip`、`.cadEnter`、`.cadExit`、`@keyframes cadExpand`、`@keyframes cadCollapse`、`.taxTop`、`.taxLine`、`.preTax`、`.taxError`。

`.amountRow` 的 `align-items` 改成置中（右邊現在是一張矮卡，不是一排 chip）：

```css
.amountRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 15px 0 3px;
}
```

`.amount` 加上白卡底色（照 mockup：金額與稅費現在是同一排的一對，一個有卡一個沒有會看起來不平衡）：

```css
.amount {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-width: 0;
  border: 0;
  background: var(--c-card);
  border-radius: 14px;
  padding: 8px 12px;
  cursor: pointer;
}
```

焦點那條共用規則裡的 `.cad` 換成 `.tax`：

```css
/* §5：正在輸入的那個金額欄位套紫色外框。inset 不改變盒子尺寸，不會位移 */
.amount[data-focused],
.tax[data-focused] {
  box-shadow: inset 0 0 0 2px var(--c-primary);
}
```

`.tax` 那一整段（v1.3.0 的整寬白卡）換成同一排的小卡：

```css
/* 稅費：跟金額同一排的小白卡，共用同一組鍵盤 */
.tax {
  flex: none;
  display: flex;
  align-items: baseline;
  gap: 5px;
  border: 0;
  border-radius: var(--r-sm);
  background: var(--c-card);
  padding: 10px 12px;
  cursor: pointer;
}

.taxLabel {
  font-family: var(--f-body);
  font-size: 11.5px;
  color: var(--c-text-3);
}

.taxDigits {
  font-family: var(--f-num);
  font-weight: 700;
  font-size: 18px;
  color: var(--c-text);
  font-variant-numeric: tabular-nums;
}

.taxDigits[data-empty] { color: rgba(74, 63, 54, .25); }
```

`.dollarSm` 留著——原本是實扣欄在用，現在給稅費卡用。

- [ ] **Step 10: 補一支 repo 層的測試，釘住外幣轉 CAD 這條路**

`src/repo/ledgerRepo.test.ts`，加在檔案最後。`ledgerRepo.updateTxn` 有一條既有的保護：
幣別不是 CAD 而又動到金額卻沒給 `actualCadCents` 就拋錯。編輯舊外幣紀錄正好走這條路，
值得釘住它不會拋、而且轉換後兩個數字一致：

```ts
describe('舊的外幣紀錄編輯後轉成 CAD', () => {
  it('金額與實扣一致，幣別變成 CAD', async () => {
    const c = cat('外食');
    const t = await ledgerRepo.addTxn({
      date: '2026-09-05', mainId: c.id, subId: c.subs[0]!.id,
      amountCents: 128_000, currency: 'TWD', actualCadCents: 5_800, by: '我', note: '',
    });

    // 面板送出的 patch：一律 CAD，金額與實扣都是含稅合計
    const next = await ledgerRepo.updateTxn(t!.id, {
      amountCents: 5_800, currency: 'CAD', actualCadCents: 5_800, taxCents: undefined,
    });

    expect(next.currency).toBe('CAD');
    expect(next.amountCents).toBe(5_800);
    expect(next.actualCadCents).toBe(5_800);
  });
});
```

`cat()` 與 `cats` 是這個檔案 `beforeEach` 已經準備好的，直接用。

- [ ] **Step 11: 跑測試，確認綠**

Run: `npx vitest run && npx tsc -b --noEmit`
Expected: 全綠。如果 `noUnusedLocals` 抱怨 `EntrySheet.tsx` 裡有沒用到的 import（例如 `Currency`），把它拿掉。

- [ ] **Step 12: Commit**

```bash
git add src/screens/entry/ src/acceptance/a02-entry.test.tsx src/repo/ledgerRepo.test.ts
git commit -m "feat(entry): take the pre-tax price and add the tax on top

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UrmcsJY9fsdTM9Fhxf5wf7"
```

---

### Task 3: 明細列拿掉幣別小字，金額加回錢字號

**Files:**
- Modify: `src/screens/daily/TxnList.tsx:4`、`:100-111`
- Modify: `src/screens/daily/TxnList.module.css:104-110`
- Modify: `src/domain/money.ts`（刪 `formatOriginal`）
- Test: `src/screens/daily/TxnList.test.tsx`、`src/domain/money.test.ts`

**Interfaces:**
- Consumes: 無（獨立於 Task 2）
- Produces: `formatOriginal` 不再存在

- [ ] **Step 1: 改測試（會失敗）**

`src/screens/daily/TxnList.test.tsx`：
- 把「原型的明細金額不帶 $」那兩行斷言換掉：

```ts
    // 右下角的幣別小字拿掉之後，金額自己帶錢字號（全部都是 CAD，不會認錯）
    expect(screen.getByTestId('txn-t1')).toHaveTextContent('-$12.50');
    expect(screen.getByTestId('txn-t2')).toHaveTextContent('+$3,000.00');
```

- `it('CAD 只顯示 CAD，外幣顯示原幣金額')` 整支換成：

```ts
  // 只記 CAD 之後那行小字沒有意義了；舊的外幣紀錄顯示的一直是實扣 CAD
  it('不再顯示幣別，舊的外幣紀錄顯示實扣 CAD', () => {
    render(
      <TxnList
        {...BASE}
        txns={[txn(), txn({ id: 't2', amountCents: 128_000, currency: 'TWD', actualCadCents: 5_800 })]}
      />
    );
    expect(screen.getByTestId('txn-t1').textContent).not.toContain('CAD');
    expect(screen.getByTestId('txn-t2').textContent).not.toContain('TWD');
    expect(screen.getByTestId('txn-t2')).toHaveTextContent('-$58.00');
  });
```

`src/domain/money.test.ts`：刪掉 `it('formatOriginal：CAD 顯示 CAD，其他顯示金額 + 幣別（§4）')` 整支，並把 import 清單裡的 `formatOriginal` 拿掉。

- [ ] **Step 2: 跑測試，確認紅**

Run: `npx vitest run src/screens/daily/TxnList.test.tsx`
Expected: FAIL，金額沒有 `$`。

- [ ] **Step 3: 改 `TxnList.tsx`**

第 4 行的 import：

```tsx
import { formatCad } from '../../domain/money';
```

`formatCents` 在這個檔案裡只有金額那一行用到（第 104 行），換成 `formatCad` 之後就沒人用了，所以整個換掉而不是兩個都 import。

金額那一段：

```tsx
        <span className={styles.right}>
          <span className={styles.amountBox}>
            {/* 全部都是 CAD，右下角不再標幣別，所以金額自己帶錢字號 */}
            <span className={isIncome ? styles.income : styles.expense}>
              {formatCad(txn.actualCadCents, isIncome ? 'plus' : 'minus')}
            </span>
          </span>
```

- [ ] **Step 4: 刪掉沒人用的樣式與函式**

`src/screens/daily/TxnList.module.css`：刪掉 `.currency` 那一整段。

`src/domain/money.ts`：刪掉 `formatOriginal` 整個函式與它上面的註解。它只服務那行小字；未來要把多幣別加回來時版面已經不一樣，留著一個為舊版面寫的格式化函式沒有價值。

- [ ] **Step 5: 跑測試，確認綠**

Run: `npx vitest run && npx tsc -b --noEmit`
Expected: 全綠。

- [ ] **Step 6: Commit**

```bash
git add src/screens/daily/ src/domain/money.ts src/domain/money.test.ts
git commit -m "feat(daily): drop the currency line and put the dollar sign back

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UrmcsJY9fsdTM9Fhxf5wf7"
```

---

### Task 4: E2E、版本與文件

**Files:**
- Modify: `e2e/entry.spec.ts:131-158`、`e2e/layout.spec.ts:148`
- Modify: `package.json`、`package-lock.json`
- Modify: `README.md`、`docs/PROGRESS.md`

**Interfaces:**
- Consumes: Task 2 的 testid `field-tax`、`amount-hint`；Task 3 的明細列金額格式
- Produces: 無

- [ ] **Step 1: 改 E2E**

`e2e/entry.spec.ts` 裡那支「記一筆有稅的帳」整個換成：

```ts
  test('記一筆稅前加稅費：合計算給你看，存完再打開稅還在', async ({ page }) => {
    await openSheet(page);
    await page.getByTestId('key-1').click();
    await page.getByTestId('key-6').click();
    await page.getByTestId('key-.').click();
    await page.getByTestId('key-7').click();
    await page.getByTestId('key-5').click();
    await expect(page.getByTestId('amount-hint')).toHaveText('金額請填稅前');

    await page.getByTestId('field-tax').click();
    await page.getByTestId('key-1').click();
    await page.getByTestId('key-.').click();
    await page.getByTestId('key-0').click();
    await page.getByTestId('key-0').click();
    await expect(page.getByTestId('amount-hint')).toHaveText('含稅合計 $17.75');

    await page.getByTestId('key-save').click();
    await expect(page.getByTestId('entry-sheet')).toHaveCount(0, { timeout: 2_000 });

    // 月曆展開時明細那一列在小手機上會落到分頁列底下，先收起來
    await page.getByTestId('calendar-handle').click();
    await settle(page);
    const row = page.getByTestId('txn-list').locator('li').first();
    await expect(row).toContainText('-$17.75');

    await row.click();
    await expect(page.getByTestId('field-amount')).toContainText('16.75');
    await expect(page.getByTestId('field-tax')).toContainText('1.00');
    await expect(page.getByTestId('amount-hint')).toHaveText('含稅合計 $17.75');
  });
```

`e2e/layout.spec.ts` 第 148 行的選擇器把 `[data-testid^="currency-"], ` 拿掉（那些元素不存在了）：

```ts
    const hits = await hitAreas(page, '[data-testid^="key-"], [data-testid^="by-"], [data-testid="entry-close"]');
```

- [ ] **Step 2: 跑 E2E**

Run: `npx playwright test e2e/entry.spec.ts --project=ip13`
Expected: PASS。第一次要等它自己的 dev server 起來（跑在 5174，不會碰使用者手上的 5173）。

- [ ] **Step 3: 跑短螢幕那一輪**

Run: `npx playwright test e2e/entry.spec.ts --project=se`
Expected: PASS。「畫面比面板矮時，鍵盤固定在底部一直看得到」那一支必須照樣通過——這次拿掉了實扣欄與舊的稅卡、稅費併進金額那一排，面板應該比之前更矮，但還是要確認。

- [ ] **Step 4: 跑完整 E2E**

Run: `npx playwright test`
Expected: 全綠。整輪大約 10 分鐘，前景跑。已知偶發：`shell.spec.ts` 的 I51 與一支拖曳速度的 D4，重跑就過；`entry.spec.ts` 裡的任何一支掛掉都是真問題。

- [ ] **Step 5: 升版本**

Run: `npm version minor --no-git-tag-version`
Expected: `package.json` 與 `package-lock.json` 變成 `1.4.0`。

**注意**：這個指令會改 lockfile，Vite 會因此重載所有開著的頁面。跑之前先確定沒有 Playwright 正在跑。

- [ ] **Step 6: 更新文件**

`docs/PROGRESS.md` 照既有格式加一條：金額欄改成填稅前、右邊一格稅費、下方顯示含稅合計；多幣別的介面拿掉（資料欄位保留），新紀錄一律 CAD，舊的外幣紀錄一編輯就轉成 CAD；明細列不再顯示幣別、金額帶回錢字號；啟動頁從 2.6 秒縮到 1.2 秒。先讀那個檔案看它現有的寫法再動筆。

`README.md`「記一筆」那一節現在是這兩行（第 28–29 行）：

```markdown
- 數字鍵盤輸入金額，支援 CAD／TWD／USD；非加幣時另外填銀行實際扣款的加幣金額，統計一律用實扣金額，不必換算匯率
- 可以多填「其中稅」，對加拿大收據用：金額欄仍是收據總額，稅只是註記其中有多少是稅，不影響統計
```

兩行合併成一行，講現在的行為（金額填稅前、稅費另外填、App 算含稅合計、一律加幣）。
另外第 8 行的引言寫著「日常支出用加幣，偶爾刷台幣、美金」，把後半句拿掉。

- [ ] **Step 7: Commit**

```bash
git add e2e/ package.json package-lock.json README.md docs/PROGRESS.md
git commit -m "chore(release): 1.4.0, pre-tax entry and CAD-only records

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01UrmcsJY9fsdTM9Fhxf5wf7"
```
