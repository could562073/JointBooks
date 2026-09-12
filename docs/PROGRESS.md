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
| 03 | 手勢引擎與動畫基礎層 | ✅ 已合併 main |
| 04 | 日常頁 | ✅ 已合併 main |
| **05** | **記一筆／編輯面板** | **🔨 §5 全數完成（分支 `feat/05-entry-sheet`）** |
| 06 | 統計頁 | 未寫計畫 |
| 07 | 配置頁＋分類子頁 | 未寫計畫 |
| 08 | Google OAuth ＋ Sheets 同步 | 未寫計畫 |
| 09 | 邀請流程＋驗收套件 | 未寫計畫 |

目前測試：**Vitest 514、Playwright 56（ip13）**，typecheck 兩個 project 都乾淨，`npm run build` 通過。

### Plan 03 已完成

| | 任務 | 狀態 |
| --- | --- | --- |
| T1 | 手勢門檻常數 `GESTURE` | ✅ 完成（1 輪修正） |
| T2 | 決策純函式 `gestureMath` | ✅ 完成（零 issue） |
| T3 | `useReducedMotion` | ✅ 完成（零 issue） |
| T4 | `useDragGesture` ＋ 真實瀏覽器測試 | ✅ 完成；殘餘 flake 已找到根因並修掉（見下方陷阱節） |
| T5 | `docs/MOTION.md` 37 條清單 | ✅ 完成 |

T4 的 scoped re-review 與整支分支 review **沒有跑**，因為擁有者在此時把工作方式改成
以功能進度為主。記在這裡是為了讓它可見，不是預設它不重要。

### Plan 04 已完成（2026-09-11）

分支 `feat/04-daily-screen`，8 個 commit。`src/screens/daily/` 共 30 個檔案。

| | 區塊 | 狀態 |
| --- | --- | --- |
| 月份導覽 | `MonthNav` + `labels` | ✅ 跨年進退在 store，▾ 轉 180° |
| 年月選擇器 | `MonthPicker` + `picker` | ✅ 四年份 pill、12 月方格、夾到月底 |
| 收支三卡 | `SummaryCards` | ✅ 整月合計 + count-up + 結餘卡饅頭 |
| 月曆 | `MonthCalendar` + `calendarLayout` | ✅ 熱度底色、獨立滑塊、左右滑換月、週起始 |
| 把手 | `CalendarHandle` + `collapse` | ✅ 跟手收合、吸附／彈回／點擊三態 |
| 日期標題 | `DayHeader` | ✅ 當日支出 count-up，零值顯示破折號 |
| 明細 | `TxnList` + `txnRow` | ✅ 依序浮現、空狀態、記帳人頭像開關 |
| 懸浮 ＋ | `Fab` | ✅ 按壓態，只在日常頁 |
| 分頁列 | `components/TabBar` | ✅ 毛玻璃、可位移滑塊、饅頭壓扁 |
| 下拉重整 | `usePullRefresh` + `PullIndicator` | ✅ 有守門，不吃掉原生捲動 |
| 容器 | `DailyScreen` + `App` 外殼 | ✅ 外層不捲動，明細 scroll 不被收合重置 |

MOTION：`docs/MOTION.md` 上屬於 Plan 04 的 14 條全部轉為**已實作**
（5、6、7、8、9、10、13、27、28、29、30、31、33、34）。「已驗收」要等
擁有者跑完 `docs/MANUAL-TESTS.md` 的 D1–D28。

**還沒做的：**
- 明細列點進編輯只是空的 callback，要等 Plan 05 的記一筆面板。
- 統計頁與配置頁是佔位方塊，等 Plan 06／07。
- 下拉重整目前只重讀本機 Dexie；真的同步是 Plan 08。
- 週起始的**設定值**還在 Plan 07（store 無此欄位），domain 與元件都已支援，
  Plan 07 補上 store 欄位傳進 `MonthCalendar` 的 `weekStart` 即可。

### Plan 05 已完成（2026-09-11）

分支 `feat/05-entry-sheet`，5 個 commit。`src/screens/entry/` 共 19 個檔案。

| | 區塊 | 狀態 |
| --- | --- | --- |
| 金額輸入規則 | `amountInput` | ✅ 照原型 reducer，小數兩位／總長 9 字 |
| 面板狀態模型 | `entryDraft` | ✅ 新增／編輯、kind 切換、幣別、canSave |
| 數字鍵盤 | `Keypad` | ✅ 3×4 + 跨四列儲存鍵，按壓回饋 |
| 支出／收入分段 | `KindSegment` | ✅ 獨立滑塊，紫↔粉 |
| 小月曆 | `MiniCalendar` + `datePick` | ✅ 跨年、夾到月底、今天／收起 |
| 收合列 | `FieldRow` | ✅ 日期欄與分類區共用（B-3） |
| 分類選擇 | `CategoryPicker` + `entryCategories` | ✅ 就地新增後立即選中 |
| 刪除確認 | `components/ConfirmDialog` | ✅ 刪紀錄與刪分類（Plan 07）共用 |
| 面板容器 | `EntrySheet` + `useSheetDismiss` | ✅ 進場／離場／把手下滑關閉 |

MOTION：`docs/MOTION.md` 上屬於 Plan 05 的 8 條全部轉為**已實作**
（1、2、3、4、35、36、37、38）。手動驗證見 MANUAL-TESTS 的 E1–E16。

**要擁有者裁示的一點：** §5 寫「新紀錄出現在明細**最前**」，§4 寫明細
「依時間升冪排序」。兩條互斥。目前照 §4 實作（新紀錄 createdAt 最新，
所以落在最後），因為 §4 的規則明確且已有測試。若要改成置頂請告知。

---

## 工作方式（2026-09-09 起，擁有者指示）

- **以功能實作為主**，不要停在基礎建設上打轉。
- **只寫單元測試。** 需要瀏覽器／互動層才驗得到的，**跳過**。
- 跳過的每一條都要寫進 `docs/MANUAL-TESTS.md`，附「怎麼操作」與「該看到什麼」，
  讓擁有者手動驗。不准只寫一句無法執行的空話。

**接手指令**：

```
讀 docs/PROGRESS.md，然後繼續實作 Plan 04 日常頁
```

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
- **`page.goto()` 在 `load` 就 resolve**，不保證 lazy chunk 解析完、也不保證樣式套上了。
  已在 `gesture.spec.ts` 與 `motion-tokens.spec.ts` 加就緒等待（commit 87bce78）。
- **e2e 的隨機失敗已解決，根因不是就緒也不是 worker 數。** 症狀是每次落在不同的 spec
  （motion-tokens、gesture、tokens、pwa 都出現過），約 1/8 輪一次。抓到的錯誤是
  `read ECONNRESET`，trace 顯示那支測試的四個請求共用同一條 keep-alive socket、間隔
  只有 21–77ms、中間沒有任何閒置 —— 不是一般的 keep-alive 逾時。
  用 keep-alive 探針量到：**dev server 的 event loop 每輪都會卡住約 5.5 秒**（延遲
  5594→5413→5227ms 逐次少 ~190ms，是佇列在卡完後一次排空的特徵）。Node 的
  `keepAliveTimeout` 預設正好 5 秒，卡頓一跨過去，一條「客戶端已經把下一個請求寫進去」
  的閒置 socket 就會在 loop 恢復時被銷毀，客戶端收到 ECONNRESET。
  修法是在 `vite.config.ts` 把 dev server 的 `keepAliveTimeout` 提到 30 秒（commit
  cf7fe08）。**這不是調高 timeout 來遮掩** —— 被銷毀的是一條已經收到請求的連線，
  屬於傳輸層競態。卡頓本身是 dev 模式下 567 個字型 subset（18 MB）的服務成本，
  屬於 Plan 08 的 subset 任務。
- **前一版 ledger 裡「釘住 `workers`」的假設是錯的，已實測推翻。** workers 開 9／4／2
  三組，卡頓都是 ~5.5 秒、完全沒有隨 worker 數下降；workers=2 反而有一次卡到 16.6 秒。
  dev server 單獨跑最大延遲 368ms、dev server 加上同時跑完整 build 是 360ms，兩者都不卡。
  **教訓：把假設寫進交接文件時要標明它還沒被驗證**，否則下一手會照著做。

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
