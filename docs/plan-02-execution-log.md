> Plan 02 執行過程的完整紀錄（SDD ledger）。工作區已刪除，這份是留存版。

# SDD ledger — plan: docs/superpowers/plans/2026-09-07-02-domain-data.md

## 中斷後如何接手（給任何一個新 session 看的）

這份 ledger 就是恢復點。session 掛掉、rate limit、機器重開都不影響它。

1. `git log --oneline -5 && git status --short`
2. 讀本檔最下方的 `## Progress` 區段。標了 `Task N: complete` 的**已經做完，不要重派**。
   從第一個沒有 complete 的任務接手。
3. 若某個任務最後一行是 `dispatched` 或 `fix round`，代表它做到一半：
   先看工作樹有沒有未 commit 的檔案（上面第 1 步），判斷它做到哪，再從那裡續。
4. 任務簡報已全部抽好在本目錄：`task-1-brief.md` … `task-8-brief.md`。
   派工時只給對應那一份，不要叫 subagent 讀整份計畫。
5. 流程：派 implementer → 產 review package → 派 task reviewer → 有 findings 就 fix round
   → scoped re-review → 記 `Task N: complete`。八個任務都完成後跑整支分支 review。
6. 每個 dispatch 都要寫「所有指令跑前景，不要開背景 job」——
   先前有 agent 反覆卡在自己開的背景 monitor 上。

**git log 永遠是真相**：本檔提到的 commit 都真的存在，即使沒有任何人記得建立它們。

### 關於 usage limit（已查證，2026-09）

Claude Code **沒有**內建的「等額度重置後自動續跑」。
- `CLAUDE_CODE_RETRY_WATCHDOG=1` 只對容量型 429/529 無限重試；對「session 額度用完、
  幾點重置」這種額度型 429 會直接失敗。這個專案撞到的全是後者，所以它幫不上忙。
- `/loop`、`/schedule` 按時間表觸發，不理會限制狀態，解除前只會再撞一次。
- `claude --continue` / `--resume` 只還原對話記錄，不會重啟中斷的 subagent。

要無人值守就得自己 script：
    sleep $(( $(date -d "HH:MM" +%s) - $(date +%s) )) && \
    claude --continue -p "繼續跑 Plan 02，照 .superpowers/sdd/2026-09-07-02-domain-data/progress.md 接手"

實務上手動下那句話就夠了 —— 本檔就是為此存在的。

### Subagent 監控紀律（因為踩過坑才寫下來）

**判定一個 agent 死掉之前，一定先 `ListAgents`。** 它會顯示每個 subagent 是
running 還是 completed。只看 `git status` 沒有新 commit 就推論它掛了是錯的 ——
Plan 02 的 T2 就這樣被誤判：它其實跑了 3.3 小時還活著，我重派後一度有兩個
implementer 同時做同一個任務（流程明文禁止的事）。那次只產生一個 commit
是運氣，不是設計。

長時間等待時的檢查順序：
1. `ListAgents` —— 還在 running 就繼續等，不要動它
2. `git log --oneline -3 && git status --short` —— 看有沒有東西落地
3. 檔案 mtime（`ls -la` 相關目錄）—— 判斷它是在動還是卡住

只有在 `ListAgents` 顯示 completed / 不在列表上、而工作又沒完成時，才重派。
若它是卡在自己開的背景 job（Plan 01 的 T1 卡了三次），用 SendMessage 叫它
改跑前景，不要重派。


Spec: HANDOFF.md + docs/HANDOFF-AMENDMENTS.md (增補檔優先)
Branch: feat/02-domain-data, off main at 7b2f2c9 (Plan 01 merged as e44292f)
Plan 01's execution log preserved at docs/plan-01-execution-log.md (35 rulings).

## Pre-flight conflict scan

### 共用檔案的任務配對

| 檔案 | 任務配對 | 結果 |
| --- | --- | --- |
| `vitest.config.ts` | 只有 T6 修改（加 setupFiles） | OK，無配對衝突 |
| — | 其餘每個任務各自擁有自己的檔案，**沒有任何原始碼檔被兩個任務碰到** | OK。這與 Plan 01 相反（那裡 global.css 被四個任務依序改、App.tsx 被三個），風險低很多 |

### 介面配對

| 生產者 → 消費者 | 介面 | 結果 |
| --- | --- | --- |
| T1 → T2–T8 | `Category` `Txn` `Range` `Dimension` `Currency` `Person` 等型別、`constants.ts`、`PALETTE` | OK，T1 先行 |
| T1 → 全體 | `IconKey` 由 `../components/Icon` import | OK，Plan 01 已提供並已合併 |
| T3 → T5, T8 | `rangeOf` `previousRange` `inRange` `eachDay` `clampDay` `addMonths` `isoWeek` | OK |
| T4 → T5, T7 | `defaultCategories` `softDelete` `selectable` `resolveNames` | OK |
| T6 → T7 | `db` `OutboxItem` `resetDb` | OK |
| T7 → T8 | `ledgerRepo` `NewTxnInput` | OK |
| T2 → （無） | **`money.ts` 在 Plan 02 內沒有任何消費者** —— aggregate 不 import 它 | 見 R1 |

### 各任務自我一致性

| 任務 | 檢查 | 結果 |
| --- | --- | --- |
| T1 | palette 測試斷言每組 tint 亮度 > color 亮度 | OK，六組值由原型原始碼實測取得，符合 |
| T2 | `toCents` 走字面量解析而非 `Number(s)*100` | OK，計畫已修正（1.005 的浮點陷阱） |
| T3 | 測試寫死 2026 年特定日期的星期 | OK，撰寫計畫時已逐一驗算（9/1 週二、2/1 週日、6/1 週一） |
| T4, T5, T7 | 依賴 `crypto.randomUUID()` | **已實測**：jsdom 下可用，產出合法 v4 UUID |
| T2 | 依賴 `Intl.NumberFormat('en-CA')` | **已實測**：`2,050.00` / `5.20` 符合預期 |
| T5 | `isIncome(t, cats?)` 在沒給 cats 時退回 `mainName === '收入'` | 刻意設計，測試依賴它；見 R2 |
| T6 | Dexie 索引不含 `deleted`（布林不可靠索引） | OK，計畫已修正 |
| T7 | `totalsIn(txns, r, cats)` 三參數 | OK，計畫已修正簽名 |

## Rulings

- **R1** — `money.ts`（T2）在 Plan 02 內沒有任何消費者：`aggregate.ts` 只 import `types` 與 `date`。
  Ruling: 這是**刻意**的。money 的格式化函式是給 Plan 04–07 的畫面用的（月曆格 `$1.2k`、
  明細的 `-$5.20`、原幣小字、數字鍵盤輸入規則），領域聚合本身只需要整數加總。
  不因為「沒人用」就刪，也不因此把它硬塞進 aggregate。
  代價（若判錯）：它的正確性只由自己的單元測試背書，要到 Plan 04 才有整合驗證。

- **R2** — `aggregate.ts` 的 `isIncome` 在未傳 `cats` 時以 `mainName === '收入'` 判斷收支。
  Ruling: 保留。正解是查 `Category.kind`，字串比對只在冷啟動、分類表尚未載入的瞬間會走到。
  但這條 fallback 必須在程式碼裡註明，否則之後有人會以為字串才是主要判準。
  代價：若使用者把收入主分類改名，且在分類表載入前算了一次總額，那一瞬間會少算收入。

## Progress

Pre-flight probes run before Task 1 (written, run, deleted; tree verified clean):
  crypto.randomUUID() available under jsdom, returns valid v4 — T4/T5/T7 can rely on it.
  Intl.NumberFormat('en-CA') gives 2,050.00 / 5.20 as T2's money.ts expects.
Task 1: dispatched (haiku, BASE 7b2f2c9). Dispatch warns that the six colour sets are NOT
  in HANDOFF.md — they were measured from the prototype source — so the implementer does
  not grep the spec, fail to find them, and "correct" them.
Task 1: implementer DONE, commit 5fbcc08. Vitest 24/24, typecheck clean.
  Review verdict: spec ✅, quality Approved. One Minor deferred.
  Task 1: minor (deferred): colorSetOf's negative-index path is correct
    (((i % n) + n) % n) but no test exercises it. Add if a later task ever passes one.
  Ruling R3: the reviewer did NOT answer the layering question I put to it (domain
    importing from src/components/). I checked myself: types.ts uses
    `import type { IconKey } from '../components/Icon'` — a type-only import, which
    TypeScript erases entirely, so there is NO runtime dependency and the domain layer
    does not pull the Icon module (with its new URL() asset resolution) into any consumer.
    The reverse dependency is compile-time only. Acceptable as-is.
    Watch item: if anyone later changes this to a value import (e.g. to use ICON_KEYS for
    validation), a runtime dependency appears silently. Not worth a lint rule today.
    Cost if wrong: none — verified by reading the import form.
Task 1: complete (commits 7b2f2c9..5fbcc08, review clean)
Task 2: dispatched (haiku, BASE 5fbcc08).
Task 2: implementer DONE, commit 7f4e680. Vitest 37/37, typecheck clean.
  CONTROLLER ERROR (mine): I inferred the first T2 agent had died from `git status` alone
    and re-dispatched. It had not died — it ran 3.3 hours and was still live, so two
    implementers were briefly working the same task, which the process forbids. Only one
    commit resulted and the tree is clean, but that was luck. Monitoring discipline now
    recorded at the top of this file: ListAgents BEFORE concluding an agent is dead.
  Implementer self-declared one deviation: formatOriginal shows no decimals for whole
    dollars and two for fractional, because it says the brief's implementation contradicted
    the brief's own test. Handed to the reviewer to judge rather than accepted.
  Task reviewer dispatched (haiku) with five named risks, chief among them that toCents
    accepts `string | number` and the number path CANNOT avoid the float it exists to dodge
    — so toCents('1.005') and toCents(1.005) may disagree.
Task 2: review verdict — spec ❌ (1 Critical), quality "Needs fixes". Both defects are mine.
  Ruling R4: Critical "toCents(number) re-introduces the float trap" — UPHELD, and the fix
    is to DELETE the number overload rather than guard it. The three options the reviewer
    offered were remove / Number.isInteger guard / document+check. Removal is strictly best:
    a caller holding a number can write String(n), which routes through the literal parser
    and gets the right answer (String(1.005) -> '1.005' -> 101). A guard would still leave a
    signature that invites floats and then rejects them at runtime. Signature becomes
    toCents(input: string). Cost if wrong: callers must stringify; trivial and explicit.
  Ruling R5: Important "formatOriginal deviates from the brief" — the DEVIATION IS CORRECT
    and my plan text was wrong. My implementation returned `${formatCents(cents)} ${cur}`,
    which yields '1,280.00 TWD', but my own test in the same brief expects '1,280 TWD', and
    HANDOFF §4 says 「CAD 顯示 CAD，否則 1,280 TWD」. So the test and the spec agree with each
    other and against my implementation. Keeping the implementer's conditional-decimals
    behaviour, but requiring a comment citing §4 so the next reader does not "restore" the
    simpler version. Cost if wrong: none, spec-backed.
  Ruling R6: Minor 6 (formatOriginal computes dollars + cents/100 in floating point) folded
    into the same round. Building the string from integer division and modulo is both safer
    and shorter; leaving a float computation inside the module whose purpose is avoiding
    floats is indefensible even if toLocaleString currently absorbs it.
  Minors 3/4/5 (untested negative rounding boundary, formatCad at zero, pushDigit's
    decimal-at-limit case) folded in too — all are one-line test additions.
  Fix round 1 dispatched (FIX_BASE 7f4e680).
Task 2: fix round 1/5 (all addressed; commits 7f4e680..b6a0b27). Re-reviewer confirmed the
  overload removal is complete with its one callsite updated, and the rewritten
  formatOriginal drops all float arithmetic.
  Controller additionally verified the string-building boundaries the re-reviewer only
  covered in general terms: 4_005 -> '40.05 USD' (leading-zero cents), 4_050 -> '40.50',
  12_345_678 -> '123,456.78 TWD' (grouping with a fraction), 100_000 -> '1,000 TWD'
  (whole amount, no decimals). All four pass. Probe written, run, deleted; tree clean.
Task 2: complete (commits 5fbcc08..b6a0b27, review clean)
Task 3: dispatched (haiku, BASE b6a0b27).
Task 3: implementer DONE, commit e40da8e. Vitest 55/55, typecheck clean.
  Controller pre-verified before review: grep found no toISOString / Date.UTC / getUTC* /
  new Date('...') anywhere in date.ts — only explanatory comments mention them.
  Review verdict: spec ✅, quality Approved. 1 Important (coverage), 1 Minor.
  Reviewer confirmed the highest-value check: NO test expectation was adjusted to match the
  implementation — the test file is verbatim from the brief, including the 2026 weekday
  assertions and the 2027-01-01 -> 2026-W53 boundary. It also traced isoWeek's Thursday
  anchoring and confirmed the ISO year is derived arithmetically, not by luck.
  Ruling R7: the Important finding (previousRange('month') untested across the Jan->Dec
    year boundary) — UPHELD even though the reviewer's own wording calls it coverage rather
    than a defect. My calibration normally puts "coverage could be broader" at Minor, but
    this gap sits exactly where date code fails, the app will certainly run across a New
    Year, and the behaviour being relied on is JavaScript's `new Date(y, -1, 1)` rolling
    back a year — worth pinning rather than assuming. One test, one round.
    Cost if wrong: a round spent on a test that would never have caught anything.
  Fix round 1 dispatched (FIX_BASE e40da8e).
Task 3: fix round 1/5 (all addressed; commits e40da8e..068659b). Implementer reported DONE
  without committing; commit landed only after being asked. Controller had already verified
  the new test bites: removing the `- 1` from previousRange's month arithmetic turns both
  the September case and the new January case red.
  Re-reviewer independently recomputed the January expectation rather than trusting the
  assertion, and confirmed the Math.round comment describes what the code actually does.
Task 3: complete (commits b6a0b27..068659b, review clean)
Task 4: dispatched (haiku, BASE 068659b).

## === 段落點：2026-09-09，使用者重開機 ===

狀態：工作樹乾淨，本地與 origin 同步於 **3388d41**，Vitest **72/72**、typecheck 乾淨。

Task 4 在重開機前跑完並 commit 了 3388d41（16 個新測試）。
**但它還沒有經過 review** —— 這是接手後的第一件事，不是重派 Task 4。

### 下一步（按順序）

1. **先審 Task 4**：BASE `068659b`、HEAD `3388d41`。
   產 review package 後派 task reviewer。值得點名要它判斷的風險：
   - 六個預設支出分類的 icon／預算（整數分，租屋是 210_000 不是 2100）／子分類清單與順序
     是否逐項符合 HANDOFF §3
   - `resolveNames` 對**軟刪除**的分類是否仍解析得到名稱（統計裡的歷史帳靠這個）
   - 是否有任何操作改動了輸入物件（規格要求全部回傳新物件，store 靠 identity 比對）
   - `removeSub` 拒刪最後一個子分類時是否靜默回傳而非拋錯
   - 有沒有斷言其實不可能失敗
2. 有 findings 就 fix round → scoped re-review → 記 `Task 4: complete`
3. 接著 Task 5（統計聚合）、6（Dexie）、7（ledgerRepo）、8（Zustand store）
4. 八個任務都完成後跑整支分支 review，再合併到 main

### 重開機後的接手指令（在專案目錄開 Claude Code 後貼這句）

    繼續跑 Plan 02，照 .superpowers/sdd/2026-09-07-02-domain-data/progress.md 接手

Task 1–4 已完成，不要重派。

Task 4: implementer DONE, commit 3388d41. Vitest 72/72, typecheck clean, tree clean, pushed.
  It landed just before the reboot cutoff — an earlier ledger note calling it "interrupted"
  was written while it was still running and has been corrected.
  REVIEW NOT YET RUN. That is the next action, not a re-dispatch.
Task 4: review verdict — spec ✅, quality Approved, zero issues. Reviewer verified the six
  default categories item by item against HANDOFF §3 (including 超市's eight subcategories
  in order), confirmed resolveNames looks up by id with NO active filter so soft-deleted
  categories still resolve for historical statistics, and confirmed the soft-delete test
  actually exercises that lookup rather than merely asserting active === false.
Task 4: complete (commits 068659b..3388d41, review clean)
Task 5: dispatched (haiku, BASE 3388d41). Largest brief in the plan (477 lines).
Task 5: implementer DONE, commit 1f43283. Vitest 93/93, typecheck clean.
  Controller pre-verified: amountCents appears NOWHERE in aggregate.ts (all four summation
  sites use actualCadCents); the isIncome fallback carries its explanatory comment; the
  calendarCells zero-division guard is present.
  Review verdict: spec ✅, quality Approved, zero issues. Reviewer traced the subtlest
  property — budgetRows filters active, totalsIn does not — and confirmed the direction is
  right, so soft-deleting a category hides it from the budget list without altering any
  historical total. It also confirmed the exclusion test asserts a specific figure (207_195)
  that would shift to 217_194 or 212_195 if either filter broke.
Task 5: complete (commits 3388d41..1f43283, review clean)
Task 6: dispatched (haiku, BASE 1f43283). First task to add dependencies (dexie,
  fake-indexeddb) and to modify vitest.config.ts.
Task 6: implementer DONE, commit e7c1cf2. Vitest 100/100, typecheck clean.
  Controller pre-verified the config change was surgical (setupFiles added, environment/
  include/globals untouched) but spotted that the requested deletion of the dead
  build.assetsInlineLimit key had NOT happened. Handed to the reviewer as a thing to check
  rather than as a stated conclusion; it confirmed independently from the diff.
  Review verdict: spec ❌ on that one point, quality "Needs fixes". Otherwise clean —
  reviewer confirmed the outbox test pins seq monotonicity itself rather than merely
  observing an order, that nothing queries a boolean index, and that resetDb clears all
  four tables.
  Ruling R8: the missed deletion is Important, NOT Critical as the reviewer graded it.
    Critical in my calibration means it must not merge; a dead config key breaks nothing.
    What makes it worth a round is not the key but the pattern — an explicit instruction
    carried out silently not at all. One line, one round.
  Ruling R9: the reviewer said the `build` object should remain "for vite.config.ts
    alignment". I disagree and am overruling it: assetsInlineLimit is the only key inside
    it, so deleting just the key leaves `build: {}`, which is equally dead and equally
    misleading. Remove the whole block from vitest.config.ts. vite.config.ts keeps its own
    copy, which is real. Cost if wrong: none, an empty object has no behaviour either way.
  Minor folded in: the resetDb test only seeds and checks txns, so it would not catch a
    table added to the schema but forgotten in resetDb — exactly the failure mode that
    produces order-dependent test flakes later.
  Fix round 1 dispatched (FIX_BASE e7c1cf2).
  *** R8 and R9 REVERSED — I was wrong, and so was Plan 01's final review. ***
  The implementer refused to delete build.assetsInlineLimit and reported
  DONE_WITH_CONCERNS with evidence: "Icon.test.tsx fails without it". I verified directly:
  deleting the block makes Icon.test.tsx fail with
      AssertionError: expected 'data:image/svg+xml,%3csvg%20xmlns=...' to match /\.svg/
  Vitest resolves assets through Vite's transform pipeline, so assetsInlineLimit genuinely
  governs whether the 15 category SVGs resolve as file URLs or get inlined as data URIs.
  It is NOT dead config.
  Chain of error: Plan 01's whole-branch review called it dead (its Minor #10); I recorded
  that as a deferred minor without testing it; I then folded it into this task's dispatch as
  an instruction; and I graded the non-compliance as a missed instruction (R8) and overruled
  the reviewer's "keep the build object" advice (R9). Every step after the first inherited an
  unverified claim. The implementer was the only party that checked.
  Correction: the block stays. Asked the implementer to add a comment saying why, because
  the key has now been misidentified as dead twice and will be deleted on the third attempt.
  Lesson for the rest of this plan: a claim that some config is "dead" is a testable claim.
  Test it before acting on it — deleting is cheap to try and cheap to revert.
Task 6: fix rounds 1-2 (commits e7c1cf2..e1a21e4). Re-reviewer confirmed the explanatory
  comment is accurate and would deter a third deletion attempt, and that the widened resetDb
  test genuinely seeds and asserts all four tables — it also verifies each table is non-empty
  BEFORE the reset, so a silent seed failure cannot make it pass vacuously.
  The wrong claim was also corrected in docs/plan-01-execution-log.md (commit d920e23), since
  that file is committed evidence and a stale wrong claim there would mislead the next reader.
Task 6: complete (commits 1f43283..e1a21e4, review clean)
Task 7: dispatched (haiku, BASE d920e23). ledgerRepo — the single data entry point for UI.
Task 7: implementer DONE, commit 0aaf107. Vitest 112/112, typecheck clean.
  Controller pre-verified: all three write paths enqueue; bootstrap has its idempotence
  guard; the soft-delete-category test really computes totalsIn before and after.
  Review verdict: listed 3 Important + 3 Minor but graded "Approved".
  Ruling R10: I OVERRIDE the Approved verdict. Important means the task cannot be trusted
    until fixed; a report cannot list three of them and approve. Going with the findings.
  Ruling R11: Important "stale name snapshot when a category is renamed then the txn edited
    for an unrelated reason" — UPHELD, and my reasoning differs from the reviewer's.
    At first glance re-snapshotting looks WORSE: rename does not rewrite existing snapshots,
    so refreshing one row would make it disagree with its neighbours. But amendment C-2 says
    a rename triggers a best-effort batchUpdate of the Sheet's name column — and that batch
    updates the SHEET, not local Dexie. So local Dexie keeps the stale snapshot, and a later
    unrelated edit writes the old name back to the Sheet, silently undoing the batch for that
    row. Fix: re-snapshot on every update, unconditionally. Simpler than the condition it
    replaces. Cost: one extra category lookup per update.
  Ruling R12: Important "CAD -> TWD silently keeps the old actualCadCents" — UPHELD and it is
    the most serious of the three, because every statistic sums actualCadCents. Editing a
    $100 CAD entry to TWD without supplying a new actual charge leaves 10_000 cents that the
    user never entered, and it lands in the totals. Fix: throw when a patch changes the
    currency to a non-CAD value without supplying actualCadCents. Throwing from a repo is
    justified here — the entry sheet always posts the whole form, so this can only fire on a
    programming error, and failing loudly beats storing a wrong money figure.
  Ruling R13: Important "deleteCategory silently no-ops, updateTxn throws" — the
    inconsistency is real but the reviewer's framing is wrong. These are different operations
    with different natural semantics: an idempotent delete is a normal contract, while
    updating something that does not exist is genuinely an error. Keeping both behaviours,
    requiring a comment on each stating the choice and a test pinning it.
  Minor folded in: countTxnsOf queries mainId only, so passing a subId silently returns 0.
    Renaming the parameter to mainCategoryId plus a doc comment removes the trap.
  Fix round 1 dispatched (FIX_BASE 0aaf107).
Task 7: fix rounds 1-2 (commits 0aaf107..2c03f84). 117/117.
  Controller independently probed the two behavioural fixes with a throwaway suite (written,
  run, deleted; tree clean): CAD->TWD without actualCadCents throws AND leaves the record
  untouched (no partial write before validation — a failure mode nobody had asked about);
  supplying both fields succeeds; renaming 外食->餐飲 then editing only the note yields a
  stored mainName of 餐飲.
  Re-reviewer confirmed the currency guard's condition does not over-fire on the three
  legitimate edits (supplying actualCadCents alongside, amending an already-TWD amount,
  switching TO CAD), and caught that Important 3 was half-done — deleteCategory carried its
  contract comment but updateTxn did not. Round 2 fixed that.
  Ruling R14: I verified the round-2 comment myself rather than dispatching a third
    re-review agent. It is a documentation-only line with no behaviour to regress, and I
    confirmed both comments now read in parallel — 「找不到 id 時拋錯」 against
    「找不到 id 時無聲返回」. Recording the adjudication rather than making it silently.
    Cost if wrong: a comment could be inaccurate; I read it.
Task 7: complete (commits d920e23..2c03f84, review clean)
Task 8: dispatched (haiku, BASE 2c03f84). LAST task of Plan 02.
Task 8: implementer DONE, commit 7e9eb75. Vitest 127/127, typecheck clean.
  Controller independently probed the clamping (throwaway suite, run, deleted; tree clean):
  setMonth 1/31 -> 2026-02-28; goMonth(1) -> 2026-02-28; leap year -> 2024-02-29; year
  rollover correct both directions. The leap-year case is not in the plan's own tests.
  Review verdict: 1 Important + 2 Minor, graded "Approved" — the second time a reviewer has
  done that despite my prompt explicitly forbidding it. Going with the findings, not the grade.
  Ruling R15: Important "initial year/month/selectedDay go stale" — FINDING UPHELD, but the
    reviewer's proposed FIX IS WRONG and I verified it rather than applying it. It suggested
    moving `const now = parseDate(todayLocal())` inside create()'s initializer. Zustand calls
    that initializer exactly once, at create() time, i.e. at module load — so moving the line
    inside it changes nothing. Probed directly: a counter in the initializer reads 1
    immediately after import and stays 1 across repeated getState() calls.
    The real fix is a resume-time action (re-derive today when the PWA returns to the
    foreground), which belongs to the screen plan that owns visibilitychange handling, not to
    a store task. Adding an action nothing calls yet would be speculative.
    PARKED as a follow-up for Plan 04. Cost if wrong: a user who leaves the PWA open across
    midnight sees yesterday preselected until they navigate or reload — visible, not
    corrupting.
  Task 8: minor (deferred): updateTxn/setTab/setDimension/toggleNotify are untested simple
    setters; and updateTxn's map assumes the id is in the local list, so a store that had
    drifted (multi-tab) would silently not reflect a successful repo write.
Task 8: complete (commits 2c03f84..7e9eb75, 1 parked)
ALL 8 TASKS COMPLETE. Dispatching final whole-branch review.

## Final whole-branch review (opus)

Verdict: Needs fixes before merge. 0 Critical, 10 Important, 20 Minor.

  *** R2 REVERSED — I was wrong, twice over. ***
  I ruled the isIncome fallback (mainName === '收入') was safe because it is "only reachable
  before the category table loads". Both halves of that were wrong:
    (a) That state is UNREACHABLE. load() runs bootstrap() before reading txns, and sets both
        in one call, so txns never exist without categories.
    (b) A genuinely reachable path is far worse. Amendment §B-2 grants the user 自行新增更多
        收入主分類. The moment they add an income category named 副業, addTxn snapshots
        mainName:'副業' and any cats-less aggregate call books that income AS EXPENSE. Renaming
        the default 收入 does the same to every later row. All silent.
    (c) And omitting cats is the ergonomic default — optional on five functions, so TypeScript
        never objects.
  VERIFIED the reviewer's killer claim myself: replacing kindOf with () => 'expense' passes
  127/127. The income/expense split — the basis of every statistic — has never been exercised
  through the id path. Not one call in aggregate.test.ts passes cats.

  *** R11 AMENDED — my fix created a new defect. ***
  I required an unconditional re-snapshot in updateTxn to stop a stale name being written back
  to the Sheet. Correct as far as it went, but snapshot() returns '' when the id does not
  resolve, and now that path runs on EVERY update. Verified directly: hard-delete a category,
  update an unrelated note, and both name snapshots become ''. Amendment §C-1 designates the
  snapshot as the last line of defence for exactly that unresolvable row, so this destroys the
  thing it was meant to protect. Correct form: re-snapshot unconditionally, falling back to the
  CURRENT values rather than to empty strings.

  Ruling R16: all ten Important findings go into ONE fix wave. Ambiguous ones decided here:
    I6 (week multiplier depends on the tapped day) — the week's own Monday decides, so the
      multiplier is a property of the week rather than of the tap.
    I7 (makeCategory conflates order and colorSet) — split them: colorSet from a monotonic
      counter that never resets, order from the placement rule (top-insert = min(order) - 1),
      because §15.1-12 requires a new category to appear at the TOP.
    I8 (no entry time) — add createdAt now. Not indexed, so no Dexie version bump, and there
      is no live data to migrate. After Plan 08 ships the A–M Sheets layout this becomes a
      migration against real spreadsheets; the reviewer's cost argument is right.
    I9 (settings not persisted) — persist both toggles in the meta table, which exists, is
      tested, and holds nothing. Deciding it here rather than letting Plan 07 reach around
      the store.
  Ruling R17: of the 20 Minors, folding in the ones that are cheap AND either block a later
    plan or hide a defect: #1 English comments, #2 duplicated weekday labels, #4 dead txnsOn
    param, #5 comparePrevious sign at zero, #6 formatCad 'minus' mode (Plan 04 needs it),
    #9 stale test title, #14 store test isolation, #15 vacuous baseline, #16 unfalsifiable
    assertion, #18 crypto.randomUUID fallback (needed for §15.3's LAN iOS pass).
    The rest are recorded as deferred.
  ONE fix wave dispatched (sonnet, FIX_BASE 7e9eb75).
Final fix wave: all 10 Important + 10 Minor addressed (commits 7e9eb75..4ad3e71). 127 -> 143.
  Controller verified the decisive one itself: before the wave, mutating kindOf to
  () => 'expense' passed 127/127; after it, the same mutation FAILS 6 tests. The income/
  expense split is genuinely under test for the first time.
  Re-reviewer read the 1744-line diff in three passes and ran targeted greps for the
  regression I was most worried about — a call site satisfying the new required `cats`
  parameter with an empty array, which would have restored I1's silent misclassification
  while type-checking cleanly. None found.
  Ruling R18: the async-toggle judgment call — PARTIALLY UPHELD. The implementer's claim
    that state updates before the first await is correct (Zustand's set runs in the
    synchronous prefix, so subscribers re-render without awaiting). But an un-awaited call
    leaves a floating promise: if the IndexedDB write rejects, the in-memory toggle stays
    flipped while persistence silently fails. Dormant today — zero non-test call sites —
    and live the moment Plan 04 wires the settings screen. PARKED for Plan 04 rather than
    fixed here, because the right handling is a UI concern (surface the failure or roll back)
    and inventing it now with no consumer would be speculative.
    Cost if wrong: a settings toggle that appears to save but does not, on a device with
    IndexedDB restrictions.
  Parked also: addTxn still snapshots '' for an unresolvable mainId on a BRAND-NEW txn
    (pre-existing, correctly kept out of I2's scope, which covered updates).
ALL COMPLETE. Merging feat/02-domain-data to main.
