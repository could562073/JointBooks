# MOTION 驗收清單（37 條）

來源：`HANDOFF.md` §10 的 38 條，扣除 `docs/HANDOFF-AMENDMENTS.md` §A 刪除的 #20。
增補檔 §B-1（分類頁收支分段）與 §B-3（記一筆分類區收合）沿用 #32 與 #38 的規格，
不另編號。原型畫布上那塊 MOTION 面板是舊版廢稿，一律以本表為準。

狀態：`未開始` / `已實作` / `已驗收`

| # | 互動 | 常數來源 | 計畫 | 狀態 |
| --- | --- | --- | --- | --- |
| 1 | 記一筆面板進場 | `DUR.sheetIn` `DUR.scrimSheetIn` `EASE.sheet` | 05 | 已實作 |
| 2 | 記一筆面板離場 | `DUR.sheetOut` `DUR.scrimSheetOut` `EASE.exit` | 05 | 已實作 |
| 3 | 數字鍵按壓回饋 | `DUR.keyPress` `EASE.move` | 05 | 已實作 |
| 4 | 儲存後新紀錄落定 | `DUR.sheetOut` `DUR.riseIn` `DUR.calCellPop` `EASE.enter` | 05 | 已實作 |
| 5 | 明細依序浮現 | `DUR.riseIn` `DUR.riseStagger` `EASE.enter` | 04 | 已實作 |
| 6 | 月曆選中框滑動 | `DUR.calSnap` `EASE.move` | 04 | 已實作 |
| 7 | 月份切換（按鈕或左右滑） | `DUR.slide` `DUR.slideBack` `EASE.move` `GESTURE.monthSwipe` | 04 | 已實作 |
| 8 | 分頁切換—頁面 | `DUR.slide` `EASE.move` | 04 | 已實作 |
| 9 | 分頁切換—滑塊 | `DUR.slide` `EASE.move` | 04 | 已實作 |
| 10 | 分頁切換—饅頭 | `DUR.slide` `EASE.enter` | 04 | 已實作 |
| 11 | 週／月／年切換 | `DUR.slide` `DUR.countUp` `DUR.trendDraw` | 06 | 已實作 |
| 12 | 預算條填充 | `DUR.budgetFill` `DUR.budgetStagger` `DUR.budgetFlash` | 06 | 已實作 |
| 13 | 月曆收起／展開 | `DUR.calSnap` `GESTURE.calendarHandle` | 04 | 已實作 |
| 14 | 分類子頁進場 | `DUR.slide` `EASE.move` | 07 | 已實作 |
| 15 | 分類卡左滑刪除 | `DUR.cardSnap` `EASE.move` `GESTURE.categoryCard` | 07 | 已實作 |
| 16 | 刪除確認彈窗 | `DUR.dialogIn` `DUR.scrimIn` `DUR.rowCollapse` `EASE.enter` | 07 | 已實作 |
| 17 | 新增分類 | `DUR.riseIn` `EASE.enter` | 07 | 已實作 |
| 18 | 圖示選擇器展開 | `DUR.popIn` `DUR.outlineFade` `EASE.enter` | 07 | 已實作 |
| 19 | 就地編輯預算／改名 | `DUR.morph` `DUR.morphPop` `EASE.exit` | 07 | 已實作 |
| 21 | 開關切換 | `DUR.toggleKnob` `EASE.enter` | 07 | 已實作 |
| 22 | 邀請面板進場／下滑關閉 | `DUR.sheetIn` `DUR.panelSnap` `GESTURE.panelDismiss` | 09 | 已實作 |
| 23 | 複製成功回饋 | `DUR.copyFeedback` `DUR.copyRevert` | 09 | 已實作 |
| 24 | QR 展開 | `DUR.popIn` `EASE.enter` | 09 | 已實作 |
| 25 | 對方新增的通知 | `DUR.toastIn` `DUR.toastHold` `DUR.toastOut` `DUR.syncPulse` `EASE.exit` | 08 | 已實作 |
| 26 | 同步中狀態 | `DUR.syncSpin` `DUR.syncSettle` | 08 | 已實作 |
| 27 | 下拉重新整理 | `DUR.pullSpin` `DUR.pullSettle` `GESTURE.pullRefresh` | 04 | 已實作 |
| 28 | 懸浮 ＋ 按壓態 | `DUR.fabPress` `DUR.fabRelease` `EASE.exit` | 04 | 已實作 |
| 29 | 底部分頁列毛玻璃 | — | 04 | 已實作 |
| 30 | 饅頭呆滯呼吸 | `DUR.breathe` | 01 | 已實作 |
| 31 | 收支數字 count-up | `DUR.countUp` `DUR.dayTotal` | 04 | 已實作 |
| 32 | 週／月／年滑塊 | `DUR.slide` `EASE.move` | 06 | 已實作 |
| 33 | 年月快速選擇 | `DUR.chevron` `DUR.yearPanelIn` `EASE.enter` | 04 | 已實作 |
| 34 | 選擇面板換年 | `DUR.slide` `EASE.move` | 04 | 已實作 |
| 35 | 記一筆面板下滑關閉 | `DUR.panelSnap` `EASE.move` `GESTURE.panelDismiss` | 05 | 已實作 |
| 36 | 支出／收入切換滑塊 | `DUR.slide` `DUR.kindColor` `EASE.move` | 05 | 已實作 |
| 37 | 刪除紀錄確認窗 | `DUR.dialogIn` `DUR.scrimIn` `DUR.rowCollapse` `EASE.enter` | 05 | 已實作 |
| 38 | 記一筆日期選擇器 | `DUR.chevron` `DUR.popIn` `DUR.outlineFade` `EASE.enter` | 05 | 已實作 |
