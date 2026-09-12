# §15 驗收套件

HANDOFF §15.1 的 A 類原訂用 Playwright 跑兩個斷點。使用者指定「只做單元測試、
需要瀏覽器的先跳過但要列出來」，所以這裡把**功能行為**那 22 條用 jsdom +
Testing Library 從 `<App />` 最外層跑，**版面**那 6 條（23–28）留給人工——
它們量的是 `getBoundingClientRect()`，jsdom 一律回 0，量不出來。

跑法：`npx vitest run src/acceptance`

| §15.1 | 項目 | 在哪 |
| --- | --- | --- |
| 1 | 三分頁可切換、每頁一個捲動區 | `a01-navigation` |
| 2 | 點月曆某天 → 明細／標題／當日總額同步 | `a01-navigation` |
| 3 | `‹ ›` 換月跨年 | `a01-navigation` |
| 4 | 年月選擇器夾日（不出現 2/31） | `a01-navigation` |
| 5 | 記一筆完整流程 | `a02-entry` |
| 6 | 金額 0 不寫入 | `a02-entry` |
| 7 | 小數兩位、總長 9 字 | `a02-entry` |
| 8 | TWD → 實際扣款 CAD 欄位 | `a02-entry` |
| 9 | 點明細進編輯模式、欄位帶入原值 | `a02-entry` |
| 10 | 就地新增主／子分類 | `a02-entry` |
| 10b | 改日期後記在該日期 | `a02-entry` |
| 11 | 改名／改預算／換圖示全站同步 | `a03-categories` |
| 12 | 新增分類在最上方、名稱自動編輯、圖示未展開 | `a03-categories` |
| 13 | 左滑刪除、確認窗「已用在 N 筆」 | `a03-categories` |
| 14 | 刪分類後歷史與統計金額不變 | `a03-categories` |
| 15 | 子分類剩一個不可刪 | `a03-categories` |
| 16 | 統計頁週／月／年切換 | `a04-stats-settings` |
| 17 | ~~月結日改 15~~ | 增補檔 A **移除** |
| 18 | 週起始固定週一的靜態 assert | `a04-stats-settings` |
| 19 | 關閉記帳人後頭像隱藏但版位保留 | `a04-stats-settings` |
| 20 | 邀請面板複製內容與 QR 內容等於連結 | `a05-invite-sync` |
| 21 | join 連結四個分支 | `a05-invite-sync` |
| 22 | 離線 → outbox → 回線只 append 一列 | `a06-offline` |
| 23–28 | 版面（44px 命中區、容器不溢出、固定區不動） | **人工**，見 `docs/MANUAL-TESTS.md` |

§15.1-16 的倍率以增補檔 D-1 為準（週 = 7/當月天數、年 = ×12），不是原文的
×0.25／×11.4——那兩個數值已被判定為未經推導。

## 兩件在這裡量不到的事

1. **版面**：`getBoundingClientRect()` 在 jsdom 全是 0，CSS Modules 的樣式也
   沒有被套用（`getComputedStyle().boxShadow` 回空字串），所以 23–28 條、
   B 類截圖比對、C 類真機手感都只能人工。
2. **真實 Google 帳號**：登入、建表、跨裝置同步要真的打 API。§15.1-22 在這裡
   是拿一張「會記住自己有幾列」的假試算表跑的，去重邏輯驗得到，OAuth 驗不到。
