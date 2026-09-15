# 饅頭記帳（JointBooks）

繁體中文、手機優先的記帳 PWA。帳本就是你 Google 雲端硬碟裡的一份試算表，可以自己記，也可以邀請一個人一起記，兩支手機幾秒內同步。

**網址：** https://could562073.github.io/JointBooks/

> 最初是為了在加拿大生活的兩個人一起記帳而做：日常支出用加幣，偶爾刷台幣、美金，
> 月底想一眼看出這個月花在哪裡、還剩多少預算。

---

## 設計方向

- **資料是你自己的。** 沒有後端伺服器，也沒有第三方資料庫。登入 Google 後，App 在你的雲端硬碟建一份試算表，所有紀錄都寫在裡面，你隨時可以直接打開、篩選、匯出。
- **兩個人共用一本帳。** 一本帳本最多兩位成員：建立帳本的人，加上一位受邀的人。雙方都能新增、修改、刪除所有紀錄，對方記的帳約 5 秒內出現。
- **手機上用起來順手。** 單手操作的數字鍵盤、跟手的月曆與面板手勢、減少動態效果時自動降級，畫面與動畫照原型逐項打磨。
- **離線也能記。** 沒網路時照樣記帳，存在手機裡，連上網路後自動補同步。可以加到主畫面，用起來像一般 App。

## 功能

### 日常
- 月曆以底色深淺顯示每天花多少，有收入的日子標一條綠色短槓
- 當月收入、支出、結餘三張卡，數字會跑動畫
- 點日期看當天明細；左右滑換月，點標題快速跳到任一年月
- 月曆可往上收起，讓明細有更多空間；下拉重新同步

### 記一筆
- 數字鍵盤輸入金額，支援 CAD／TWD／USD；非加幣時另外填銀行實際扣款的加幣金額，統計一律用實扣金額，不必換算匯率
- 主分類、子分類一直展開，可以就地新增分類
- 日期、備註；「誰記的」自動是這台裝置的使用者

### 統計
- 週／月／年切換，顯示「本週結餘 8/31 ~ 9/6」與跟上一期的增減
- 趨勢圖：最近 8 週、6 個月或 4 年的收支，標出目前這一期
- 各分類預算使用進度，快用完變黃、超支變橘

### 配置
- 帳本成員：名稱與饅頭顏色可以自訂，會同步到對方的手機
- 邀請成員：先把帳本分享給對方的 Google 帳號，再傳邀請連結或 QR Code；已經邀請的人可以移除，改邀請別人
- 分類與月預算：改名、換圖示、調整預算、左滑刪除；兩個人各改各的分類會合併，同一個分類以較晚的修改為準
- 「每筆顯示記帳人」等開關

### 共用與同步
- 用 Google 登入後建立帳本；換手機或清過資料時，會自動接回自己之前建的那一本
- 同步：記帳後約 1 秒推上試算表；每 5 秒檢查一次對方有沒有新的紀錄，切回 App 時立刻補一輪
- 有新版時，切回 App 會自動換成新版；配置頁最底下顯示目前的版本
- 開發版與正式版各用各的帳本，測試資料不會混進真正的帳

## 目前的限制

- 一本帳本最多兩位成員
- 沒有後端，Google 登入最長一小時有效，過期後要點一下重新連線
- 還沒有推播通知（對方記帳時提醒）
- 還在 Google 同意畫面的「測試中」階段：只有加進測試使用者名單的帳號能登入

## 技術

| | |
| --- | --- |
| 前端 | React 19、TypeScript、Vite 8、CSS Modules |
| 狀態與本機資料 | Zustand、Dexie（IndexedDB） |
| 登入 | Google Identity Services（瀏覽器端 token model，不需要用戶端密碼） |
| 雲端 | Google Sheets API（帳本）、Google Drive API（分享、找回帳本） |
| PWA | vite-plugin-pwa（Workbox） |
| 測試 | Vitest、Testing Library、Playwright |
| 部署 | GitHub Actions → GitHub Pages |

字型（Zen Maru Gothic、Noto Sans TC、Baloo 2）自架在 `public/fonts`，授權為 SIL Open Font License，授權檔放在同一個資料夾。

## 開發

需要 Node.js 24。

```bash
npm install
cp .env.example .env.local   # 填入 Google OAuth 用戶端 ID；不填則以純本機模式運作
npm run dev                  # http://localhost:5173
```

Google Cloud Console 的設定步驟寫在 [`.env.example`](.env.example) 開頭。沒設定用戶端 ID 時，App 不會登入也不會同步，資料只存在瀏覽器裡，適合單純開發畫面。

```bash
npx vitest run     # 單元與驗收測試
npm run build      # 型別檢查＋正式建置
npm run e2e        # Playwright 真實瀏覽器測試（手勢）
```

`http://localhost:5173/?debug=mantou`、`?debug=icons` 是開發用的元件展示頁。

## 部署

推到 `main` 會觸發 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)：先跑單元測試，通過才建置並發布到 GitHub Pages。

- 網站在 `/JointBooks/` 子路徑底下，建置時用 `BASE_PATH=/JointBooks/`
- Google 用戶端 ID 放在 repo 的 **Settings → Secrets and variables → Actions → Variables**，名稱 `VITE_GOOGLE_CLIENT_ID`（用戶端 ID 本來就會出現在前端程式碼裡，不是機密）
- Google Cloud Console 的「已授權的 JavaScript 來源」要加入 `https://could562073.github.io`
- 建置時會把 `index.html` 複製成 `404.html`，直接打開邀請連結（`/JointBooks/join?…`）才不會停在 GitHub 的 404 頁

## 專案結構

```
src/
  screens/     日常、記一筆、統計、配置四個主要畫面
  components/  共用元件（饅頭、分頁列、分段控制、同步狀態…）
  invite/      登入頁、邀請面板、接受邀請頁
  domain/      金額、日期、分類、統計等純邏輯
  store/       Zustand 狀態
  db/ repo/    IndexedDB 資料層
  auth/        Google 登入
  sheets/      Sheets／Drive API 與試算表格式
  sync/        同步控制器、成員設定、帳本建立與加入
  lib/         動畫時長、手勢、部署路徑等工具
docs/
  PROGRESS.md      進度總覽與設計決策（新進度從這裡看起）
  MANUAL-TESTS.md  需要手動驗證的項目
  MOTION.md        動畫規格清單
```

## 授權

目前沒有指定開源授權，保留所有權利。字型依各自的 SIL Open Font License 授權。
