# 登入端點（讓登入不用一小時點一次）

Google 規定「網頁應用程式」類型的用戶端，拿授權碼換 token、用 refresh token 續期時
**都必須附上用戶端密碼**。密碼不能放進手機或網站（GitHub Pages 是純靜態，誰都看得到），
所以需要一個小地方保管它。這支程式只做兩件事，跑在 Cloudflare 的免費方案上：

```
POST /auth/exchange { code }          → { access_token, expires_in, refresh_token?, scope }
POST /auth/refresh  { refresh_token } → { access_token, expires_in, scope }
```

- 密碼只存在 Cloudflare 的機密設定裡，永遠不會回傳給瀏覽器。
- 只接受本 App 的網址呼叫（`ALLOWED_ORIGINS`），不會變成公開的換 token 服務。
- refresh token 交給 App 存在手機裡（跟現有的 access token 一樣放 localStorage）：網站與這支端點
  不同網域，跨網站 cookie 在 Safari 一律被擋，做不成伺服器端的會話。權限只到試算表與這支 App 建的檔案；
  之後整個 App 搬到同一個網域時，可以改成端點自己保管、瀏覽器只留一個會話 id。

## 一、Google Cloud Console（約 5 分鐘）

1. **憑證 → OAuth 用戶端 ID**，打開這個專案用的那一組（網頁應用程式類型）。
2. **重設用戶端密碼**：舊的那一組請作廢重發（開發過程中外流過）。新的密碼待會直接貼進
   Cloudflare，不要存進這個專案的任何檔案。
3. **已授權的 JavaScript 來源**確認有：`https://could562073.github.io`、`http://localhost:5173`。
4. **已授權的重新導向 URI**：也把上面兩個來源加進去。彈出視窗流程通常用 `postmessage`
   不需要登記，但這支端點在 Google 回報「重新導向網址不符」時會改用來源網址重試，登記了才保險。

## 二、Cloudflare（第一次約 10 分鐘）

```bash
cd worker
npx wrangler login                       # 開瀏覽器登入 Cloudflare（免費帳號即可）
# 把 wrangler.toml 的 GOOGLE_CLIENT_ID 填成這個專案的用戶端 ID
npx wrangler secret put GOOGLE_CLIENT_SECRET   # 貼上剛才重發的密碼，只有你看得到
npx wrangler deploy                      # 部署，最後會印出網址
```

部署完會得到類似 `https://jointbooks-auth.<你的帳號>.workers.dev` 的網址。

## 三、讓 App 用它

- **正式版**：GitHub repo → Settings → Secrets and variables → Actions → Variables，
  新增 `VITE_AUTH_PROXY_URL`，值就是上面那個網址。推一次 main 就會生效。
- **本機開發**：`.env.local` 加一行 `VITE_AUTH_PROXY_URL=https://...workers.dev`。

沒設定這個變數時，App 會維持原本的登入方式（一小時後要點一下），不會壞掉。

## 四、確認有效

1. 手機上重新登入一次（這一次會拿到 refresh token）。
2. 放著超過一小時再打開 App：頂端應該仍是「已同步」，不需要點「連線 Google」。
3. 想撤銷授權：Google 帳號 → 安全性 → 第三方應用程式，移除這個 App；下次開啟會要求重新登入。

## 常見狀況

| 現象 | 原因與處理 |
| --- | --- |
| 回 403 `origin_not_allowed` | `ALLOWED_ORIGINS` 沒有你正在用的網址；改 `wrangler.toml` 後重新 `wrangler deploy` |
| 回 502 `redirect_uri_mismatch` | 兩種 redirect_uri 都被拒；把來源網址加進 Google 的「已授權的重新導向 URI」 |
| 回 502 `invalid_grant` | refresh token 被撤銷或過期（改密碼、長期沒用都會）；App 會要求重新登入一次 |
| 換不到 refresh token | Google 沒發（同意紀錄已存在時可能不發）。在 Google 帳號移除這個 App 的授權後，重新登入一次即可 |

## 本機測試

```bash
npx vitest run worker      # 端點的單元測試（假的 Google 回應，不需要網路）
```
