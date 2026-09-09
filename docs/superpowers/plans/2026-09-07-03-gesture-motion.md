# Plan 03 — 手勢引擎與動畫基礎層 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一個共用的跟手手勢引擎，四個互動共用它；加上 reduced-motion 的反應式 hook，以及 37 條動畫的驗收清單。

**Architecture:** 手勢的**決策**與 **DOM 副作用**分開。門檻判定、阻尼、速度、吸附方向抽成 `gestureMath.ts` 的純函式，用 Vitest 測；`useDragGesture.ts` 只負責 pointer 生命週期與呼叫那些函式，用 Playwright 在真實 Chromium 裡驅動真實 pointer 事件來測。

這個切法不是美學問題。jsdom 沒有真正的 `setPointerCapture`、沒有版面、`PointerEvent` 是模擬的 —— 在它上面測手勢會拿到假綠燈。Plan 01 已經被這類假綠燈咬過一次（`document.fonts.check()` 對 subset 字型必然回 false，測試永遠紅）。手勢是這個 App 最需要「真的在瀏覽器裡動起來」的部分，測試方式必須配得上。

**Tech Stack:** React 19、TypeScript（`strict`、`noUncheckedIndexedAccess`）、Pointer Events API、Vitest（純函式）、Playwright（真實拖曳）

**Spec:** `HANDOFF.md`（§10 MOTION 全表、§11-15 手勢與點擊衝突、§12.3 iOS）＋ `docs/HANDOFF-AMENDMENTS.md`（優先）

## Global Constraints

以下逐字取自規格，**每個任務都隱含要遵守**：

- **先超過門檻位移才接管手勢，接管後才 `setPointerCapture`。** 一按下就捕捉指標會讓日期格與卡內按鈕完全點不到 —— 原型踩過這個坑（§11-15）
- 拖曳中**關掉 transition**，放手才套回彈曲線
- 所有位移用 `translate3d` + `will-change: transform`，**不用 `left`／`top`**
- `touch-action`：垂直拖曳用 `none`，水平拖曳用 `pan-y`（保留垂直捲動）
- 超出邊界的拖曳要有阻尼（位移 ×0.3～0.5），不可硬止
- 放手依**位移與速度兩者取或**判定：任一超過門檻即吸附
- 回彈曲線 `cubic-bezier(.22,1,.36,1)`；進場 `cubic-bezier(.2,.8,.2,1)`；離場 `ease-out`
- `prefers-reduced-motion` 時所有時長降為 **120ms**，但**手勢仍須可用** —— 直接到位，不做中間動畫
- 所有可點目標 ≥ `44×44`
- 註解一律繁體中文

### 四個消費者的門檻（逐字取自 §10）

| 消費者 | MOTION | 軸 | 接管 | 跟手 | 範圍 | 吸附門檻 | 其他 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 月曆把手 | #13 | y | — | 1:1 | `max-height 460↔0` | `>138px` 或 `>0.4px/ms` | `<6px` 視為點擊 |
| 月曆換月 | #7 | x | `10px` | `×0.55` | — | `>56px` 或 `>0.35px/ms` | 垂直超出水平 `18px` 放棄；彈回 300ms |
| 分類卡左滑 | #15 | x | `10px` | 1:1 | `-84 ~ 0` | `>42px` 或 `>0.35px/ms` | 超界阻尼 `0.3～0.5`；回彈 380ms |
| 面板下滑關閉 | #22 / #35 | y | — | 1:1 | `>= 0`（不往上） | `>110px` 或 `>0.4px/ms` | 關閉／彈回皆 260ms |
| 下拉重整 | #27 | y | — | 阻尼 `.5` | 上限 `64px` | 放手 spin 700ms | 資料到齊回彈 300ms |

---

### Task 1: 手勢門檻常數

**Files:**
- Create: `src/lib/gesture.ts`
- Test: `src/lib/gesture.test.ts`

**Interfaces:**
- Consumes: 無
- Produces:
  ```ts
  export type GesturePreset = {
    axis: 'x' | 'y';
    takeoverPx: number;      // 0 = 不需要門檻，按下即接管
    followRatio: number;     // 1 = 1:1
    min: number | null;      // null = 無下界
    max: number | null;
    damping: number;         // 超界時的位移倍率
    snapDistancePx: number;
    snapVelocity: number;    // px/ms
    tapPx: number;           // 0 = 不判定點擊
    abandonPx: number | null; // 另一軸超出這麼多就放棄；null = 不放棄
  };
  export const GESTURE: {
    calendarHandle: GesturePreset;   // #13
    monthSwipe: GesturePreset;       // #7
    categoryCard: GesturePreset;     // #15
    panelDismiss: GesturePreset;     // #22 / #35
    pullRefresh: GesturePreset;      // #27
  };
  ```

**為什麼是 preset 而不是散落的數字：** Plan 01 的整支分支 review 指出這些門檻「和 `DUR` 是同一類東西 —— 規格編號過的數值」，而散在 hook 裡會讓 Plan 04–07 各自抄一份。一個 preset 就是一個消費者的完整設定，元件只寫 `useDragGesture(GESTURE.monthSwipe, {...callbacks})`。

- [ ] **Step 1: 寫失敗的測試**

`src/lib/gesture.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { GESTURE } from './gesture';

describe('GESTURE preset 逐條對 §10', () => {
  it('#13 月曆把手：1:1、>138px 或 >0.4px/ms、<6px 視為點擊', () => {
    expect(GESTURE.calendarHandle).toEqual({
      axis: 'y', takeoverPx: 0, followRatio: 1,
      min: null, max: null, damping: 0.4,
      snapDistancePx: 138, snapVelocity: 0.4,
      tapPx: 6, abandonPx: null,
    });
  });

  it('#7 月曆換月：10px 才接管、跟手 ×0.55、>56px 或 >0.35px/ms、垂直 18px 放棄', () => {
    expect(GESTURE.monthSwipe).toEqual({
      axis: 'x', takeoverPx: 10, followRatio: 0.55,
      min: null, max: null, damping: 0.4,
      snapDistancePx: 56, snapVelocity: 0.35,
      tapPx: 0, abandonPx: 18,
    });
  });

  it('#15 分類卡：10px 才接管、-84~0、>42px 或 >0.35px/ms', () => {
    expect(GESTURE.categoryCard).toEqual({
      axis: 'x', takeoverPx: 10, followRatio: 1,
      min: -84, max: 0, damping: 0.3,
      snapDistancePx: 42, snapVelocity: 0.35,
      tapPx: 0, abandonPx: null,
    });
  });

  it('#22/#35 面板下滑：不往上超過 0、>110px 或 >0.4px/ms', () => {
    expect(GESTURE.panelDismiss).toEqual({
      axis: 'y', takeoverPx: 0, followRatio: 1,
      min: 0, max: null, damping: 0.4,
      snapDistancePx: 110, snapVelocity: 0.4,
      tapPx: 0, abandonPx: null,
    });
  });

  it('#27 下拉重整：上限 64px、阻尼 .5', () => {
    expect(GESTURE.pullRefresh).toEqual({
      axis: 'y', takeoverPx: 0, followRatio: 1,
      min: 0, max: 64, damping: 0.5,
      snapDistancePx: 64, snapVelocity: 0.4,
      tapPx: 0, abandonPx: null,
    });
  });

  it('每個 preset 的阻尼都在規格的 0.3～0.5 之間', () => {
    for (const [name, p] of Object.entries(GESTURE)) {
      expect(p.damping, name).toBeGreaterThanOrEqual(0.3);
      expect(p.damping, name).toBeLessThanOrEqual(0.5);
    }
  });

  it('有界的 preset 才需要阻尼有意義：無界者的 damping 不被使用', () => {
    // 這條是文件性的：min/max 皆為 null 時 damping 永遠走不到，
    // 但仍給值以免日後加界線時忘了設。
    expect(GESTURE.monthSwipe.min).toBeNull();
    expect(GESTURE.monthSwipe.max).toBeNull();
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/gesture.test.ts`
Expected: FAIL —— `Cannot find module './gesture'`

- [ ] **Step 3: 寫 gesture.ts**

```ts
/**
 * HANDOFF.md §10 的手勢門檻，一個 preset 對應一個消費者。
 * 與 src/lib/motion.ts 的 DUR 是同一類東西：規格編號過的數值，集中一處，
 * 元件只寫 useDragGesture(GESTURE.monthSwipe, { ... })，不重抄數字。
 */

export type GesturePreset = {
  /** 主軸；另一軸的位移用來判斷是否放棄 */
  axis: 'x' | 'y';
  /** 超過這個位移才接管手勢並 setPointerCapture；0 = 按下即接管 */
  takeoverPx: number;
  /** 跟手比例，1 = 1:1 */
  followRatio: number;
  /** 允許範圍；null = 該端無界 */
  min: number | null;
  max: number | null;
  /** 超出範圍後的位移倍率（§10 通則：0.3～0.5） */
  damping: number;
  /** 放手位移超過此值即吸附 */
  snapDistancePx: number;
  /** 放手速度超過此值即吸附，px/ms */
  snapVelocity: number;
  /** 位移小於此值視為點擊；0 = 不判定 */
  tapPx: number;
  /** 另一軸位移超出主軸這麼多就放棄手勢；null = 不放棄 */
  abandonPx: number | null;
};

export const GESTURE: Record<
  'calendarHandle' | 'monthSwipe' | 'categoryCard' | 'panelDismiss' | 'pullRefresh',
  GesturePreset
> = {
  /** #13 月曆收起／展開。按下即接管，因為把手本身沒有其他可點目標 */
  calendarHandle: {
    axis: 'y', takeoverPx: 0, followRatio: 1,
    min: null, max: null, damping: 0.4,
    snapDistancePx: 138, snapVelocity: 0.4,
    tapPx: 6, abandonPx: null,
  },

  /** #7 月曆左右滑換月。10px 門檻是為了不攔掉日期格的點擊（§11-15） */
  monthSwipe: {
    axis: 'x', takeoverPx: 10, followRatio: 0.55,
    min: null, max: null, damping: 0.4,
    snapDistancePx: 56, snapVelocity: 0.35,
    tapPx: 0, abandonPx: 18,
  },

  /** #15 分類卡左滑露出刪除鍵。同樣需要 10px 門檻，否則卡內按鈕收不到 click */
  categoryCard: {
    axis: 'x', takeoverPx: 10, followRatio: 1,
    min: -84, max: 0, damping: 0.3,
    snapDistancePx: 42, snapVelocity: 0.35,
    tapPx: 0, abandonPx: null,
  },

  /** #22 邀請面板／#35 記一筆面板，把手下滑關閉。不往上超過 0 */
  panelDismiss: {
    axis: 'y', takeoverPx: 0, followRatio: 1,
    min: 0, max: null, damping: 0.4,
    snapDistancePx: 110, snapVelocity: 0.4,
    tapPx: 0, abandonPx: null,
  },

  /** #27 下拉重整。上限 64px，全程阻尼 .5 */
  pullRefresh: {
    axis: 'y', takeoverPx: 0, followRatio: 1,
    min: 0, max: 64, damping: 0.5,
    snapDistancePx: 64, snapVelocity: 0.4,
    tapPx: 0, abandonPx: null,
  },
};
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/gesture.test.ts`
Expected: PASS（7 條）

- [ ] **Step 5: Commit**

```bash
git add src/lib/gesture.ts src/lib/gesture.test.ts
git commit -m "feat(gesture): add threshold presets for the four drag interactions"
```

---

### Task 2: 手勢決策的純函式

**Files:**
- Create: `src/lib/gestureMath.ts`
- Test: `src/lib/gestureMath.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `GesturePreset`
- Produces:
  ```ts
  export type Sample = { pos: number; t: number };
  export function shouldTakeOver(dMain: number, dCross: number, p: GesturePreset): boolean;
  export function shouldAbandon(dMain: number, dCross: number, p: GesturePreset): boolean;
  export function applyBounds(raw: number, p: GesturePreset): number;
  export function velocityOf(samples: readonly Sample[], windowMs?: number): number;
  export type SnapDecision = { kind: 'tap' } | { kind: 'snap'; direction: -1 | 1 } | { kind: 'return' };
  export function decideSnap(offset: number, velocity: number, p: GesturePreset): SnapDecision;
  ```

**這一層存在的理由：** 這五個函式是手勢裡唯一有分支邏輯的地方，也是唯一會寫錯數值的地方。抽出來之後可以用 Vitest 密集測邊界，而 hook 只剩「把事件餵進來、把結果送出去」。

- [ ] **Step 1: 寫失敗的測試**

`src/lib/gestureMath.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { GESTURE } from './gesture';
import {
  shouldTakeOver, shouldAbandon, applyBounds, velocityOf, decideSnap,
} from './gestureMath';

describe('shouldTakeOver（§11-15：門檻之前不可攔掉點擊）', () => {
  it('未達門檻不接管', () => {
    expect(shouldTakeOver(9, 0, GESTURE.monthSwipe)).toBe(false);
  });

  it('剛好等於門檻不接管，超過才接管', () => {
    expect(shouldTakeOver(10, 0, GESTURE.monthSwipe)).toBe(false);
    expect(shouldTakeOver(11, 0, GESTURE.monthSwipe)).toBe(true);
  });

  it('負向位移一樣算距離', () => {
    expect(shouldTakeOver(-11, 0, GESTURE.monthSwipe)).toBe(true);
  });

  it('takeoverPx 為 0 時任何位移都接管', () => {
    expect(shouldTakeOver(1, 0, GESTURE.calendarHandle)).toBe(true);
    expect(shouldTakeOver(0, 0, GESTURE.calendarHandle)).toBe(false);
  });
});

describe('shouldAbandon（§10 #7：垂直超出水平 18px 就放棄）', () => {
  it('另一軸超出主軸未達 18px 不放棄', () => {
    expect(shouldAbandon(10, 27, GESTURE.monthSwipe)).toBe(false);
  });

  it('超出 18px 才放棄', () => {
    expect(shouldAbandon(10, 28, GESTURE.monthSwipe)).toBe(false);
    expect(shouldAbandon(10, 29, GESTURE.monthSwipe)).toBe(true);
  });

  it('abandonPx 為 null 的 preset 永不放棄', () => {
    expect(shouldAbandon(0, 500, GESTURE.categoryCard)).toBe(false);
  });
});

describe('applyBounds（§10 通則：超界要有阻尼，不可硬止）', () => {
  it('範圍內原樣回傳', () => {
    expect(applyBounds(-40, GESTURE.categoryCard)).toBe(-40);
    expect(applyBounds(0, GESTURE.categoryCard)).toBe(0);
    expect(applyBounds(-84, GESTURE.categoryCard)).toBe(-84);
  });

  it('超出下界的部分乘上阻尼', () => {
    // -84 是界，再過 20px：-84 + (-20 × 0.3) = -90
    expect(applyBounds(-104, GESTURE.categoryCard)).toBeCloseTo(-90, 5);
  });

  it('超出上界的部分乘上阻尼', () => {
    // 0 是界，再過 20px：0 + (20 × 0.3) = 6
    expect(applyBounds(20, GESTURE.categoryCard)).toBeCloseTo(6, 5);
  });

  it('無界的 preset 原樣回傳', () => {
    expect(applyBounds(9999, GESTURE.monthSwipe)).toBe(9999);
    expect(applyBounds(-9999, GESTURE.monthSwipe)).toBe(-9999);
  });

  it('只有一端有界時，另一端不受限', () => {
    // panelDismiss：min 0、max null
    expect(applyBounds(500, GESTURE.panelDismiss)).toBe(500);
    expect(applyBounds(-20, GESTURE.panelDismiss)).toBeCloseTo(-8, 5); // 0 + (-20 × 0.4)
  });
});

describe('velocityOf', () => {
  it('等速取樣得到正確的 px/ms', () => {
    const s = [{ pos: 0, t: 0 }, { pos: 50, t: 100 }];
    expect(velocityOf(s)).toBeCloseTo(0.5, 5);
  });

  it('負向速度', () => {
    expect(velocityOf([{ pos: 0, t: 0 }, { pos: -30, t: 100 }])).toBeCloseTo(-0.3, 5);
  });

  it('只取最近的時間窗，忽略更早的取樣', () => {
    // 窗 100ms：前 200ms 幾乎沒動，最後 100ms 快速移動
    const s = [
      { pos: 0, t: 0 }, { pos: 1, t: 200 }, { pos: 61, t: 300 },
    ];
    expect(velocityOf(s, 100)).toBeCloseTo(0.6, 5);
  });

  it('取樣不足或時間差為零時回 0，不可得到 Infinity', () => {
    expect(velocityOf([])).toBe(0);
    expect(velocityOf([{ pos: 5, t: 10 }])).toBe(0);
    expect(velocityOf([{ pos: 0, t: 5 }, { pos: 50, t: 5 }])).toBe(0);
  });
});

describe('decideSnap（放手判定：位移或速度，任一超過即吸附）', () => {
  const p = GESTURE.monthSwipe;

  it('位移超過門檻即吸附，方向依正負', () => {
    expect(decideSnap(57, 0, p)).toEqual({ kind: 'snap', direction: 1 });
    expect(decideSnap(-57, 0, p)).toEqual({ kind: 'snap', direction: -1 });
  });

  it('位移不足但速度夠也吸附', () => {
    expect(decideSnap(10, 0.36, p)).toEqual({ kind: 'snap', direction: 1 });
    expect(decideSnap(-10, -0.36, p)).toEqual({ kind: 'snap', direction: -1 });
  });

  it('速度方向與位移相反時，以速度方向為準（甩回去）', () => {
    expect(decideSnap(30, -0.4, p)).toEqual({ kind: 'snap', direction: -1 });
  });

  it('兩者都不足則彈回', () => {
    expect(decideSnap(55, 0.34, p)).toEqual({ kind: 'return' });
  });

  it('門檻是嚴格大於，等於不觸發', () => {
    expect(decideSnap(56, 0.35, p)).toEqual({ kind: 'return' });
  });

  it('§10 #13：位移小於 tapPx 視為點擊，優先於其他判定', () => {
    const h = GESTURE.calendarHandle;
    expect(decideSnap(5, 0, h)).toEqual({ kind: 'tap' });
    expect(decideSnap(-5, 0, h)).toEqual({ kind: 'tap' });
    expect(decideSnap(6, 0, h)).toEqual({ kind: 'return' });
  });

  it('點擊判定不因速度而失效：手指抖一下仍是點擊', () => {
    expect(decideSnap(3, 0.9, GESTURE.calendarHandle)).toEqual({ kind: 'tap' });
  });

  it('tapPx 為 0 的 preset 永遠不回 tap', () => {
    expect(decideSnap(0, 0, GESTURE.monthSwipe)).toEqual({ kind: 'return' });
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/gestureMath.test.ts`
Expected: FAIL —— `Cannot find module './gestureMath'`

- [ ] **Step 3: 寫 gestureMath.ts**

```ts
import type { GesturePreset } from './gesture';

export type Sample = { pos: number; t: number };

/**
 * §11-15：門檻之前絕對不可接管手勢，否則日期格與卡內按鈕收不到 click。
 * 嚴格大於，讓「剛好 10px」仍屬於點擊。
 */
export function shouldTakeOver(dMain: number, _dCross: number, p: GesturePreset): boolean {
  return Math.abs(dMain) > p.takeoverPx;
}

/** §10 #7：另一軸超出主軸 abandonPx 就放棄，把捲動還給頁面 */
export function shouldAbandon(dMain: number, dCross: number, p: GesturePreset): boolean {
  if (p.abandonPx === null) return false;
  return Math.abs(dCross) - Math.abs(dMain) > p.abandonPx;
}

/** §10 通則：超出邊界的部分乘上阻尼，不可硬止 */
export function applyBounds(raw: number, p: GesturePreset): number {
  if (p.max !== null && raw > p.max) return p.max + (raw - p.max) * p.damping;
  if (p.min !== null && raw < p.min) return p.min + (raw - p.min) * p.damping;
  return raw;
}

/**
 * 取最近 windowMs 內的取樣算平均速度（px/ms）。
 * 只看時間窗而不是全部取樣，否則手指停頓一秒再快速甩出會被平均掉。
 */
export function velocityOf(samples: readonly Sample[], windowMs = 100): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1]!;
  let first = samples[0]!;
  for (let i = samples.length - 1; i >= 0; i--) {
    const s = samples[i]!;
    if (last.t - s.t > windowMs) break;
    first = s;
  }
  const dt = last.t - first.t;
  if (dt <= 0) return 0;
  return (last.pos - first.pos) / dt;
}

export type SnapDecision =
  | { kind: 'tap' }
  | { kind: 'snap'; direction: -1 | 1 }
  | { kind: 'return' };

/**
 * 放手判定。位移與速度取「或」——任一超過門檻即吸附。
 * 速度方向與位移相反時以速度為準：使用者往回甩就是要取消。
 */
export function decideSnap(
  offset: number, velocity: number, p: GesturePreset
): SnapDecision {
  if (p.tapPx > 0 && Math.abs(offset) < p.tapPx) return { kind: 'tap' };

  const byDistance = Math.abs(offset) > p.snapDistancePx;
  const byVelocity = Math.abs(velocity) > p.snapVelocity;
  if (!byDistance && !byVelocity) return { kind: 'return' };

  const source = byVelocity ? velocity : offset;
  return { kind: 'snap', direction: source > 0 ? 1 : -1 };
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/gestureMath.test.ts`
Expected: PASS

- [ ] **Step 5: 執行全套並 commit**

```bash
npm run test && npm run typecheck
git add src/lib/gestureMath.ts src/lib/gestureMath.test.ts
git commit -m "feat(gesture): add pure decision functions for takeover, damping and snap"
```

---

### Task 3: `useReducedMotion` 反應式 hook

**Files:**
- Create: `src/lib/useReducedMotion.ts`
- Test: `src/lib/useReducedMotion.test.tsx`

**Interfaces:**
- Consumes: Plan 01 的 `prefersReducedMotion()`（`src/lib/motion.ts`）
- Produces: `export function useReducedMotion(): boolean;`

**為什麼需要它：** Plan 01 提供的 `prefersReducedMotion()` 每次呼叫都重新查詢媒體查詢，但**沒有任何東西訂閱變更**。在 render 期間算出時長的元件，不會在使用者中途改系統設定時重新 render。Plan 01 的整支分支 review 點名這件事：那個純函式是正確的原語，需要一層 hook 包起來。

- [ ] **Step 1: 寫失敗的測試**

`src/lib/useReducedMotion.test.tsx`：

```tsx
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useReducedMotion } from './useReducedMotion';

function Probe() {
  return <span data-testid="v">{String(useReducedMotion())}</span>;
}

/** 可觸發變更的 matchMedia 替身 */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  let matches = initial;
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return matches && query.includes('reduce'); },
    media: query,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => { listeners.add(cb); },
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => { listeners.delete(cb); },
  }));
  return {
    change(next: boolean) {
      matches = next;
      for (const cb of listeners) cb({ matches: next } as MediaQueryListEvent);
    },
    get listenerCount() { return listeners.size; },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('useReducedMotion', () => {
  it('反映初始值', () => {
    stubMatchMedia(true);
    render(<Probe />);
    expect(screen.getByTestId('v').textContent).toBe('true');
  });

  it('使用者中途改系統設定時會重新 render', () => {
    const mm = stubMatchMedia(false);
    render(<Probe />);
    expect(screen.getByTestId('v').textContent).toBe('false');

    act(() => { mm.change(true); });
    expect(screen.getByTestId('v').textContent).toBe('true');
  });

  it('卸載時解除訂閱，不留下監聽器', () => {
    const mm = stubMatchMedia(false);
    const { unmount } = render(<Probe />);
    expect(mm.listenerCount).toBe(1);
    unmount();
    expect(mm.listenerCount).toBe(0);
  });

  it('沒有 matchMedia 的環境回 false 而不是拋錯', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<Probe />);
    expect(screen.getByTestId('v').textContent).toBe('false');
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/lib/useReducedMotion.test.tsx`
Expected: FAIL —— `Cannot find module './useReducedMotion'`

- [ ] **Step 3: 寫 useReducedMotion.ts**

```ts
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {};
  const mql = matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  if (typeof matchMedia !== 'function') return false;
  return matchMedia(QUERY).matches;
}

/**
 * §10 通則的反應式版本。
 * motion.ts 的 prefersReducedMotion() 每次呼叫都重查，但沒有人訂閱變更——
 * 在 render 期間算時長的元件不會在使用者中途改設定時重新 render。這層補上訂閱。
 * 伺服器端沒有 matchMedia，getServerSnapshot 一律回 false。
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
```

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/lib/useReducedMotion.test.tsx`
Expected: PASS（4 條）

- [ ] **Step 5: Commit**

```bash
git add src/lib/useReducedMotion.ts src/lib/useReducedMotion.test.tsx
git commit -m "feat(motion): add reactive useReducedMotion hook"
```

---

### Task 4: `useDragGesture` hook 與真實瀏覽器測試

**Files:**
- Create: `src/lib/useDragGesture.ts`
- Create: `src/debug/GestureHarness.tsx`
- Modify: `src/debug/DebugGallery.tsx`（加一個 `gesture` 條目）
- Test: `e2e/gesture.spec.ts`

**Interfaces:**
- Consumes: Task 1 的 `GESTURE`／`GesturePreset`、Task 2 的全部純函式、Task 3 的 `useReducedMotion`
- Produces:
  ```ts
  export type DragCallbacks = {
    /** 拖曳中每次移動；offset 已套過 followRatio 與 applyBounds */
    onMove(offset: number): void;
    /** 放手且判定為吸附 */
    onSnap(direction: -1 | 1): void;
    /** 放手且判定為彈回 */
    onReturn(): void;
    /** 放手且位移小於 tapPx（僅 tapPx > 0 的 preset 會呼叫） */
    onTap?(): void;
  };
  export type DragHandlers = {
    onPointerDown(e: React.PointerEvent): void;
    onPointerMove(e: React.PointerEvent): void;
    onPointerUp(e: React.PointerEvent): void;
    onPointerCancel(e: React.PointerEvent): void;
  };
  export function useDragGesture(
    preset: GesturePreset, cb: DragCallbacks
  ): { handlers: DragHandlers; dragging: boolean; touchAction: 'none' | 'pan-y' };
  ```

`touchAction` 由 preset 的軸決定（`y` → `'none'`、`x` → `'pan-y'`，§10 通則），元件直接套到樣式上，不必各自記。

**為什麼用 Playwright 而不是 jsdom：** jsdom 沒有真正的 `setPointerCapture`，`PointerEvent` 是模擬的，也沒有版面。手勢的三個關鍵性質——接管門檻真的擋住 click、拖曳中真的沒有 transition、放手真的吸附——只有在真實瀏覽器裡驅動真實 pointer 事件才驗得到。

- [ ] **Step 1: 寫 harness**

`src/debug/GestureHarness.tsx`：

```tsx
import { useState } from 'react';
import { GESTURE } from '../lib/gesture';
import { useDragGesture } from '../lib/useDragGesture';

/** 每個 preset 一個可拖曳方塊，外加一顆按鈕用來驗證門檻沒有攔掉 click */
export function GestureHarness() {
  return (
    <div style={{ padding: 16, display: 'grid', gap: 24 }}>
      <Box name="monthSwipe" preset={GESTURE.monthSwipe} />
      <Box name="categoryCard" preset={GESTURE.categoryCard} />
      <Box name="calendarHandle" preset={GESTURE.calendarHandle} />
      <Box name="panelDismiss" preset={GESTURE.panelDismiss} />
    </div>
  );
}

function Box({ name, preset }: { name: string; preset: typeof GESTURE.monthSwipe }) {
  const [offset, setOffset] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((l) => [...l, s]);

  const { handlers, dragging, touchAction } = useDragGesture(preset, {
    onMove: setOffset,
    onSnap: (d) => { setOffset(0); push(`snap:${d}`); },
    onReturn: () => { setOffset(0); push('return'); },
    onTap: () => push('tap'),
  });

  const axis = preset.axis === 'x' ? 'X' : 'Y';

  return (
    <div>
      <div
        data-testid={`drag-${name}`}
        data-dragging={dragging ? '1' : '0'}
        {...handlers}
        style={{
          width: 200, height: 80, background: 'var(--c-tint)',
          borderRadius: 'var(--r-md)', touchAction,
          transform: `translate3d(${axis === 'X' ? offset : 0}px, ${axis === 'Y' ? offset : 0}px, 0)`,
          willChange: 'transform',
          transition: dragging ? 'none' : `transform 300ms var(--ease-move)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <button
          data-testid={`btn-${name}`}
          onClick={() => push('click')}
          style={{ minWidth: 44, minHeight: 44 }}
        >
          按鈕
        </button>
      </div>
      <output data-testid={`log-${name}`}>{log.join(',')}</output>
    </div>
  );
}
```

在 `src/debug/DebugGallery.tsx` 既有的 key→節點對照表加一筆 `gesture: <GestureHarness />`，其餘不動。

- [ ] **Step 2: 寫失敗的 e2e 測試**

`e2e/gesture.spec.ts`：

```ts
import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * 從計算後的 transform 取出位移。
 * translate3d 搭配 will-change: transform 時，Chrome 可能回報 matrix3d 而不是 matrix，
 * 兩種都要吃 —— 只認 matrix 的正規式會 match 失敗然後 null 解參考。
 *   matrix(a, b, c, d, tx, ty)
 *   matrix3d(...12 個值..., tx, ty, tz, 1)
 */
async function translationOf(el: Locator): Promise<{ x: number; y: number }> {
  return el.evaluate((n) => {
    const t = getComputedStyle(n).transform;
    if (t === 'none') return { x: 0, y: 0 };
    const v = t.slice(t.indexOf('(') + 1, -1).split(',').map((s) => Number(s.trim()));
    return t.startsWith('matrix3d')
      ? { x: v[12]!, y: v[13]! }
      : { x: v[4]!, y: v[5]! };
  });
}

/** 用真實 pointer 事件拖曳，分段移動讓 pointermove 真的觸發 */
async function drag(
  page: Page, testId: string, dx: number, dy: number, steps = 12
) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(50);
}

test.beforeEach(async ({ page }) => { await page.goto('/?debug=gesture'); });

test('§11-15：未超過 10px 門檻時，卡內按鈕仍收得到 click', async ({ page }) => {
  const btn = page.getByTestId('btn-categoryCard');
  const box = (await btn.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2);
  await page.mouse.up();
  await expect(page.getByTestId('log-categoryCard')).toHaveText(/click/);
});

test('超過門檻後接管，click 不再觸發', async ({ page }) => {
  await drag(page, 'btn-categoryCard', -60, 0);
  const log = await page.getByTestId('log-categoryCard').textContent();
  expect(log).not.toContain('click');
  expect(log).toContain('snap:-1');
});

test('§10 #7：跟手比例 ×0.55，且拖曳中沒有 transition', async ({ page }) => {
  const el = page.getByTestId('drag-monthSwipe');
  const box = (await el.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(x - i * 8, y); await page.waitForTimeout(8); }

  const mid = await el.evaluate((n) => ({
    transition: getComputedStyle(n).transitionProperty,
    dragging: n.getAttribute('data-dragging'),
  }));
  const { x } = await translationOf(el);
  await page.mouse.up();

  expect(mid.dragging).toBe('1');
  expect(mid.transition).toBe('none');   // 拖曳中必須關掉 transition
  expect(x).toBeCloseTo(-44, 0);          // 拖 80px × 0.55 = 44px
});

test('§10 #15：超出 -84px 界線後套阻尼，不是硬止', async ({ page }) => {
  const el = page.getByTestId('drag-categoryCard');
  const box = (await el.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) { await page.mouse.move(x - i * 8, y); await page.waitForTimeout(8); }
  const { x: tx } = await translationOf(el);
  await page.mouse.up();

  // 拖 128px：界 -84，超出 44px × 0.3 → -97.2
  expect(tx).toBeLessThan(-84);          // 有越界，不是硬止在 -84
  expect(tx).toBeCloseTo(-97.2, 0);
});

test('§10 #13：位移 <6px 判為點擊而非拖曳', async ({ page }) => {
  await drag(page, 'drag-calendarHandle', 0, 4, 3);
  await expect(page.getByTestId('log-calendarHandle')).toHaveText(/tap/);
});

test('§10 #13：位移 >138px 吸附', async ({ page }) => {
  await drag(page, 'drag-calendarHandle', 0, -160);
  await expect(page.getByTestId('log-calendarHandle')).toHaveText(/snap:-1/);
});

test('§10 #22/#35：面板不往上超過 0', async ({ page }) => {
  const el = page.getByTestId('drag-panelDismiss');
  const box = (await el.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(x, y - i * 8); await page.waitForTimeout(8); }
  const { y: ty } = await translationOf(el);
  await page.mouse.up();
  // 往上 80px：界 0，超出 -80 × 0.4 = -32（有阻尼但不硬止）
  expect(ty).toBeCloseTo(-32, 0);
});

test('touch-action 依軸設定（§10 通則）', async ({ page }) => {
  const y = await page.getByTestId('drag-calendarHandle')
    .evaluate((n) => getComputedStyle(n).touchAction);
  const x = await page.getByTestId('drag-monthSwipe')
    .evaluate((n) => getComputedStyle(n).touchAction);
  expect(y).toBe('none');
  expect(x).toBe('pan-y');
});
```

Run: `npm run e2e -- --project=ip13 e2e/gesture.spec.ts`
Expected: FAIL —— `?debug=gesture` 尚無對應節點，`useDragGesture` 也不存在

- [ ] **Step 3: 寫 useDragGesture.ts**

```ts
import { useRef, useState, useCallback } from 'react';
import type React from 'react';
import type { GesturePreset } from './gesture';
import {
  shouldTakeOver, shouldAbandon, applyBounds, velocityOf, decideSnap,
  type Sample,
} from './gestureMath';
import { useReducedMotion } from './useReducedMotion';

export type DragCallbacks = {
  onMove(offset: number): void;
  onSnap(direction: -1 | 1): void;
  onReturn(): void;
  onTap?(): void;
};

export type DragHandlers = {
  onPointerDown(e: React.PointerEvent): void;
  onPointerMove(e: React.PointerEvent): void;
  onPointerUp(e: React.PointerEvent): void;
  onPointerCancel(e: React.PointerEvent): void;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  taken: boolean;
  abandoned: boolean;
  samples: Sample[];
};

export function useDragGesture(
  preset: GesturePreset, cb: DragCallbacks
): { handlers: DragHandlers; dragging: boolean; touchAction: 'none' | 'pan-y' } {
  const st = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();

  const mainOf = (e: React.PointerEvent, s: DragState) =>
    preset.axis === 'x' ? e.clientX - s.startX : e.clientY - s.startY;
  const crossOf = (e: React.PointerEvent, s: DragState) =>
    preset.axis === 'x' ? e.clientY - s.startY : e.clientX - s.startX;

  const finish = useCallback((s: DragState) => {
    st.current = null;
    setDragging(false);
    return s;
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    st.current = {
      pointerId: e.pointerId,
      startX: e.clientX, startY: e.clientY,
      taken: false, abandoned: false,
      samples: [{ pos: 0, t: e.timeStamp }],
    };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const s = st.current;
    if (!s || s.pointerId !== e.pointerId || s.abandoned) return;

    const main = mainOf(e, s);
    const cross = crossOf(e, s);

    if (!s.taken) {
      if (shouldAbandon(main, cross, preset)) { s.abandoned = true; return; }
      if (!shouldTakeOver(main, cross, preset)) return;
      // §11-15：接管之後才捕捉指標。提早捕捉會讓底下的可點元素完全收不到 click。
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      s.taken = true;
      setDragging(true);
    }

    s.samples.push({ pos: main, t: e.timeStamp });
    if (s.samples.length > 24) s.samples.shift();

    cb.onMove(applyBounds(main * preset.followRatio, preset));
  }, [preset, cb]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    const s = st.current;
    if (!s || s.pointerId !== e.pointerId) return;

    const main = mainOf(e, s);
    const taken = s.taken;
    if (taken && (e.currentTarget as Element).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    }
    // reduced-motion 時速度不參與判定：使用者要的是直接到位，不是慣性
    const v = reduced ? 0 : velocityOf(s.samples);
    finish(s);

    if (!taken && preset.tapPx === 0) return;   // 沒接管也沒有點擊語意，交給原生 click

    const d = decideSnap(applyBounds(main * preset.followRatio, preset), v, preset);
    if (d.kind === 'tap') cb.onTap?.();
    else if (d.kind === 'snap') cb.onSnap(d.direction);
    else cb.onReturn();
  }, [preset, cb, reduced, finish]);

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    const s = st.current;
    if (!s || s.pointerId !== e.pointerId) return;
    finish(s);
    cb.onReturn();
  }, [cb, finish]);

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    dragging,
    // §10 通則：垂直拖曳吃掉所有原生手勢，水平拖曳保留垂直捲動
    touchAction: preset.axis === 'y' ? 'none' : 'pan-y',
  };
}
```

- [ ] **Step 4: 執行 e2e 確認通過**

Run: `npm run e2e -- --project=ip13 e2e/gesture.spec.ts`
Expected: PASS（8 條）

- [ ] **Step 5: 全套測試**

```bash
npm run test && npm run typecheck && npm run e2e
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/useDragGesture.ts src/debug/GestureHarness.tsx src/debug/DebugGallery.tsx e2e/gesture.spec.ts
git commit -m "feat(gesture): add useDragGesture hook with real-browser coverage"
```

---

### Task 5: `docs/MOTION.md` 驗收清單

**Files:**
- Create: `docs/MOTION.md`
- Test: `src/lib/motionCoverage.test.ts`

**Interfaces:**
- Consumes: Plan 01 的 `DUR`／`EASE`、Task 1 的 `GESTURE`
- Produces: 一份 37 條的表，每條有編號、觸發、規格摘要、常數來源、負責的計畫、狀態欄

**為什麼要一份文件加一個測試：** §10 是驗收依據，交付時要「逐條確認」。散在七份計畫裡的動畫沒有單一清單可對，而清單若沒有測試綁著就會和程式碼脫節。這個測試不驗動畫本身——它驗**文件裡提到的每個常數都真的存在於程式碼**，讓清單不會指向已被改名或刪除的東西。

- [ ] **Step 1: 寫 MOTION.md**

`docs/MOTION.md`。**全 37 條的內容如下，逐字寫入** —— 互動名稱取自 `HANDOFF.md` §10，
常數欄是本計畫新產生的對照（實作者無法從規格推導，故在此給定）：

```markdown
# MOTION 驗收清單（37 條）

來源：`HANDOFF.md` §10 的 38 條，扣除 `docs/HANDOFF-AMENDMENTS.md` §A 刪除的 #20。
增補檔 §B-1（分類頁收支分段）與 §B-3（記一筆分類區收合）沿用 #32 與 #38 的規格，
不另編號。原型畫布上那塊 MOTION 面板是舊版廢稿，一律以本表為準。

狀態：`未開始` / `已實作` / `已驗收`

| # | 互動 | 常數來源 | 計畫 | 狀態 |
| --- | --- | --- | --- | --- |
| 1 | 記一筆面板進場 | `DUR.sheetIn` `DUR.scrimSheetIn` `EASE.sheet` | 05 | 未開始 |
| 2 | 記一筆面板離場 | `DUR.sheetOut` `DUR.scrimSheetOut` `EASE.exit` | 05 | 未開始 |
| 3 | 數字鍵按壓回饋 | `DUR.keyPress` `EASE.move` | 05 | 未開始 |
| 4 | 儲存後新紀錄落定 | `DUR.sheetOut` `DUR.riseIn` `DUR.calCellPop` `EASE.enter` | 05 | 未開始 |
| 5 | 明細依序浮現 | `DUR.riseIn` `DUR.riseStagger` `EASE.enter` | 04 | 未開始 |
| 6 | 月曆選中框滑動 | `DUR.calSnap` `EASE.move` | 04 | 未開始 |
| 7 | 月份切換（按鈕或左右滑） | `DUR.slide` `DUR.slideBack` `EASE.move` `GESTURE.monthSwipe` | 04 | 未開始 |
| 8 | 分頁切換—頁面 | `DUR.slide` `EASE.move` | 04 | 未開始 |
| 9 | 分頁切換—滑塊 | `DUR.slide` `EASE.move` | 04 | 未開始 |
| 10 | 分頁切換—饅頭 | `DUR.slide` `EASE.enter` | 04 | 未開始 |
| 11 | 週／月／年切換 | `DUR.slide` `DUR.countUp` `DUR.trendDraw` | 06 | 未開始 |
| 12 | 預算條填充 | `DUR.budgetFill` `DUR.budgetStagger` `DUR.budgetFlash` | 06 | 未開始 |
| 13 | 月曆收起／展開 | `DUR.calSnap` `GESTURE.calendarHandle` | 04 | 未開始 |
| 14 | 分類子頁進場 | `DUR.slide` `EASE.move` | 07 | 未開始 |
| 15 | 分類卡左滑刪除 | `DUR.cardSnap` `EASE.move` `GESTURE.categoryCard` | 07 | 未開始 |
| 16 | 刪除確認彈窗 | `DUR.dialogIn` `DUR.scrimIn` `DUR.rowCollapse` `EASE.enter` | 07 | 未開始 |
| 17 | 新增分類 | `DUR.riseIn` `EASE.enter` | 07 | 未開始 |
| 18 | 圖示選擇器展開 | `DUR.popIn` `DUR.outlineFade` `EASE.enter` | 07 | 未開始 |
| 19 | 就地編輯預算／改名 | `DUR.morph` `DUR.morphPop` `EASE.exit` | 07 | 未開始 |
| 21 | 開關切換 | `DUR.toggleKnob` `EASE.enter` | 07 | 未開始 |
| 22 | 邀請面板進場／下滑關閉 | `DUR.sheetIn` `DUR.panelSnap` `GESTURE.panelDismiss` | 09 | 未開始 |
| 23 | 複製成功回饋 | `DUR.copyFeedback` `DUR.copyRevert` | 09 | 未開始 |
| 24 | QR 展開 | `DUR.popIn` `EASE.enter` | 09 | 未開始 |
| 25 | 對方新增的通知 | `DUR.toastIn` `DUR.toastHold` `DUR.toastOut` `DUR.syncPulse` `EASE.exit` | 08 | 未開始 |
| 26 | 同步中狀態 | `DUR.syncSpin` `DUR.syncSettle` | 08 | 未開始 |
| 27 | 下拉重新整理 | `DUR.pullSpin` `DUR.pullSettle` `GESTURE.pullRefresh` | 04 | 未開始 |
| 28 | 懸浮 ＋ 按壓態 | `DUR.fabPress` `DUR.fabRelease` `EASE.exit` | 04 | 未開始 |
| 29 | 底部分頁列毛玻璃 | — | 04 | 未開始 |
| 30 | 饅頭呆滯呼吸 | `DUR.breathe` | 01 | 已實作 |
| 31 | 收支數字 count-up | `DUR.countUp` `DUR.dayTotal` | 04 | 未開始 |
| 32 | 週／月／年滑塊 | `DUR.slide` `EASE.move` | 06 | 未開始 |
| 33 | 年月快速選擇 | `DUR.chevron` `DUR.yearPanelIn` `EASE.enter` | 04 | 未開始 |
| 34 | 選擇面板換年 | `DUR.slide` `EASE.move` | 04 | 未開始 |
| 35 | 記一筆面板下滑關閉 | `DUR.panelSnap` `EASE.move` `GESTURE.panelDismiss` | 05 | 未開始 |
| 36 | 支出／收入切換滑塊 | `DUR.slide` `DUR.kindColor` `EASE.move` | 05 | 未開始 |
| 37 | 刪除紀錄確認窗 | `DUR.dialogIn` `DUR.scrimIn` `DUR.rowCollapse` `EASE.enter` | 05 | 未開始 |
| 38 | 記一筆日期選擇器 | `DUR.chevron` `DUR.popIn` `DUR.outlineFade` `EASE.enter` | 05 | 未開始 |
```

注意 #29 沒有時長（毛玻璃是常態樣式不是動畫），常數欄寫 `—`；#30 由 Plan 01 完成，狀態已是 `已實作`。

- [ ] **Step 2: 寫失敗的測試**

`src/lib/motionCoverage.test.ts`：

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DUR, EASE } from './motion';
import { GESTURE } from './gesture';

const doc = readFileSync('docs/MOTION.md', 'utf8');
const rows = doc.split('\n').filter((l) => /^\| \d+ \|/.test(l));

describe('MOTION.md 與程式碼同步', () => {
  it('剛好 37 條', () => {
    expect(rows).toHaveLength(37);
  });

  it('編號不重複', () => {
    const ids = rows.map((r) => Number(r.split('|')[1]!.trim()));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('§A 已刪除的 #20 不在表內', () => {
    const ids = rows.map((r) => Number(r.split('|')[1]!.trim()));
    expect(ids).not.toContain(20);
  });

  it('每一個提到的 DUR / EASE / GESTURE 識別字都真的存在', () => {
    const missing: string[] = [];
    for (const m of doc.matchAll(/`(DUR|EASE|GESTURE)\.(\w+)`/g)) {
      const [, table, key] = m as unknown as [string, string, string];
      const src = table === 'DUR' ? DUR : table === 'EASE' ? EASE : GESTURE;
      if (!(key in src)) missing.push(`${table}.${key}`);
    }
    expect(missing).toEqual([]);
  });

  it('每一列都指派了負責的計畫', () => {
    for (const r of rows) {
      const plan = r.split('|')[4]!.trim();
      expect(plan, r).toMatch(/^0[1-9]$/);
    }
  });
});
```

- [ ] **Step 3: 執行測試**

Run: `npx vitest run src/lib/motionCoverage.test.ts`
Expected: PASS（5 條）。上一步的表已完整給定，所以這裡若失敗，代表抄寫時漏行、
編號重複，或某個 `DUR.*` / `EASE.*` / `GESTURE.*` 識別字打錯 —— 對照錯誤訊息修正抄寫，
不要改測試。

- [ ] **Step 4: 全套並 commit**

```bash
npm run test && npm run typecheck
git add docs/MOTION.md src/lib/motionCoverage.test.ts
git commit -m "docs: add the 37-item MOTION acceptance checklist, tied to the constants"
```

---

## 驗收（Plan 03 結束時回報）

| 項目 | 來源 | 如何驗 |
| --- | --- | --- |
| 四個消費者的門檻逐條正確 | §10 #7 #13 #15 #22/#35 | `src/lib/gesture.test.ts` |
| 10px 門檻之前不攔截 click | §11-15 | `e2e/gesture.spec.ts` |
| 跟手 ×0.55、拖曳中無 transition | §10 #7 | `e2e/gesture.spec.ts` |
| 超界阻尼而非硬止 | §10 通則、#15 | `e2e/gesture.spec.ts` |
| `<6px` 視為點擊 | §10 #13 | `e2e/gesture.spec.ts` |
| `touch-action` 依軸設定 | §10 通則、§12.3 | `e2e/gesture.spec.ts` |
| reduced-motion 可反應中途變更 | §10 通則 | `src/lib/useReducedMotion.test.tsx` |
| 37 條清單與常數同步 | §10、增補檔 §E-3 | `src/lib/motionCoverage.test.ts` |

**需人工確認（C 類）：** 真機上的手感——跟手有無延遲、阻尼是否自然、吸附門檻會不會誤觸（§15.3-33、34、35）。這三條在模擬器與桌機瀏覽器都不準。

**下一份：** `2026-09-07-04-daily-screen.md`
