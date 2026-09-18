# 進度總覽

**這是唯一的入口文件。** 新 session 從這裡開始，不需要讀對話記錄。

專案：加拿大共用生活記帳 — 繁體中文、手機優先的 PWA，兩人共用一本帳，資料存 Google Sheets。
Repo：`git@github.com:could562073/JointBooks.git`（公開）；網站 https://could562073.github.io/JointBooks/

---

## 現在在哪裡

| 計畫 | 內容 | 狀態 |
| --- | --- | --- |
| 01 | 地基與設計系統 | ✅ 已合併 main |
| 02 | 領域邏輯與本地資料層 | ✅ 已合併 main |
| 03 | 手勢引擎與動畫基礎層 | ✅ 已合併 main |
| 04 | 日常頁 | ✅ 已合併 main |
| 05 | 記一筆／編輯面板 | ✅ 已合併 main |
| 06 | 統計頁 | ✅ 已合併 main |
| 07 | 配置頁＋分類子頁 | ✅ 已合併 main |
| 08 | Google OAuth ＋ Sheets 同步 | ✅ 已合併 main |
| 09 | 邀請流程＋§15 驗收套件 | ✅ 已合併 main |

**九份計畫全部完成。** 手動清單在 2026-09-15 改成自動測試（能自動化的寫成測試，做不到的不再列管，
見 `docs/MANUAL-TESTS.md`）；接下來是下方「延後給後續計畫的事」列的技術債。

目前測試：**Vitest 1166（125 檔）、Playwright 131（ip13）／397（三個寬度＋正式建置）**，typecheck 兩個 project 都乾淨，
`npm run build` 通過。Playwright 在推到 main 時由 `.github/workflows/e2e.yml` 自動跑（不擋部署）。

`docs/MOTION.md` 的 **38 條全部已實作**；量得到的（時長、位移方向、跟手、門檻）都有 e2e 驗，
對照表在 `docs/MANUAL-TESTS.md`。

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

### Plan 06 已完成（2026-09-11）

分支 `feat/06-stats-screen`，3 個 commit。`src/screens/stats/` 共 10 個檔案。

| | 區塊 | 狀態 |
| --- | --- | --- |
| 維度分段 | `components/SegmentedControl` | ✅ 與記一筆的支出／收入共用 |
| 結餘總覽卡 | `OverviewCard` + `statsLabels` | ✅ 期間標籤、增減 pill、三個 count-up、比例條 |
| 趨勢折線 | `TrendChart` + `trendGeometry` | ✅ 實線／虛線／面積／末點加大／描線 |
| 預算使用 | `BudgetList` | ✅ 三種狀態、依序填充、超支閃紅 |
| 容器 | `StatsScreen` | ✅ 接上 store，錨點用日常頁選中日 |
| 月結日 | `domain/date` 的 `cycleDay` | ✅ domain 完成，設定值待 Plan 07 |

MOTION：11、12、32 轉為**已實作**。手動驗證見 MANUAL-TESTS 的 S1–S10。

**順手清掉的兩處重複**（見 `852c029`）：
- `domain/money` 早有 `pushDigit`／`toCents`，我在 Plan 05 又寫了一份。
  已合併成一份；行為因此有兩處變動（開頭按 `.` 得到 `0.`、前導零被吃掉），
  比原型好但與原型不同，列此供裁示。
- 分段控制第三次出現，把支出／收入與週／月／年合併成共用元件。

**（更正）週起始與月結日不會有設定。** 增補檔 A 已把這兩列從配置頁移除，
固定為週一／每月 1 日，常數在 `src/domain/constants.ts`。我在 Plan 06 的
進度說明裡寫成「Plan 07 接通」是錯的，當時只讀了 §7.3 沒對增補檔。
domain 的 `weekStart` / `cycleDay` 參數保留為「日後要加回設定時只改一處」的接縫。

### Plan 07 已完成（2026-09-11）

分支 `feat/07-settings`，4 個 commit。`src/screens/settings/` 共 14 個檔案。

| | 區塊 | 狀態 |
| --- | --- | --- |
| 帳本成員 | `SettingsScreen` | ✅ 我／老婆／邀請成員（面板待 Plan 09） |
| 分類摘要列 | `settingsSummary` | ✅ 疊圖示 + 「N 個分類 · 月額度 $X」 |
| 兩個開關 | `components/Toggle` | ✅ MOTION #21，持久化到 meta 表 |
| 分類子頁 | `CategoriesPage` | ✅ MOTION #14 進場、B-1 分段、#17 新增、#16 刪除 |
| 分類卡 | `CategoryCard` + `cardSwipe` | ✅ #15 左滑、#18 圖示、#19 就地編輯、子分類增刪 |
| 列收合 | `lib/useRowRemoval` | ✅ #16／#37 的最後一段，分類卡與明細列共用 |

**MOTION 37 條裡只剩 5 條未實作**，全部屬於 Plan 08／09：
22、23、24（邀請流程）、25、26（同步）。

手動驗證見 MANUAL-TESTS 的 C1–C14。

### Plan 08 已完成（2026-09-12）

分支 `feat/08-sync`，5 個 commit。

| | 區塊 | 狀態 |
| --- | --- | --- |
| PKCE | `auth/pkce` | ✅ 對過 RFC 7636 附錄 B 的向量 |
| Token | `auth/tokens` | ✅ 交換與續期，失敗不標記已登入 |
| Sheets client | `sheets/client` | ✅ create／append／get／update／share |
| 欄位對應 | `sheets/rows` | ✅ 增補檔 C-3 的 A–N；分類另加 J 欄配色 |
| 建表 | `sheets/ledgerSheet` | ✅ 紀錄／配置／年報表／圖表四張 |
| 合併與去重 | `sync/merge` | ✅ updatedAt 較新者勝，平手取遠端 |
| 退避 | `sync/backoff` | ✅ 只重試 429／5xx，指數 + 0–25% jitter |
| 狀態機 | `sync/state` | ✅ offline 優先 |
| 引擎 | `sync/syncEngine` | ✅ 每次拉取重建 id→列號，append／update 分流 |

**金額欄不能用 `formatCents`**：它會加千分位，而 `valueInputOption` 是 RAW，
`1,280.00` 會被 Sheets 存成文字，年報表頁的 SUMIFS 就加不到它。`rows.ts` 另寫
了一組不帶分隔符的 `amount()`／容錯的 `parseAmount()`。

### Plan 09 已完成（2026-09-12）

分支 `feat/09-invite`。

| | 區塊 | 狀態 |
| --- | --- | --- |
| 邀請連結 | `invite/inviteLink` | ✅ 7 天 TTL、簽章、`checkInvite` |
| 剪貼簿與分享 | `invite/clipboard` | ✅ Web Share，取消不算失敗、不支援才退回複製 |
| 邀請面板 | `invite/InvitePanel` | ✅ MOTION #22／#23／#24，QR 依真實連結產生 |
| 四個分支 | `invite/joinFlow` + `JoinPage` | ✅ 未加入／已是成員／過期／無效 |
| 登入頁 | `invite/LoginPage` | ✅ 含未設定 client id 的純本機模式 |
| 路由 | `invite/route` | ✅ app／join／callback 三條，無 router 套件 |
| Session | `auth/session` | ✅ verifier 與 state 存 IndexedDB，access token 只在記憶體 |
| 帳本 id | `sync/ledgerId` | ✅ 存 meta，接受邀請頁靠它判斷「已是成員」 |
| §15 驗收套件 | `src/acceptance/` | ✅ 58 條，對照表在 `src/acceptance/README.md` |

**邀請連結的簽章不是身分驗證。** 沒有後端就沒有只有伺服器知道的密鑰，任何拿到
連結的人都能自己算一個新的 `t`。它擋的是過期與連結被改動；真正擋住亂猜的是
`spreadsheetId` 本身。面板文案照這個事實寫「任何拿到這條連結的人都能加入」。

**沒有帳本時不給連結。** 原先用佔位 sid `'pending'` 產出的連結簽章是**有效的**，
對方點下去會「成功加入」一本不存在的帳——比什麼都不給更糟。改成顯示說明。

**§15 驗收套件的範圍。** §15.1 原訂 Playwright 跑兩個斷點；依擁有者指示改用
Vitest 從 `<App />` 最外層跑功能行為 1–22，版面 23–28 量的是
`getBoundingClientRect()`（jsdom 一律回 0），連同 B 類截圖與 C 類真機手感一起
列進 `docs/MANUAL-TESTS.md`。


### 原型對齊（2026-09-12，Plan 09 之後）

驗收發現實作與原型大量不一致。把原型解包、抽出每個節點的精確行內樣式當規格，
放在 `docs/proto/*.outline.txt`（附截圖），抽取與轉大綱的腳本在 `tools/`。

| 畫面 | 狀態 |
| --- | --- |
| 共用外殼（頭像對、同步藥丸、our book、裝飾圓、統一左右留白） | ✅ |
| 底部分頁列（淡紫滑塊、未選中的灰饅頭、底帶漸層） | ✅ |
| 日常頁 | ✅ |
| 統計頁 | ✅ |
| 配置頁、分類子頁 | ✅ |
| 記一筆面板（分類改回一直展開，見下方裁決 3） | ✅ |
| 登入頁、接受邀請頁 | ✅ |
| 邀請面板（InvitePanel） | ✅（說明卡有幾句刻意不照原型；流程改成先分享再傳連結，見下方） |

另外補上的互動：
- 記一筆的小月曆換月跟日常頁月曆同一套 MOTION #7：按鈕或左右滑，自方向側 ±38px 滑入。
- 日期選擇展開與收起都有高度動畫（`lib/usePresence`：收起時先留著播完才卸載）。
- 原型沒有日期選擇器的展開設計：在原型裡點日期卡不會開任何東西（抽出來的結構與收合狀態完全相同），所以小月曆本身的外觀沒有規格可對，只補了動畫。
- **饅頭照原型重做**（`components/Mantou`，2026-09-13）：五官比例從原型 104、78、58、38、22 各尺寸量出來。腳畫在本體後面、只從底部圓角露出來；嘴是實心下半圓；腮紅是扁橢圓；大顆（≥60px）才有腮紅與底部內陰影。空狀態是灰階、平嘴、有腳。頁籤沒選中的饅頭改成原型的半透明暖灰（`--c-tab-idle-*`），不是空狀態的冷灰。`?debug=mantou` 列出原型出現過的尺寸。
- **分頁切換方向修正**（MOTION #8）：原本每次 render 都拿上一次 render 的分頁比方向，StrictMode 的第二次 render 或換頁後的狀態更新會把方向重算成「自右進」並重播動畫，配置 → 統計因此變成自右進。改用 `components/useTabDirection`，只在真的換頁那次決定方向。
- **捲動條只在捲動時出現**（使用者要求）：原生捲動條全域藏起來（原型也是這樣做）；日常、統計、配置三個分頁的捲動區改用 `components/ScrollThumb`，捲動時淡入、停下 0.7 秒後淡出，不佔寬度，底部讓出分頁列的高度。
- **頂端同步膠囊照原型**：6px 圓點、10.5px 粗體綠字（`SyncStatus tone="pill"`）；配置頁那一列不變。字型只打包 400／500／700，600 會用 700 那一套。
- **日常頁**：「往上滑看更多明細」「這天還沒有紀錄」改粗體（使用者要求）。
- **記一筆**（使用者要求）：數字鍵按下 80ms、放開 120ms 帶回彈（`EASE.spring`）；主分類的紫色外圈是獨立的一塊，換分類時滑過去（`main-ring`），換收支時直接到位；主分類、子分類、幣別的選中色都是舊的淡出、新的淡入；實扣 CAD 卡出現時向下滑開、收起時往上收。
- **統計頁**：週／月／年的滑塊照原型內縮 4px、按鈕間距 4px（原本 `left` 沒扣容器內距，滑塊貼在邊上）；總覽卡標題改成「本週結餘 8/31 ~ 9/6」「本月結餘 9/1 ~ 9/30」「今年結餘 1/1 ~ 12/31」，看的不是目前這一期時寫「當週／當月／當年」；趨勢圖照原型的座標與線條重做（viewBox 320×130、0 在 y=112、上限留一成、格線 14／56／98、白底圓點、圖例色條在前）；預算條改淡色系（分類色用調色盤的 blob，超支 #F2B3A0、將滿 #F6D89A）。
- **配置頁**：從分類子頁返回時配置頁自左側滑回；分類子頁拿掉整頁底色，標題列跟原型一樣透明，裝飾圓透得出來。
- **趨勢圖改成原型的邏輯**（使用者要求）：一期一個點、看最近幾期——週看最近 8 週（W29…W36）、月看最近 6 個月、年看最近 4 年，最後一點就是總覽卡正在看的那一期（`aggregate.trendSeries`、`TREND_PERIODS`）。原本週維度畫的是一週七天、月維度是當月各週、年維度是 12 個月，跟原型不同。最後一點畫一條淡色縱向虛線，軸上標籤加重並多一行「本週／本月／今年」（看的不是目前這一期時寫當週／當月／當年）。已經沒人用的 `trendAxisNote` 一併移除。
- **邀請面板的預覽修好**：預覽鍵用了 Node 才有的 `global.URL`，瀏覽器裡直接丟錯、什麼都沒發生（jsdom 有 `global`，測試沒抓到）。現在帶 `preview=1` 進接受邀請頁：照她會看到的邀請卡畫、頂端標「預覽」、按鈕是「結束預覽」，不做任何加入動作。

**邀請面板的說明卡有幾句刻意不照原型。** 原型寫「過期後可重新產生，舊連結立即失效」（裁決 7：照實際行為寫）、「登入的帳號會被加為這份 Sheet 的編輯者」與「只有你能移除成員」，在這個 App 都不成立：沒有後端，產生新連結不會讓已傳出去的舊連結失效；權限是你在面板上分享給她的帳號，不是她登入時自動加上；App 也沒有移除成員的功能。改寫成事實，說明只有分享過的帳號能用連結加入——`InvitePanel.test` 擋住「舊連結立即失效」與「任何拿到這條連結的人都能加入」被改回去。

**邀請面板改成先分享、再傳連結的單一流程**（擁有者指示，2026-09-13）。接上雲端時，還沒分享給任何帳號前，連結的位置只有虛線佔位；分享成功後輸入欄收成一行「✓ 已分享給…」，邀請連結、複製、訊息傳送、QR 才出現。連結本身不帶權限，先傳連結的話她點開只會看到「還讀不到這本帳」。純本機模式（沒設定 Google）沒有分享這一步，連結直接可用。

**截圖裡的方框字（□）不是字型問題。** 查證過每個字都確實在宣告它的 woff2 的
glyph 表裡。那是 WSL 裡的 headless Chromium 沒有任何中文系統字型，font-display:
swap 在分片載入完成前用的後備字型沒有中文字。真機與桌機瀏覽器不會發生。

**WSL 上 Vite 看不到檔案變動。** 專案放在 `/mnt/c` 時 Windows 檔案系統不送
inotify 事件，dev server 會一直服舊模組；`vite.config.ts` 已在偵測到 WSL 時改用輪詢。

**subagent 改用小任務＋輕量模型。** 三個 Sonnet agent 領大範圍任務時連續撞到額度；
一個 Haiku agent 拿精確數值改登入頁＋接受邀請頁，約 59K tokens 一次完成。

**版面 e2e 暫停中。** `e2e/layout.spec.ts` 的 V1（§15.1-23 命中區 ≥44px）在真實
瀏覽器量到大量違規，已標成 `test.describe.fixme`（跑的時候列為待修，不是假綠燈）。
那批數字是原型對齊之前量的，恢復時要重量；也要先決定用不可見的 `::after` 擴大
命中區，還是改外觀尺寸（會偏離原型）。V2–V9 其實也已寫好，但寫在原型對齊之前、一次都沒跑過，一併標成 fixme；其中 V8 驗「SE 上鍵盤不捲就放得下」，前提已被裁決 3 取代，恢復前要改寫成驗捲動。


### Google 登入與雲端同步（2026-09-12）

**先前的登入從來沒有能動過。** 拿實際的用戶端 ID 對 Google token 端點測試（假授權碼、假續期 token，不碰任何帳號資料），交換授權碼與續期都回 `400 client_secret is missing`。改走瀏覽器端的 token model（見裁決 4），舊的 `auth/pkce.ts`、`tokens.ts`、`session.ts` 與 `/auth/callback` 路由已移除。

現在接起來的流程：
- **首次登入**（你）：彈出 Google 視窗 → 沒有帳本才在雲端硬碟建一本並記下（`sync/cloud.ts` 的 `ensureLedger`）。
- **邀請**：配置頁 → 邀請成員 → 輸入她的 Google 帳號 →「分享帳本」→ 再傳連結。
- **加入**（她）：連線 Google → 確認讀得到那本帳 → 用你的分類取代她的預設分類 → 記下帳本（`sync/joinLedger.ts`）。讀不到就停在接受邀請頁說明原因。
- **iPhone**：加到主畫面的 App 與 Safari 不共用儲存空間，所以登入頁有「我收到了邀請連結」可以貼上。
- **成員名稱與饅頭顏色**（使用者要求，2026-09-13）：稱謂不寫死「我／老婆」，兩位都能在配置頁改名稱（預設「我」「雪雪大人」）與饅頭顏色（六色）。存本機並標記待推（`sync/members.ts`），同步控制器同一輪推到 `配置!N1:P3` 並改版本戳記；對方看到戳記變了就拉回來。本機有沒推的修改時不拿雲端的蓋過（最後寫入的贏）。資料裡的 by 仍是「我」＝建立帳本的人、「妻」＝加入的人，名稱只是顯示。
- **誰記的跟著使用者**：這台裝置是誰記在 meta 的 `selfPerson`——建立帳本的是「我」，邀請連結加入成功時寫成「妻」。記一筆面板不再有切換鈕，新的一筆一律記成這台裝置的人，顯示他的饅頭與名稱；編輯舊帳保留原本記帳的人。
- **換手機接回自己的帳本**（裁決 8）：本機沒有帳本 id 時，按建立後先用 Drive `files.list` 找這個 App 之前在自己雲端硬碟建的同名帳本（`drive.file` 看得到自己用這個 App 建的檔案，不用加權限），找到就接回並換成那本的分類，找不到才建新的。別人分享過來的不自動加入——使用者選的是建立自己的帳本。
- **改加入別人的帳本**：這台原本有帳本、又用邀請連結加入另一本時，邀請頁先提醒；加入成功才清掉本機舊帳本的紀錄與成員設定（`ledgerRepo.clearTxns`、`resetLocalMembers`），免得下一輪同步把舊紀錄當成本機新增推進新帳本。原本的紀錄還在自己的試算表。一台裝置同時只記一本，要切回原本那本得重新接回（還沒有帳本清單）。
- **邀請過後與換人**（使用者要求，2026-09-13）：一本帳本最多兩個人。受邀者以雲端為準——試算表的 Drive 共用對象裡、不是擁有者的那個 Google 帳號（`sync/invitee.ts`），連不上時用本機記的 `invite.sharedWith`。還沒邀請時不顯示受邀者那一列（使用者要求：邀請了才長出來），分享過後「邀請成員」消失、受邀那一列出現並顯示對方帳號；受邀那一方的手機上一律沒有這顆按鈕。換人：建立帳本的人點受邀那一列 →「移除這位成員」→ 確認後拿掉所有非擁有者的共用權限（`removePermission`，Drive 回 204）、那個位置的名稱與饅頭顏色回到預設並推上雲端，「邀請成員」回來；另有「重新傳邀請連結」。邀請面板上的「改邀請其他人」拿掉——它只會多分享一個帳號、不會拿掉舊的。對方之前記的帳留著，會顯示成下一位成員的名稱（資料裡的 by 只有「我／妻」兩個位置）。
- **開發與正式分開**（擁有者指示，2026-09-13）：環境看 Vite 的 `MODE`，只有正式建置是 `prod`（`sync/config.ts`）。開發版建的試算表檔名加「（開發）」，兩邊都在 `配置!M2` 寫環境標記（`sheets/ledgerSheet.ts`）。加入時先讀這一格，環境不符就拒絕，不搬分類也不記下帳本（`joinLedger` 的 `wrong-env`）。沒有標記的舊帳本一律算開發：標記加上之前建的都是開發時建的。已經記下的帳本不再檢查，因為本機資料依網址分開，開發版與正式版本來就讀不到彼此的帳本 id。
- **同步**（`sync/controller.ts`）：記帳後約 1.2 秒推送（合併連續幾筆）；每 5 秒輪詢，只讀一格版本戳記（`配置!L2`），有變才拉整張紀錄表；上線或切回前景立刻補一輪。兩人都開著 App 時，對方的新帳約 5 秒內出現。Google Sheets 沒有推播，每 5 秒一次＝每人每分鐘 12 次讀取，遠低於每人 60 次的配額。
- **token 過期**：同步狀態變成「點一下連線 Google」（新狀態 `needs-auth`，不是紅燈），點一下在同一個點擊事件裡叫出 Google 視窗。
- **重整不必重新連線**（使用者要求，2026-09-13）：access token 連同到期時間與權限範圍存在 localStorage（`auth/gis.ts` 的 `TOKEN_KEY`），到期前重整、切回、重開 App 都直接沿用；快過期、權限不齊、內容壞掉的一律不用並清掉。取捨是同網域的程式讀得到它，但它一小時內失效、權限只到試算表。一小時的上限是 token model 本身的限制：沒有後端保管用戶端密碼就拿不到 refresh token。
- 刪除是假刪，同步來源改用含已刪除紀錄的 `ledgerRepo.allTxnsForSync()`——原本的 `listTxns` 會把刪除濾掉，本機刪的帳永遠傳不出去。
- `.env.local` 已加進 `.gitignore`；`vitest.config.ts` 讓測試一律跑純本機模式，不吃開發者的 `.env.local`。

**已知缺口：**
- ~~分類只在加入時搬一次~~：已修（2026-09-14，使用者回報受邀者改的分類沒同步）。第一版是整份「本機改過就推、最後推的贏」，真機上仍不行：雲端配置頁查到分類被另一支手機的舊分類蓋回預設——那支手機還沒拉到新分類時按一次 ✓（就算沒改）就整份推上去。改成**每個分類記修改時間（配置頁 K 欄），同步時逐一合併、較新的贏**（`sync/categoryMerge.ts`）：一邊改租屋、一邊改外食兩個都留得住，同一個分類兩邊都改才是較新的贏；按 ✓ 但內容沒變不算修改。合併結果跟雲端不同才寫回（先清再寫、重寫年報表、改版本戳記），跟本機不同才存回本機。升級時跑一次：受邀者（或本機還有沒推的修改）第一次合併時，兩邊都沒有修改時間的舊分類以本機為準。
- **iPhone 點輸入框會放大**（使用者回報，第一次修完仍會）：`global.css` 本來就有輸入框 `font-size: max(16px, 1em)`，但各元件的 CSS Modules class 權重較高，把月預算、分類名稱、備註、Email 等輸入框蓋回 12–13.5px；viewport 的 `maximum-scale=1` 也不一定擋得住。觸控裝置（`pointer: coarse`）上所有輸入框一律 `16px !important`，桌機維持原型字級。Vitest 讀不到 CSS（`?raw` 回空字串），由 `e2e/input-zoom.spec.ts` 在模擬觸控的 Chromium 量字級。
- **右滑跳回邀請頁**（使用者回報，第一次修完仍會）：舊版留在歷史紀錄裡的接受邀請頁還在，右滑到底還是會出現。已經在帳本裡的手機按上一頁回到接受邀請頁（navigation type 是 back_forward，或從返回快取還原）時直接換回主程式；點連結打開照常顯示「你已在這本帳裡」。邀請面板的預覽改用 `location.replace`，不留歷史紀錄。
- **手機換不到新版**（使用者回報修好了卻沒效）：原本只註冊 service worker，iPhone 主畫面 App 多半從背景叫回來、不重新載入，一直跑舊版。改在 `main.tsx` 註冊：每次回到前景檢查新版，新版裝好就重新整理；記一筆或邀請面板開著、正在打字時延到下次回到前景。配置頁最底下顯示版本（見下一條），兩支手機對得上才是同一版。
- **美妝分類圖示**（使用者要求，2026-09-14）：圖示庫加一顆口紅（`lipstick`），跟原本 15 顆同一套 Microsoft Fluent Emoji Flat、同一份 MIT 授權，配置頁的圖示選擇器變成 16 顆。
- **改名「饅頭記帳」**（使用者要求，2026-09-14）：App 名稱、主畫面名稱、網頁標題、接受邀請頁、新建帳本的試算表檔名都改成「饅頭記帳」。找自己之前建的帳本時仍認得「饅頭共享記帳」（正式版上線時的名稱）與更早的「加拿大共用記帳」，已經建好的試算表不會重建。
- **主畫面圖示換成使用者設計的圖**（使用者要求，2026-09-14）：原圖在 `src/assets/icons/manto-icon-1024-square.png`（滿版正方形）與 `manto-icon-1024.png`（已裁圓角、帶陰影）。iPhone 與 Android 都會自己裁圓角，所以 `public/icons` 的 apple-touch-icon（180）、icon-192、icon-512、maskable 512 一律由滿版正方形那張縮出（逐次減半再縮，底色 #FFF6EC、不透明）；圓角那張不放主畫面，免得重複裁角、邊上留陰影。原圖沒有被程式引用，不會打包進網站。
- **啟動畫面**（使用者要求，2026-09-14，照原型 v2 的「啟動畫面」；原型其他部分已過時，不跟著改）：`components/LaunchScreen` 掛在 `main.tsx`、蓋在 App 上面，底下照常載入與同步。兩顆饅頭依序彈起、光暈擴散、字標浮現（原型底部的讀取條依使用者要求拿掉），2.15 秒放大淡出、淡出播完（約 2.6 秒）卸載（`DUR.boot*`，MOTION #39）；減少動態效果時不播彈起、淡出 120ms。`index.html` 先把底色設成同一個淡紫，載入前不閃白；開發用的 `?debug=` 展示頁不蓋啟動畫面。
- **「對方記帳時通知我」接上了**（2026-09-14，原本開關存得起來但沒有任何作用）：同步拉回來後比對這台手機看過的紀錄 id（`sync/partnerArrivals.ts`），對方新記的就用 Toast（MOTION #25）跳出「雪雪大人記了一筆 超市 · 食材 $42.18」，好幾筆一起到就說幾筆。打開 App 時本機已有的紀錄當基準不跳；本機一筆都沒有時第一次同步拉回來的歷史也不跳；自己記的、已刪除的、對方改舊紀錄都不跳；開關關掉就不跳。App 關著時仍沒有推播。
- **跨午夜自動換日**（2026-09-14）：App 開著過了午夜，回到前景或下一分鐘內「今天」換成新的一天；原本停在今天的選取跟著換（跨月也對），自己選了別天不動。日常頁月曆與統計頁的本週／本月標題改讀 store 的 `today`。
- **返回鍵先關面板**（2026-09-14，§12.4）：記一筆面板與邀請面板開著時佔一格歷史紀錄（`lib/useBackToClose`），Android 返回鍵、iPhone 右滑先用面板自己的動畫關掉，不直接離開 App；用按鈕關掉時自己退掉那一格。退那一格延到下一輪做，React 開發模式掛兩次時才不會一打開就被自己關掉。
- **手動清單改成自動測試**（使用者指示，2026-09-15）：152 條裡能自動化的寫成 Playwright spec（`e2e/daily`、`entry`、`stats`、`categories`、`invite`、`shell`，共用 `e2e/helpers.ts`）或對到既有的單元測試，要真實 Google 帳號、第二支手機、真機觀感的不再列管。`playwright.config` 改成自己起純本機模式的 dev server（5174，不帶 Google 用戶端 ID）——原本沿用開發者開著的 5173，那台會停在登入頁。自動化時抓到兩個問題並修掉：新增分類的卡片其實沒有 MOTION #17 的浮現動畫（補上）；分類卡在桌機上滑一次之後就滑不回去（第一次滑動選到文字、第二次變成原生拖放，卡片改成不可選取文字）。
- **成員列的狀態放錯位置**（使用者回報「八八的顯示成雪雪大人的」）：右邊那格放的是**這台裝置**的同步狀態，卻掛在對方那一列（照原型版位）。改成自己那一列放自己的同步狀態，對方那一列放他最後記帳的時間——對方的同步狀態是他手機上的事，這台裝置不知道。
- **Google 登入自動續期**（使用者回報每次都要點一下）：token model 沒有 refresh token，access token 約一小時過期。同意紀錄留在 Google 帳號上，所以在這台裝置同意過之後可以用 `prompt: ''` 試著靜默換新的（`tokens.renewSilently()`）：打開 App、回到前景、每 5 分鐘各試一次；成功就自動恢復同步，失敗（Safari 擋彈出視窗、Google 要重新同意）安靜維持「點一下連線 Google」，一分鐘內不重試。**改進（2026-09-15，使用者回報過一小時還是要點一次）**：Safari 只在使用者點過畫面之後的短時間內允許 Google 的視窗，等真的過期才在背景換一定被擋。改成快過期（剩 10 分鐘）或已過期時，**任何一次點擊**都順手續期（provider 自己節流一分鐘），使用中幾乎不會掉到「點一下連線」的狀態。
- **登入端點（真正的永續登入）**（使用者要求，2026-09-15）：token model 的一小時上限沒辦法用前端手段解決——續期要叫 Google 的視窗，Safari 只在使用者剛點過畫面時才允許。改成可選的授權碼流程：`worker/`（Cloudflare Worker，免費方案）用用戶端密碼換 token 與續期，密碼只存在它的環境變數、只接受本 App 的來源；App 端 `auth/proxyTokens.ts` 登入一次拿到 refresh token 存在本機，之後續期是純網路請求，不開視窗也不需要點擊。`VITE_AUTH_PROXY_URL` 沒設定時完全維持原本的 token model，線上版不受影響。redirect_uri 官方兩份文件說法不一（JS 參考說是頁面來源、實作範例說只有 `postmessage` 會過），Worker 先送 postmessage，被判定不符再用來源網址重試一次。要做到完全不用再點，只有兩條路：放一個保管用戶端密碼的伺服器端點來換 refresh token，或改用 Firebase 這類代管服務；兩者都要離開「純靜態、資料在你自己的試算表」這個前提。**已上線（2026-09-18，v1.1.0）**：端點部署在 `https://jointbooks-auth.could562073.workers.dev`，repo 變數 `VITE_AUTH_PROXY_URL` 已設定，線上版的建置已帶到這個網址；兩支手機各重新登入一次才會拿到 refresh token。
- **版本號改成語意化版本**（使用者要求「比較正統的記錄方式」，2026-09-15）：配置頁底下顯示 `v1.0.0 · 提交碼`。版本號以 `package.json` 的 `version` 為準，發佈有感更新時用 `npm version patch|minor|major` 調；提交碼仍然留著——同一個版本號會部署很多次，回報問題時要對得到是哪一次建置。建置時間改成長按版本那一行才看得到。
- **隱私權政策頁**（使用者要求，2026-09-18）：Google 同意畫面要從「測試中」切成正式版，必填隱私權政策網址（測試中的 refresh token 7 天就失效，正式版才不會）。加了靜態頁 `public/privacy.html`（網址 `/JointBooks/privacy.html`），不經過 App。內容照程式實際行為寫：兩個權限範圍、資料在哪（試算表／本機／登入端點不存資料）、不分享、Google API 有限使用聲明、怎麼撤銷與刪除，聯絡方式指向 GitHub issues，不放個人信箱。之後改權限範圍或資料去向要一起改這頁；`build.spec.ts` 會檢查頁面打得開、兩個權限範圍都寫在上面。
- **沒有登出功能。** token 存在 localStorage。改用登入端點後 refresh token 會一直有效，要撤銷得到 Google 帳號的「第三方應用程式」移除授權。
- ~~**每小時還是要點一次重新連線。**~~ 已由登入端點解決（v1.1.0，見上方「登入端點」）。
- **給更多人用之前要處理的事。** 使用者不需要自己開 Sheets／Drive API，那是開在開發者的 Cloud 專案上。但同意畫面要從「測試中」發布成正式版；`spreadsheets` 是敏感權限，要先通過 Google 驗證（隱私權政策、網域、示範影片），否則上限 100 人、會看到未驗證警告，而且每 7 天要重新同意。Sheets API 讀取配額是每個專案每分鐘 300 次，每位開著 App 的人每分鐘輪詢 12 次，約 25 人同時在線就會碰到，要申請提高配額或放慢輪詢。
- **一本帳只有兩位成員（我／妻）**，三人以上共用還不支援。
- **App 在「測試中」狀態時，Google 的同意授權每 7 天過期一次**，到時會再看到一次同意畫面。登入端點換到的 refresh token 也一樣 7 天失效，到時要重新登入一次；同意畫面發布成正式版之後才會長期有效。
- **部署在 GitHub Pages**（2026-09-13）：網址 `https://could562073.github.io/JointBooks/`，repo 改為公開（使用者同意；部署前查過 git 歷史沒有 `.env` 與用戶端密碼）。`.github/workflows/deploy.yml` 在推到 main 時先跑單元測試，通過才用 `BASE_PATH=/JointBooks/` 建置並發布；用戶端 ID 放在 repo 的 Variables（`VITE_GOOGLE_CLIENT_ID`）。站內路徑一律經過 `lib/basePath`（路由判斷、回首頁、邀請連結），建置時把 `index.html` 複製成 `404.html`，直接打開 `/JointBooks/join?…` 才不會停在 GitHub 的 404 頁。Google Cloud Console 的「已授權的 JavaScript 來源」要加 `https://could562073.github.io`。正式建置是 `prod` 環境，會建一本新的「饅頭共享記帳」，不會碰開發帳本。
- 真實 Google 帳號與兩支手機的流程沒有自動化測試（2026-09-15 起不再列管，見 MANUAL-TESTS「不再列管」）；同步與加入的邏輯由假 Sheets API 的單元測試驗。

---

## 工作方式（2026-09-09 起，擁有者指示）

- **以功能實作為主**，不要停在基礎建設上打轉。
- ~~只寫單元測試，瀏覽器層面的跳過並列進手動清單~~：2026-09-15 起改成**能自動化的都寫成測試**（擁有者指示）——
  邏輯寫單元測試，互動、手勢、動畫參數、版面寫 Playwright spec（`e2e/`）；真的沒辦法自動化的
  （要真實 Google 帳號、第二支手機、真機觀感）就不測，不再維護手動清單。

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

## 擁有者的裁決（規格互斥處）

| # | 問題 | 裁決 | 落在哪 |
| --- | --- | --- | --- |
| 1 | §4 說明細「依時間升冪」、§5 說新紀錄「出現在最前」 | **依 createdAt 降冪**，最新一筆在最上方 | `domain/aggregate.txnsOn` |
| 2 | 數字鍵盤空白時先打小數點，原型留空、實作補成 `0.` | **補成 `0.`** | `domain/money.pushDigit` |
| 3 | 增補檔 B-3 把記一筆面板的分類區改成可收合、預設收起（為了 iPhone SE 放得下鍵盤）；原型是一直展開 | **照原型一直展開**，版面也照原型；小螢幕靠整片面板捲動 | `screens/entry/EntrySheet`、`CategoryPicker` |
| 4 | Google 登入：原本的授權碼＋PKCE＋refresh token 實測回 400「client_secret is missing」，而 GitHub Pages 藏不了密碼 | **改用 Google Identity Services 的 token model**：不需要密碼、不需要後端；token 約一小時過期，之後點一下重新連線 | `auth/gis.ts`、`App.tsx` |
| 5 | 權限範圍：`drive.file` 讀不到對方建立、再分享過來的試算表 | **改用 `spreadsheets`＋`drive.file`**，她不必另外用檔案選擇器選檔；授權畫面會寫「所有試算表」 | `auth/gis.ts` 的 `SCOPES` |
| 6 | App 不知道要把帳本分享給誰 | **邀請面板加一欄填她的 Google 帳號**，用 Drive API 設成可編輯（原型沒有這一欄） | `invite/InvitePanel.tsx` |
| 7 | 邀請面板說明卡：原型寫「產生新連結後舊連結立即失效」，沒有後端做不到 | **照實際行為寫**：「已經傳出去的舊連結會一直有效到它自己的期限」 | `invite/InvitePanel.tsx` 的 `STEPS` |
| 8 | 誰是主帳號：沒有後端，App 不知道是不是已經有人建過帳本 | **登入頁分兩條路**：「用 Google 建立我的帳本」（建立的人是主帳號，建立前再確認一次）與「我收到了邀請連結，要加入別人的帳本」。之後的人用邀請連結加入；每個人都能自己記，也能加入別人的帳本 | `invite/LoginPage.tsx`、`sync/cloud.ts` 的 `ensureLedger` |

第 2 題順帶確認了前導零不保留（`0` 再打 `5` 是 `5`）維持現狀。

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
- ~~store 的初始年月日在 module load 時算一次，PWA 跨午夜不會更新~~：已修（2026-09-14）。store 多一個 `today`，
  外殼回到前景時與每分鐘呼叫 `refreshToday`；原本停在今天就跟著換日，選了別天不動。
- 兩個設定開關的持久化 promise 沒被 await，IndexedDB 寫入失敗會靜靜消失。
- §2 有一批數值還沒 token 化：CTA 漸層、分頁列圓角 22px、FAB 圓角 19px、
  圖示方塊圓角 13/8/14、毛玻璃配方、分頁標籤 10px。也還沒有間距與字級 scale。
- 收窄 Playwright 的全域 `expect.timeout`（目前 10s，應該只給需要的 spec）。

**Plan 06（統計頁）**
- ~~`animation-iteration-count: 1 !important` 在 reduced-motion 下會讓 MOTION #26 的
  同步轉圈凍在半途~~：查過不會（2026-09-14）——`SyncStatus` 在減少動態效果時本來就不套轉圈樣式。

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
