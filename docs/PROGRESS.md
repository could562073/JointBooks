# 進度總覽

**這是唯一的入口文件。** 新 session 從這裡開始，不需要讀對話記錄。

專案：加拿大共用生活記帳 — 繁體中文、手機優先的 PWA，兩人共用一本帳，資料存 Google Sheets。
Repo：`git@github.com:could562073/JointBooks.git`（private）

---

## 現在在哪裡

| 計畫 | 內容 | 狀態 |
| --- | --- | --- |
| 01 | 地基與設計系統 | ✅ 已合併 main |
| 02 | 領域邏輯與本地資料層 | ✅ 已合併 main |
| **03** | **手勢引擎與動畫基礎層** | **🔨 進行中，分支 `feat/03-gesture-motion`** |
| 04 | 日常頁 | 未寫計畫 |
| 05 | 記一筆／編輯面板 | 未寫計畫 |
| 06 | 統計頁 | 未寫計畫 |
| 07 | 配置頁＋分類子頁 | 未寫計畫 |
| 08 | Google OAuth ＋ Sheets 同步 | 未寫計畫 |
| 09 | 邀請流程＋驗收套件 | 未寫計畫 |

目前測試：**Vitest 178、Playwright 56（ip13）**，typecheck 兩個 project 都乾淨。

### Plan 03 的任務進度

| | 任務 | 狀態 |
| --- | --- | --- |
| T1 | 手勢門檻常數 `GESTURE` | ✅ 完成（1 輪修正） |
| T2 | 決策純函式 `gestureMath` | ✅ 完成（零 issue） |
| T3 | `useReducedMotion` | ✅ 完成（零 issue） |
| T4 | `useDragGesture` ＋ 真實瀏覽器測試 | 🔨 實作完成，**fix round 進行中** |
| T5 | `docs/MOTION.md` 37 條清單 | 未開始 |

**接手指令**（在專案目錄開 Claude Code 後貼這句）：

```
繼續跑 Plan 03，照 .superpowers/sdd/2026-09-07-03-gesture-motion/progress.md 接手
```

那份 ledger 有完整的接手指引與 T4 未完成 fix round 的細節。

---

## 文件地圖

| 檔案 | 內容 | 何時看 |
| --- | --- | --- |
| `HANDOFF.md` | 原始規格（664 行），擁有者提供 | 查任何規格細節 |
| `docs/HANDOFF-AMENDMENTS.md` | **規格增補，優先於 HANDOFF.md** | 動手前必讀 |
| `docs/superpowers/plans/README.md` | 九份計畫的總表與依賴關係 | 規劃下一步 |
| `docs/superpowers/plans/2026-09-07-0*.md` | 各計畫的逐步實作指引 | 執行某份計畫時 |
| `docs/plan-0{1,2}-execution-log.md` | 已完成計畫的執行紀錄與裁定 | 想知道「為什麼是這樣」 |
| `.superpowers/sdd/<plan>/progress.md` | 進行中計畫的 live ledger（不進版控） | 接手進行中的計畫 |

**優先序：`docs/HANDOFF-AMENDMENTS.md` > `HANDOFF.md` > 原型 HTML。**
原型只是視覺與動畫的依據；它的數據與邏輯都不可信（擁有者確認過）。

---

## 累積下來的陷阱（最有價值的一節）

這些是踩過才知道的事。不讀這節，下一個 session 會重新踩一次。

### 假綠燈：測試通過但什麼都沒驗到

- **`document.fonts.check(spec)` 不帶文字參數，對 unicode-range 切分的 CJK 字型必然回 `false`** ——
  預設樣本字串落不進任何 subset。要先 `load(spec, text)` 再 `check(spec, text)`。
- **收支之分曾經完全沒被測到** —— 把判斷函式換成永遠回傳 `'expense'`，127 個測試全過。
  原因是聚合函式的 `cats` 參數是選用的，所有測試都沒傳。現在 `cats` 是必要參數。
- **Service worker 偷偷 precache 了 16.3 MiB 字型** —— `includeAssets` 繞過 `globPatterns`，
  而所有測試都跑 dev 模式（那裡的 SW 是沒有 precache manifest 的殘樁）。
  現在有一支 build 模式的測試斷言 precache 條目數上限。
- **Vite dev server 的 SPA fallback 對任何 URL 都回 200** —— 只斷言 status code 的
  圖示存在性測試不可能失敗。要一併斷言 `content-type` 是 `image/*`。
- **測試標題灌水** —— 標題承諾的比 body 斷言的多，讀的人以為那件事被驗過了。出現過兩次。

### 環境

- **`build.assetsInlineLimit` 在 `vitest.config.ts` 裡不是死設定** —— Vitest 走 Vite 的
  transform pipeline，拿掉它 SVG 會被內聯成 data URI，`Icon.test.tsx` 就紅。
  這個鍵被誤判成死設定兩次，檔案裡已加註記。
- **jsdom 沒有真的 `setPointerCapture`、沒有版面、`PointerEvent` 是模擬的** ——
  手勢一定要用 Playwright 在真實瀏覽器測。
- **`crypto.randomUUID` 需要 secure context**，plain-HTTP LAN 會拋錯（已加 fallback）。
- **9 worker 併發下 `page.goto()` 在 `load` 就 resolve**，不保證 lazy chunk 解析完、
  也不保證樣式套上了 —— 這是 T4 目前正在修的 flake 成因。
  **不要用調高 timeout 來壓它**（已因類似問題從 5s 拉到 10s，那是遮掩不是修復）。

### 流程

- **判定 subagent 死掉前一定先 `ListAgents`。** 曾經只看 `git status` 就誤判，
  結果兩個 implementer 同時做同一個任務。
- **不要在 implementer 還活著時寫它的報告檔** —— 它會看到檔案在兩次讀取之間變動。
- **「重跑就過」不是結論。** 出現過三次，每次查下去都不是原本說的原因。

---

## 我判錯後被推翻的裁定

記下來是為了不要再判一次。三次都是別人拿證據推翻我的。

1. **`vitest.config.ts` 的 `build.assetsInlineLimit` 是死設定** — 錯。implementer 拒絕刪除
   並附上失敗的測試。錯誤傳播了三手（review 宣稱 → 我沒驗就記進 ledger → 我把它折成
   刪除指令）才被擋下。
2. **`isIncome` 的字串 fallback 安全** — 錯兩層。那個狀態不可達，而真正可達的路徑
   （使用者自建收入分類）會把收入靜靜算成支出。
3. **`updateTxn` 要無條件重新快照分類名稱** — 修好一個問題、製造另一個。
   查不到 id 時快照被抹成空字串，而增補檔正是把它定位成那種 row 的最後防線。

---

## 延後給後續計畫的事

**Plan 04（日常頁）**
- store 的初始年月日在 module load 時算一次，PWA 跨午夜不會更新。
  正解是綁 `visibilitychange` 的復原動作，屬於畫面層。
- 兩個設定開關的持久化 promise 沒被 await，IndexedDB 寫入失敗會靜靜消失。
- §2 有一批數值還沒 token 化：CTA 漸層、分頁列圓角 22px、FAB 圓角 19px、
  圖示方塊圓角 13/8/14、毛玻璃配方、分頁標籤 10px。也還沒有間距與字級 scale。
- 收窄 Playwright 的全域 `expect.timeout`（目前 10s，應該只給需要的 spec）。

**Plan 06（統計頁）**
- `animation-iteration-count: 1 !important` 在 reduced-motion 下會讓 MOTION #26 的
  同步轉圈凍在半途，看起來像當掉。要特例處理。

**Plan 08（Sheets 同步）**
- `outbox` 只寫不讀。順序、去重、衝突解析的資訊都夠，但**分類的變更完全沒有
  outbox 路徑**，而 `OutboxItem` 目前的形狀（`txnId` + `payload: Txn`）裝不下分類操作。
- §14.5 要求的「txn → 列號索引」還不存在。
- 衝突解析要定義**決定性的平手規則**（例如以裝置 id 字典序），否則兩台裝置各自
  偏好本地會永久分歧。
- 字型 subset：目前 567 個檔案 18 MB。subset 成 App 實際用到的字約 200 KB。

---

## 執行方式

每份計畫都用 superpowers 的 **subagent-driven-development** 流程跑：

```
派 implementer → 產 review package → 派 task reviewer → 有 findings 就 fix round
→ scoped re-review → 記 complete → 全部任務完成後跑整支分支 review → 合併
```

每個 dispatch 都要交代：**所有指令跑前景，不要開背景 job**（曾有 agent 反覆卡在自己開的 monitor 上）。

Reviewer 的 prompt 要明講：**列了 Important 就不准給 Approved**（發生過兩次）。

**鼓勵 implementer 反駁。** 專案至今有三次是 implementer 拿證據推翻我的指令，三次它們都對。
dispatch 裡要寫明這是被期待的行為。
