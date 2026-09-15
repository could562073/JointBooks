# 手動驗證清單

2026-09-15 起不再維護大張的手動清單（使用者指示）：**能自動化的全部改成測試，做不到的就不測了**。
原本 152 條的去向記在下面。之後的新功能也照這個原則：先想辦法寫成測試，真的寫不了才考慮列在這裡。

## 怎麼跑測試

```bash
npx vitest run                        # 單元與驗收測試（1166 條，含 src/acceptance 的 §15 驗收套件）
npm run e2e                           # Playwright 真實瀏覽器測試：三個手機寬度＋正式建置，共 397 條
npx playwright test --project=ip13    # 只跑 390 寬（131 條），快很多
```

- Playwright 自己起兩顆 server：純本機模式（不帶 Google 用戶端 ID）的 dev server `http://localhost:5174`，
  以及正式建置的 preview `http://localhost:4173`。不會碰你開著的 `npm run dev`（5173），也不需要 Google 帳號。
- 推到 `main` 時 GitHub Actions 會跑一次完整的 Playwright（`.github/workflows/e2e.yml`），不擋部署。
- `http://localhost:5173/?debug=icons`、`?debug=mantou`、`?debug=gesture` 是開發用的元件展示頁。

## 原本手動清單的去向

### 改成自動測試

| 原本的編號 | 現在在哪裡驗 |
| --- | --- |
| D1–D22、D24–D28（日常頁：把手、月曆選取、數字 count-up、＋、分頁列、換月、年月選擇器、下拉重整、明細浮現） | `e2e/daily.spec.ts` |
| E1–E9、E12–E16（記一筆：進出場、把手下滑、按鍵回饋、⌫ 配色、收支滑塊、日期欄、存檔動畫、刪除確認、就地新增分類） | `e2e/entry.spec.ts` |
| E11、V1–V9（iPhone SE 開記一筆、可點範圍 ≥44px、容器不被撐破、文字不出框、固定區不動、只有一個捲動容器） | `e2e/layout.spec.ts`、`e2e/pwa.spec.ts` |
| S1–S10（統計頁：分段滑塊、count-up、描線、線的樣式、預算條、減少動態、期間跟著選取日） | `e2e/stats.spec.ts` |
| C1、C2、C4–C9、C11–C13（分類子頁：進出場、左滑與收回、點擊不被手勢攔掉、刪除收合、新增、圖示選擇器、就地編輯、收支切換、開關） | `e2e/categories.spec.ts` |
| C3，以及 M1–M3、R1–R4 裡的數值（跟手比例、門檻、阻尼、點擊判定、touch-action） | `e2e/gesture.spec.ts` |
| C10、C14（換圖示三處同步、刪掉用過的分類歷史不變） | `src/acceptance/a03-categories.test.tsx` |
| I4–I8、I11–I13、I29（邀請面板：進場、下滑關閉、複製回饋與剪貼簿內容、QR、分享取消與退回複製、預覽） | `e2e/invite.spec.ts` |
| I16–I18、I23、I27（已是成員、連結被改、過期、還沒分享、另一個環境的連結） | `src/acceptance/a05-invite-sync.test.tsx`、`src/sync/joinLedger.test.ts` |
| I38（直接打開邀請連結不是 404 頁） | `e2e/build.spec.ts` |
| I41（iPhone 點輸入框不放大） | `e2e/input-zoom.spec.ts` |
| I43（分類子頁右滑回配置頁、不會跳回邀請頁） | `src/screens/settings/SettingsScreen.categories.test.tsx`、`src/acceptance/a05-join-back.test.tsx` |
| I44、I47（兩邊各改分類不互相蓋掉、內容沒變按 ✓ 不算修改） | `src/sync/categoryMerge.test.ts`、`src/sync/controller.categories.test.ts`、`src/sync/categoriesSync.test.ts` |
| I45（配置頁底下的版本） | `src/screens/settings/SettingsScreen.version.test.tsx` |
| I48（啟動畫面） | `e2e/shell.spec.ts`、`src/components/LaunchScreen.test.tsx` |
| I49（對方記帳時跳通知） | `src/sync/partnerArrivals.test.ts` |
| I50（跨午夜換日） | `src/store/useLedger.today.test.ts` |
| I51（返回鍵、右滑先關面板） | `e2e/shell.spec.ts`、`src/lib/useBackToClose.test.tsx` |
| G12（沒設定 Google 用戶端 ID 照常運作） | 所有 Playwright 測試都跑在這個模式 |

### 自動化時抓到並修掉的

- **新增分類的卡片沒有浮現動畫**（MOTION #17）：文件標「已實作」，e2e 量過其實沒有。補上由上方 10px 浮現、320ms。
- **分類卡在桌機上滑一次之後就滑不回去**：第一次滑動順手選到文字，第二次按在選取的文字上拖曳就變成瀏覽器原生拖放（dragstart → pointercancel）。卡片改成不可選取文字。
- **e2e 一直沿用開發者開著的 5173 dev server**：那台帶 Google 用戶端 ID，停在登入頁，畫面測試跑不到。改成 Playwright 自己起純本機模式的 server。

### 不再列管（無法自動化）

照使用者指示，以下不再測：

- **要真實 Google 帳號、雲端硬碟或第二支手機**：G1–G11、I1–I3、I9、I14、I15、I19、I21、I22、I24–I26、I28、I30–I37。
  同步、合併、加入帳本的邏輯由 `src/sync/` 與 `src/acceptance/` 的單元測試用假的 Sheets API 驗。
- **只有真機才看得出來**：I10（系統分享單）、I39、I40、I42（主畫面 App 的名稱、圖示、安全區）、I46（手機換新版）、R5–R8（standalone 登入、毛玻璃觀感、觸覺回饋）。
- **手感與對照原型的截圖**：M1–M3、R1–R4 的手感部分、D23、P1–P4。
- **已經過時**：E10（分類區收合已取消）、I20（沒有登出功能）。
