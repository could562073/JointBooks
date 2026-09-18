# 不登入使用，與配置頁的登入／登出

日期：2026-09-18。狀態：使用者已確認，實作計畫見 `docs/superpowers/plans/2026-09-18-guest-mode-and-account.md`。

## 目標

- 沒有 Google 帳號、或還不想登入的人也能直接用 App，帳只存在這台手機。
- 之後想同步或共用，再到配置頁登入；登入的人也可以登出。
- 使用者原話：「只差在主試算表是用誰的而已」。所以本機模式和登入後是同一個 App、同一份本機資料，差別只在有沒有接上一本雲端帳本。

## 使用流程（使用者已確認）

1. **開始畫面**：「用 Google 登入」「貼邀請連結」下面加「先不登入，直接使用」。按了就進 App，之後打開也直接進，不再停在開始畫面。
2. **本機模式**：記帳、分類、統計、改成員名稱都照常。頂端同步狀態顯示「只存在這台手機」，點它就開始登入。按「邀請成員」會先請你登入。
3. **配置頁的「帳號」區**：
   - 本機模式：顯示「登入 Google」和一句說明（登入後帳會存進你的試算表，才能跟對方共用）。
   - 已登入：顯示目前帳號的信箱和「登出」。登出前先確認：帳留在這台手機，但不再同步，對方新記的帳也看不到。
   - 登出前會先試著同步一次。沒推上去的帳留在手機上，下次用同一個帳號登入時補推。
4. **登入時的判斷**：
   - 跟上次同一個帳號：直接接回上次那本帳（受邀者接回對方的帳本），登出期間記的帳自動推上去，不跳確認。
   - 第一次登入，而且這個帳號還沒有帳本：開一本新的，把手機上的帳帶過去，不跳確認。
   - 其他情況（換了帳號，或這個帳號雲端已經有帳本），而且手機上有帳：跳確認視窗，顯示「上次：A → 這次：B」，選項是**合併／改用雲端／取消**。手機上沒帳就不問。
5. **用邀請連結加入時手機上已經有帳**（訪客或登出後）：同一個確認視窗。選合併的話，手機上的帳都算加入者自己記的。已經接著別本帳的人加入新帳本，維持現在的做法（先提醒會切換，再清掉手機上的帳）。
6. **合併的限制**：手機上的帳如果混著兩個人記的（例如受邀者登出後換帳號登入），確認視窗不提供合併，只給改用雲端和取消。合併過去會把對方記的帳算到自己頭上。

## 名詞

- **接上的帳本**：本機 meta 的 `spreadsheetId`（現有的 `joinedSid()`）。有值才同步。
- **本機模式**：沒有接上的帳本。App 照常運作，同步控制器不啟動。
- **手機上有帳**：本機有沒刪掉的記帳紀錄。只改過分類或成員名稱不算。
- **帳號**：Google 帳號，用 Drive `about.get` 取得 `user.permissionId`（比對用，不會變）和 `user.emailAddress`（顯示用）。現有的 `drive.file` 權限就能呼叫，不多要權限。

## 本機要多記的狀態（全部放 IndexedDB 的 meta 表）

| key | 內容 | 何時寫 | 何時清 |
| --- | --- | --- | --- |
| `spreadsheetId`（既有） | 接上的帳本 id | 登入／加入成功 | 登出 |
| `selfPerson`（既有） | 這台手機是「我」還是「妻」 | 加入、接回、合併時依目標帳本設定 | 不清 |
| `localMode`（新） | 使用者選過「先不登入」或登出過，開 App 不再顯示開始畫面 | 按「先不登入」、登出 | 登入成功 |
| `lastAccount`（新） | `{ id, email }`，最後一次登入的帳號 | 每次登入成功、以及舊版升上來後第一次連上 Google | 不清 |
| `lastLedger`（新） | `{ sid, self }`，登出時接著的帳本與身分 | 登出 | 登入成功 |

放 meta 表而不是 localStorage，理由跟 `spreadsheetId` 一樣：`resetDb` 一起清，不會留下半殘狀態。

**舊版升上來的手機**：已經接著帳本、但沒有 `lastAccount`。第一次成功連上 Google 時補記目前的帳號，之後就能比對。

## 元件

### 1. `sheets/client.ts`：多一個 `aboutUser()`

`GET drive/v3/about?fields=user(emailAddress,permissionId)`，回傳 `{ id, email }`。

### 2. `sync/account.ts`（新）：登入要做什麼，純函式決定

```ts
type SignInFacts = {
  account: { id: string; email: string };        // 這次登入的帳號
  lastAccount: { id: string; email: string } | null;
  lastLedger: { sid: string; self: Person } | null;
  ownLedger: string | null;                        // 這個帳號自己建過的帳本（findLedgers + ownedByMe）
  local: { count: number; people: Set<Person> };   // 手機上沒刪掉的帳，以及是誰記的
};

type SignInPlan =
  | { kind: 'rejoin'; sid: string; self: Person }   // 同帳號接回上次那本
  | { kind: 'attach'; sid: string }                 // 接上自己的帳本，手機上沒帳
  | { kind: 'create' }                              // 開新帳本，手機上的帳帶過去（或本來就沒帳）
  | { kind: 'ask'; from: string | null; to: string; target: string | null; self: Person; count: number; canMerge: boolean; account: Account };

function planSignIn(f: SignInFacts): SignInPlan
```

判斷順序：

1. 同帳號（`lastAccount.id === account.id`）而且有 `lastLedger` → `rejoin`。
2. 手機上沒帳 → 有 `ownLedger` 就 `attach`，沒有就 `create`。
3. 沒有 `ownLedger`，而且（沒有 `lastAccount`，或 `lastAccount` 就是這個帳號），而且手機上的帳是同一個人記的 → `create`（帳改算成「我」）。
4. 其他 → `ask`，`target` 是 `ownLedger`（可能是 null，代表會開新帳本），`canMerge = local.people.size <= 1`。

`rejoin` 實際去接時，如果讀不到那本帳（對方取消共用、帳本被刪），就把 `lastLedger` 當作沒有，重新跑一次 `planSignIn`。

### 3. 確認視窗的三個選擇怎麼執行

- **合併**：
  1. 目標是既有帳本：讀它的分類。手機上的分類依「收支類型＋名稱」對應到雲端的分類（主分類對主分類、子分類在對應到的主分類底下再用名稱對），對得上的就把手機上的帳改指向雲端分類的 id，對不上的分類只帶有帳在用的（沒用到的預設分類不塞進對方的帳本），推上去成為新分類；子分類同理。
  2. 手機上的帳全部改成目標帳本裡自己的身分（建立者是「我」，加入者是「妻」）。只在 `canMerge` 時才會走到這裡，所以不會把兩個人的帳混成一個人。
  3. 成員名稱與饅頭顏色以目標帳本為準：清掉本機「待推」的標記，讓同步拉雲端的下來，不拿手機上的蓋過去。
  4. 接上帳本，同步引擎照常把雲端沒有的帳推上去（現有的 `mergeTxns` 本來就會補推）。
  5. 目標是 null（這個帳號還沒有帳本）：直接用手機上的分類開新帳本，不需要對應，成員名稱也沿用手機上的。
- **改用雲端**：清掉手機上的帳、成員名稱回預設，再用 `joinLedger` 接上目標帳本（會用雲端的分類取代本機）。目標是 null 就開一本新的空帳本。
- **取消**：不接任何帳本，斷開這次的 Google 連線，維持本機模式。

分類對應放在 `sync/categoryRemap.ts`（新，純函式）：輸入手機分類、雲端分類、手機的帳，輸出改好 id 的帳，以及要新增的分類。

### 4. 登出：`sync/account.ts` 的 `signOut(deps)`

1. 試著同步一次（最多等 5 秒，失敗不擋）。
2. `tokens.disconnect()`：清掉這台手機上的 Google 通行證與續期憑證。不撤銷 Google 那邊的授權，所以之後再登入很快。
3. 寫 `lastLedger = { sid, self }`、清 `spreadsheetId`、寫 `localMode`。
4. 畫面切到本機模式；手機上的帳、分類、成員名稱都留著。

### 5. `App.tsx`：接上的帳本變成 React 狀態

現在的 `Gate` 讀一次 `joinedSid()`，`Shell` 的同步 effect 也在啟動時讀一次，登入登出後不會跟著變。改成：

- `Gate` 持有 `link`：`undefined`（讀取中）／`'login'`（顯示開始畫面）／`{ sid: string | null }`（進 App；null 是本機模式）。
  - 有 `spreadsheetId` → `{ sid }`；沒有但 `localMode` → `{ sid: null }`；都沒有 → `'login'`。
- `Gate` 把 `account` 交給 `Shell`：`{ email, signIn(), signOut() }`。`signIn` 必須在點擊事件裡同步呼叫 `tokens.connect()`（現有規則，Safari 才不會擋視窗）。
- `Shell` 的同步 effect 依賴改成 `[cloud, sid]`：sid 變了就停掉舊的控制器、用新的 sid 重新開始；sid 是 null 就不啟動。
- 需要確認時，`signIn` 回傳 `ask` 方案給畫面，由確認視窗呼叫 `resolve('merge' | 'cloud' | 'cancel')`。

不採用「登入登出後整頁重新整理」：最簡單，但每次都會重播 2.6 秒的啟動畫面。

### 6. 畫面

- `LoginPage`：多一個文字按鈕「先不登入，直接使用」（`login-local`）。
- `SettingsScreen`：成員區上方加「帳號」區（`account-section`），依狀態顯示「登入 Google」或信箱＋「登出」。登出用現有的就地確認樣式（跟移除成員一樣）。本機模式時不顯示受邀者管理。
- `SyncStatus`：新狀態 `local`，文字「只存在這台手機」，點它等同按「登入 Google」。
- 確認視窗 `AccountSwitchSheet`（新）：標題「這台手機上有 N 筆帳」，說明「上次：A → 這次：B」，三個按鈕；`canMerge` 是 false 時不顯示合併，並用一句話說明原因。
- 加入邀請（`Join`）：手機上沒接帳本但有帳時，先跳同一個確認視窗再加入。

## 錯誤處理

- Google 視窗被擋或被關：沿用 `connectErrorText`，留在本機模式。
- 讀不到帳號（離線、`about.get` 失敗）：停止登入，顯示「連不到 Google，請確認網路後再試一次」，留在本機模式，並斷開這次連線。
- 登入途中任何一步失敗：不寫 `spreadsheetId`，本機資料不動。清手機資料（改用雲端）只在確定讀得到目標帳本之後才做。
- 離線時登出：可以登出；沒推上去的帳留在手機上，同帳號再登入時補推。

## 測試

- 單元測試：
  - `planSignIn` 每一條路（同帳號接回、沒帳、沒自己的帳本、換帳號、訪客遇到既有帳本、混了兩個人所以不能合併）。
  - `categoryRemap`：同名對應、子分類對應、對不上的新增、收支類型不同不對應。
  - `signOut` 的 meta 變化；`aboutUser` 的請求格式。
- 元件測試：開始畫面的「先不登入」、配置頁帳號區兩種狀態與登出確認、確認視窗（不能合併時沒有合併按鈕）、`Gate` 依 meta 決定顯示哪一頁。
- e2e：Playwright 的 dev server 不帶用戶端 ID，Google 流程跑不到，所以只靠上面的單元與元件測試。

## 不在這次範圍

- Google 品牌驗證、自訂網域。
- 登出時撤銷 Google 授權。
- 三人以上共用。
