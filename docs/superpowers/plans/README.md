# 加拿大共用記帳 PWA — 實作計畫總表

**Spec:** `HANDOFF.md` + `docs/HANDOFF-AMENDMENTS.md`（增補檔優先）

## 為什麼拆成多份計畫

`HANDOFF.md` 涵蓋多個彼此獨立的子系統：設計系統、領域邏輯、手勢引擎、四個畫面、
OAuth、Sheets 同步、離線佇列、邀請流程、驗收測試套件。塞進單一計畫會讓每個任務
都依賴尚未定案的鄰居，而且後段任務只能寫成臆測。

因此拆成 **9 份計畫**，每一份都能獨立產出「可執行、可測試」的成果。
依序執行；每份完成並驗收後再開始下一份。

## 計畫序列

| # | 檔案 | 產出 | 預估 |
| --- | --- | --- | --- |
| 01 | `2026-09-07-01-foundation.md` | 可安裝的空殼 PWA，含完整 design token、自架字體、15 個圖示、饅頭元件、動畫常數表 | 1 天 |
| 02 | `2026-09-07-02-domain-data.md` | 純邏輯層：型別、cents 運算、日期、分類預設、聚合計算、Dexie、repo、store。無 UI，全單元測試 | 2 天 |
| 03 | `2026-09-07-03-gesture-motion.md` | `useDragGesture` 共用手勢 hook + 37 條動畫的實作骨架 + reduced-motion 降級 | 2 天 |
| 04 | `2026-09-07-04-daily-screen.md` | 日常頁完整：月份導覽、年月選擇器、三卡、月曆、把手、明細、空狀態、懸浮 ＋、分頁列 | 3 天 |
| 05 | `2026-09-07-05-entry-sheet.md` | 記一筆／編輯面板完整：金額、幣別、可收合分類區、日期選擇器、備註、鍵盤、刪除確認 | 2 天 |
| 06 | `2026-09-07-06-stats-screen.md` | 統計頁完整：週月年、總覽卡、趨勢折線、預算使用 | 1.5 天 |
| 07 | `2026-09-07-07-settings-categories.md` | 配置頁 + 分類與月預算子頁（含支出／收入分段、圖示選擇器、就地編輯、左滑刪除） | 2 天 |
| 08 | `2026-09-07-08-auth-sheets-sync.md` | Google OAuth PKCE redirect、建表、Sheets 讀寫、離線佇列、去重、衝突、同步狀態機 | 4 天 |
| 09 | `2026-09-07-09-invite-acceptance.md` | 登入頁、接受邀請頁、邀請面板、四個分支、QR、Web Share，以及第 15 節完整驗收套件 | 3 天 |

**合計約 20.5 個工作天。** 第 13 節的平板／寬螢幕版面不在此序列內。

## 依賴關係

```
01 foundation
 └─ 02 domain-data
     ├─ 03 gesture-motion
     │   ├─ 04 daily-screen
     │   ├─ 05 entry-sheet     (需 04 的明細列進入編輯)
     │   ├─ 06 stats-screen
     │   └─ 07 settings-categories
     └─ 08 auth-sheets-sync    (可與 04–07 並行，但驗收需 04–07 完成)
         └─ 09 invite-acceptance
```

## 全域驗收

每份計畫結束時，執行者必須回報：

1. 該計畫涵蓋的 `HANDOFF.md` §0 檢查清單條目 → 通過／失敗／未實作。
2. 該計畫涵蓋的 MOTION 條目 → 逐條確認（見 `docs/MOTION.md`，Plan 03 產出）。
3. 該計畫涵蓋的 §15.1 A 類測試 → 測試名稱與執行結果。

最終交付時依 §15.4 產出總表。
