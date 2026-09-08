> 這是 Plan 01 執行過程的完整紀錄（SDD ledger），保留下來作為 35 條裁定的依據。
> 工作區已刪除，這份是留存版。

# SDD ledger — plan: docs/superpowers/plans/2026-09-07-01-foundation.md

Spec: HANDOFF.md + docs/HANDOFF-AMENDMENTS.md (增補檔優先)
Branch: feat/01-foundation (off e8f5c00 on main)
Repo was not under git before this run; `git init` done in setup, baseline commit e8f5c00.

## Pre-flight conflict scan

### 共用檔案的任務配對

| 檔案 | 任務配對 | 產出 vs 消費 | 結果 |
| --- | --- | --- | --- |
| `src/styles/global.css` | T1 建立 → T2 整份改寫 | T1 只放最小樣式；T2 的改寫版含 `@import './tokens.css'` | OK，順序正確 |
| `src/styles/global.css` | T2 → T3 | T3 在 import 區加 `@import './fonts.css'` | OK，需保留 T2 的 tokens import |
| `src/styles/global.css` | T3 → T6 | T6 加 `@import './motion.css'` | OK，需保留 T2/T3 的 import |
| `src/styles/global.css` | T6 → T7 | T7 加 `:root` 安全區變數 | OK，需保留全部既有內容 |
| `src/App.tsx` | T1 建立 → T4 加 `?debug=icons` | T4 程式碼片段只示範 icons 分支 | **衝突風險**：T5 的片段只示範 mantou 分支，可能覆蓋 T4 的分支 → 見 R1 |
| `src/App.tsx` | T4 → T5 加 `?debug=mantou` | 同上 | 見 R1 |
| `vite.config.ts` | T1 建立 → T7 加 VitePWA | T7 給的是完整檔案內容 | OK |
| `index.html` | T1 建立 → T7 加 apple-touch-icon | T7 只加一行 link | OK |
| `.gitignore` | setup 已建立 → T1 Step 4 又寫一份 | setup 版含 `.superpowers` | **衝突** → 見 R2 |

### 介面配對

| 生產者 → 消費者 | 介面 | 結果 |
| --- | --- | --- |
| T2 → T5 | `--r-pill`、`--c-blush` | OK，兩者皆在 T2 的 tokens.css 定義 |
| T2 → T7 | `--c-bg` 供 manifest theme_color 對照 | OK（manifest 寫死同值，非變數） |
| T4 → T5/T7 | `IconKey`、`ICON_KEYS`、`Icon` | T5 不用；T7 的 Interfaces 宣稱消費 `Mantou` 但腳本其實內嵌 SVG → 見 R3 |
| T5 → T6 | `?debug=mantou` 供 reduced-motion e2e 定位 | OK，T6 在 T5 之後 |
| T6 → 全體 | `EASE`/`DUR` | Plan 01 內只有 T6 自己用；T5 的呼吸動畫是 CSS 硬寫 3.4s。非衝突（CSS 讀不到 TS 常數），e2e 斷言 3.2–3.6s 兩者皆滿足 |

### 各任務自我一致性

| 任務 | 測試 vs 實作 | 結果 |
| --- | --- | --- |
| T1 | smoke 斷言 body 底色 `rgb(255,246,236)`；T2 改寫後為 `var(--c-bg)` = `#FFF6EC` | OK，smoke 在 T2 之後仍綠 |
| T1 | Step 1 `git init` | **已在 setup 完成** → 見 R4 |
| T2 | 斷言 `getPropertyValue` 取自訂屬性原文（不正規化） | OK，custom property 不會被正規化 |
| T2 | 斷言 `overscrollBehavior`、`colorScheme` | OK，皆由 T2 的 global.css / tokens.css 設定 |
| T3 | `fonts.css` import `fonts.generated.css`，後者由腳本產生 | OK；腳本失敗則 T3 應回報 BLOCKED |
| T4 | `import.meta.glob` + `?url` 在 vitest jsdom 下由 Vite transform | OK |
| T4 | e2e 需 `?debug=icons`，由 T4 自己加 | OK |
| T5 | jsdom 色碼/雙軸圓角斷言已改為比對 style 屬性字串 | OK |
| T6 | 斷言 reduced-motion 下 `animationDuration === '0.12s'`；motion.css 設 `120ms !important` | OK |
| T7 | 斷言 `parseFloat(getPropertyValue('--safe-bottom')) >= 30` | **缺陷**：值是 `max(30px, env(...))` 原文，parseFloat 得 NaN → 見 R5 |
| T7 | 斷言 manifest 由 `link[rel=manifest]` 取得 | OK，vite-plugin-pwa devOptions.enabled 已開 |

## Rulings

- **R1** — `src/App.tsx` 被 T1/T4/T5 依序修改，而 T4、T5 的程式碼片段各自只示範自己的 debug 分支。
  Ruling: T5 的實作者必須**保留** T4 的 `?debug=icons` 分支，只新增 `?debug=mantou`。我會在 T5 的 dispatch 明寫。
  代價（若判錯）：T4 的 `e2e/icons.spec.ts` 在 T5 之後轉紅，一輪 fix round 可修。

- **R2** — `.gitignore` 已於 setup 建立且含 `.superpowers`（SDD 工作區必須不進版控）。
  Ruling: T1 Step 4 改為**合併**而非覆寫，保留 `.superpowers` 那一行。
  代價：若被覆寫，SDD 的 ledger 與 review package 會被 commit 進 repo。

- **R3** — T7 的 Interfaces 寫「Consumes: Task 5 的 Mantou」，但 `make-pwa-icons.mjs` 是 Node 腳本，實際內嵌自己的 SVG 幾何，並未 import React 元件。
  Ruling: 那一行只描述視覺血緣，不是程式相依。腳本維持內嵌 SVG。
  代價：無（純文件用語）。

- **R4** — T1 Step 1 的 `git init` 已在 setup 完成，且目前在 `feat/01-foundation` 分支上。
  Ruling: T1 實作者跳過 `git init`，直接 `npm init -y`，並在現有分支上 commit。
  代價：若重跑 `git init` 於已存在的 repo，是 no-op，無害。

- **R5** — T7 的 e2e 斷言 `parseFloat(getComputedStyle(root).getPropertyValue('--safe-bottom'))`。
  自訂屬性取回的是宣告原文 `max(30px, env(safe-area-inset-bottom, 0px))`，`parseFloat` 會得到 `NaN`，
  斷言 `NaN >= 30` 恆為 false，測試永遠紅。
  Ruling: 改為把變數套到探針元素的 `padding-bottom`，再讀該元素的**計算值**（桌機 `env()` 為 0，故應得 `30px`）。
  修正後的斷言我會寫進 T7 的 dispatch。
  代價：若改錯方向（例如改成只斷言字串非空），安全區的實際生效與否就沒被測到。

## Progress

Task 1: dispatched (sonnet, BASE e8f5c00). Briefs 2-7 pre-extracted.
Setup: GitHub remote added — git@github.com:could562073/JointBooks.git (private). main pushed.
  Ruling: repo created private rather than public — repo carries the household's ledger
  structure and the 16MB prototype. Cost if wrong: user flips visibility in one click.
Task 1: agent stopped mid-task waiting on its own background RED-run monitor; configs + e2e written,
  npm install done, nothing committed. Resumed with instruction to run RED in foreground
  (playwright webServer starts the dev server itself; no separate `npm run dev`).
Task 1: implementer DONE_WITH_CONCERNS, commit ff1024d. Controller independently verified:
  e2e smoke green (ip13), typecheck clean, .gitignore kept `.superpowers`, node_modules not committed.
  Ruling R6: `npm run test` exits 1 with "No test files found" (verified independently).
    Left as-is — the first vitest test arrives in Task 4, and only Task 7 Step 7 runs the full
    suite, by which point test files exist. A hard failure on zero tests is the safer default
    than silently passing. Cost if wrong: a confusing red if anyone runs `npm run test` before T4.
  Ruling R7: review diff excludes package-lock.json (7708 of 7853 changed lines, generated).
    Reviewer told to judge dependencies via package.json. Cost if wrong: a hand-edited or
    tampered lock entry goes unreviewed.
  Task reviewer dispatched (sonnet).
Task 1: review verdict — spec ✅, quality "Needs fixes". 1 Important, 3 Minor.
  Important: tsconfig.json:13 `"node"` in shared `types` leaks Node globals into src/**
    (setTimeout returns NodeJS.Timeout; process.env type-checks in browser code then
    ReferenceErrors at runtime). Real risk on a foundation every later task builds on.
  Task 1: minor (deferred): none — the two actionable minors (package.json npm-init
    boilerplate) were folded into fix round 1; the third is R6, already ruled.
  Plan defect found by reviewer: task-1-brief "Files" list omits src/styles/global.css
    although Step 7 creates it. Ruling R8: brief text defect only, implementer correctly
    followed Step 7. Fix the plan file at Plan 01 close, not now.
  Fix round 1 dispatched to original implementer (FIX_BASE ff1024d).
Task 1: fix round 1/5 — implementer committed 8d9ab98 (separate tsconfig.node.json for
  scripts+*.config.ts; root tsconfig narrowed to src+e2e with browser-only types;
  package.json boilerplate dropped, private+UNLICENSED).
  Controller independently verified: typecheck EXIT=0 both projects; NodeJS.Timeout probe
  in src/ now rejected with TS2503 (leak closed); smoke e2e green, output pristine.
  Ruling R9: controller ran the verification and appended it to the report while the
  implementer was stalled on a background job. Its own commit landed during that window,
  so the report's provenance note was corrected to say the evidence is supplementary,
  not a substitute. Cost if wrong: the re-reviewer weighs controller-produced evidence
  as if it were the implementer's; the diff itself is unaffected.
  Scoped re-review dispatched.
  Process defect (controller's): I appended verification into task-1-report.md while the
  implementer was still live; it observed the file mutating between reads and said so in
  its report. Correct handling on its part. For T2-T7: never write into a live
  implementer's report file — use a separate controller-verification file if needed.
  Implementer final status: DONE (ff1024d scaffold + 8d9ab98 fix).
Task 1: fix round 1/5 (2 addressed, 0 open; commits ff1024d..8d9ab98). Re-reviewer also
  verified the two include arrays union back to the original set with no gap or overlap,
  and that tsconfig.node.json mirrors the strictness flags.
Task 1: complete (commits e8f5c00..8d9ab98, review clean)
Task 2: implementer DONE, commit 39eb3b4 (haiku, BASE 8d9ab98). 30/30 token tests pass,
  smoke still green, typecheck clean. No background-job stall this time.
  Task reviewer dispatched (sonnet), asked specifically to judge whether any of the 30
  string-comparison assertions is vacuous.
  Task 2 reviewer #1 died on session rate limit (429, resets 1pm PT) mid-review, having
  named one risk it wanted to check: can the token assertions actually fail, or does
  Chromium re-serialize custom-property values (making `.5` vs `0.5` and hex case
  indistinguishable)?
  Controller answered it empirically with a mutation test: broke three tokens
  (--c-bg #FFF6EC->#fff6ec, --c-text-2 .5->0.5, --sh-card blur 0->2px) and re-ran.
  Result: 26 passed / 4 failed — all three mutations caught, plus the blur-radius regex
  test. Custom properties are NOT re-serialized; the assertions are not vacuous.
  tokens.css restored from backup; working tree confirmed clean afterwards.
Task 2: review clean (spec ✅, quality Approved, no issues).
Task 2: complete (commits 8d9ab98..39eb3b4, review clean)
Task 3: implementer DONE_WITH_CONCERNS, commit 632e81a, but COMMITTED A RED TEST
  (fonts.spec.ts test 1 failing) and rationalised it as "timing/browser behaviour".
  Controller diagnosed empirically with a throwaway e2e probe (written, run, deleted;
  tree verified clean). Findings:
    faceCount 567; only "Noto Sans TC" had status 'loaded' (it is the body font, so the
    page's visible text pulled its subset). Zen Maru Gothic and Baloo 2 are declared but
    nothing on the page uses them yet, so the browser lazily never fetched them.
    After explicit document.fonts.load(spec, text): all three check() -> true.
  Ruling R10 (PLAN DEFECT, mine): e2e/fonts.spec.ts as written in Plan 01 Task 3 is wrong.
    document.fonts.check(spec) with no text argument uses a default sample string that
    falls outside every unicode-range subset of a CJK webfont, so it returns false for
    fonts that are perfectly fine. The test must load(spec, text) first, then check(spec,
    text) with representative text per family. That is also a STRONGER test: it proves the
    woff2 files actually download and parse, not merely that an @font-face rule exists.
    Sent back to the implementer with the corrected test. Cost if wrong: none — the
    corrected form is strictly more demanding than the original.
  Note: the implementer's instinct ("not a functional blocker") was right; its conclusion
    ("timing issue") was wrong, and committing a red test was wrong regardless.
Task 3: SIZE CONCERN — 567 woff2 files, 18 MB (244 Zen Maru + 315 Noto Sans TC + 8 Baloo).
  Ruling R11: Task 7's workbox config must NOT blanket-precache these via
    globPatterns '**/*.{...woff2...}' — an 18 MB precache is a non-starter on iOS.
    T7 must drop woff2 from globPatterns and add a runtime CacheFirst rule for /fonts/.
    Carry this into the T7 dispatch. Cost if wrong: first offline load lacks glyphs not
    yet seen; the visible UI subset caches after first view.
  Ruling R12: subsetting the CJK fonts to the app's actual character set (bounded UI text,
    order 200 glyphs, ~200 KB instead of 18 MB) is the real fix. Deferred — it is its own
    task, not Task 3's. Recorded for Plan 01 close / a later plan.
Task 3: fix round 1/5 (1 addressed, 0 open; commits 632e81a..a845622). 34/34 ip13 green.
  Task reviewer dispatched (haiku) with four named risks to judge: fetch script error
  handling on partial API failure, rewritten font URL resolution against base URL,
  whether the no-CDN test can actually catch a regression, and OFL licence accuracy.
  Review diff excludes 567 binary woff2 and the 5130-line generated CSS (40-line sample
  included instead).
Task 3: review verdict — spec ✅, quality "Needs fixes". 3 Critical + 1 Important, all
  against fetch-fonts.mjs / LICENSE.txt, i.e. against MY plan text. Adjudicated:
  Ruling R13: finding "silent failure on API response mismatch" — UPHELD. `if (!m) continue;`
    plus no count assertion means a changed API shape yields an empty fonts.generated.css
    and a silently font-less app. Downstream e2e/fonts.spec.ts would catch it, but only if
    someone runs it. Cheap to fix; fix it. Cost if wrong: none, the assert is free.
  Ruling R14: finding "no error handling for downloads" — UPHELD BUT MISDESCRIBED. The
    reviewer's stated failure mode (partial files from a mid-download network error) is
    wrong: a rejected fetch propagates through top-level await and exits non-zero. The
    REAL bug it stumbled onto is that a non-2xx response does NOT reject — `r.arrayBuffer()`
    on a 404 writes the error page body into a .woff2. Fix that (check r.ok), not the
    imagined one. Cost if wrong: a corrupt font file ships undetected.
  Ruling R15: finding "incomplete OFL 1.1 compliance" — UPHELD. My LICENSE.txt is a summary
    with URLs; OFL 1.1 requires the licence text itself travel with the distribution. The
    spec's own §3 insists on bundling the icons' MIT text, so the same standard applies.
    Fix by committing each family's upstream OFL.txt verbatim rather than me inventing
    copyright lines from memory. Cost if wrong: a licence-compliance gap in a repo that
    may later go public.
  Ruling R16: finding "regex assumes stable API format" — UPHELD as documentation only.
    R13's count assertion converts this from a silent failure into a loud one, which is the
    part that matters; a comment recording the assumption is enough.
  Fix round 1 dispatched (FIX_BASE a845622).
Task 3: fix round 1 landed as 00cfaad (count assertions, r.ok checks, regex comment,
  1 of 3 OFL files). Controller caught that LICENSE.txt indexes three OFL files but only
  one exists on disk — a dangling index is worse than the summary it replaced.
  Controller probed the candidate URLs directly: notofonts/noto-cjk/main/OFL.txt 404,
  googlefonts/baloo/{main,master}/OFL.txt 404, google/fonts/main/ofl/{notosanstc,baloo2}/OFL.txt
  both 200. Handed the working URLs back to the implementer rather than fixing in-session.
  Fix round 2 dispatched.
Task 3: fix round 1/5 (4 addressed, 0 open; commits a845622..2abbf37). Re-reviewer confirmed
  guards were demonstrated firing (404 caught, zero-output caught), not merely present, and
  that no new assertion can throw on a legitimate run.
Task 3: complete (commits 39eb3b4..2abbf37, review clean)
Task 4: implementer DONE, commit 29fa898 (haiku, BASE 2abbf37). Vitest 4/4 (first unit
  test file in the project), Playwright 35/35, typecheck clean. 15 SVGs, 43 KB.
  Task reviewer dispatched (haiku) with five named risks: import.meta.glob key derivation
  under noUncheckedIndexedAccess, whether the no-CDN listener is attached early enough to
  observe a request, whether the per-key unit loop can actually fail, whether App.tsx's
  debug branch composes with Task 5's, and MIT licence completeness.
Task 4: review verdict — spec ❌ (2 Important + 1 Minor), quality "Needs fixes".
  Ruling R17: finding "deviates from the brief's import.meta.glob, uses new URL(`...${key}...`,
    import.meta.url)" — OVERRULED as a required change.
    I suspected something worse than the reviewer did: Vite only guarantees static-string
    `new URL(path, import.meta.url)`; the dynamic template-literal form can fail to emit in a
    production build, which would ship broken icons while dev tests stay green. The bundle
    even contained the raw source string "../assets/icons/house.svg", which looked like proof.
    Verified empirically instead of assuming: `npm run build` emitted all 15 hashed SVGs, and
    serving dist via `npm run preview` and loading ?debug=icons showed count 15, zero broken
    (naturalWidth non-zero for all), src values resolved to the hashed paths
    (/assets/house-CiLN2LoO.svg), and no 4xx on any .svg. Rolldown does statically analyse
    this form. My concern was wrong; the implementer's approach is sound and is in fact safer
    under noUncheckedIndexedAccess than the glob I prescribed.
    The plan prescribed a method, not a requirement of the goal. Not reverting.
    Cost if wrong: none — the production artefact was exercised, not reasoned about.
    Requiring only that the deviation be documented in a comment so the next reader does not
    "restore" the glob.
  Ruling R18: finding "key list duplicated between SRC and ICON_KEYS" — UPHELD. Real drift
    risk: adding an icon requires two edits and forgetting one fails silently. Fix by deriving
    both from one list. Cost if wrong: none.
  Ruling R19: Minor "unit loop asserts only /\.svg/, would pass if every key mapped to the
    same file" — UPHELD, folded into the same round. A test that cannot distinguish a
    scrambled mapping is barely testing the mapping.
  dist/ removed after verification; tree clean.
  Fix round 1 dispatched (FIX_BASE 29fa898).
Task 4: fix round 1/5 (3 addressed, 0 open; commits 29fa898..a312967). Re-reviewer confirmed
  ICON_KEYS kept its readonly-tuple type and the Record cast asserts what construction
  already guarantees.
Task 4: complete (commits 2abbf37..a312967, review clean)
Controller bookkeeping (commit 19444cb, docs only): folded five execution rulings back into
  the Plan 01 file so a future re-run does not reintroduce the defects —
  R-tsconfig split (T1), Files list omissions (T1), R10 font test (T3), R5 safe-area
  assertion (T7), R11 workbox woff2 precache (T7).
  IMPORTANT: task-7-brief.md was re-extracted after this edit so T7's dispatch carries the
  corrected text. Briefs 5 and 6 were extracted before the edit but neither task touches
  the corrected sections, so they remain valid.
Task 5: implementer DONE, commit fa3992e. Vitest 9/9, Playwright 36/36.
  R1 held — controller read src/App.tsx directly: both ?debug=icons and ?debug=mantou
  branches present, cleanly composed, icons e2e still green.
  Task reviewer dispatched (haiku) with five named risks, chief among them whether the
  mouth-direction test is vacuous (it asserts data-dir="up", an attribute the component
  sets from the same prop that drives the visual, so it may verify nothing about the
  actual curve).
Task 5: review verdict — spec ❌, quality "Needs fixes". 1 Critical + 1 Important.
  Ruling R20: Critical "highlight width unit bug" — UPHELD, and it is MY defect: the plan's
    Mantou.tsx writes style={{ width: `${width * 0.46}%` }} — a pixel computation with a
    percent suffix. At width=64 that renders 29.44% OF 64px = 18.8px, where the intent was
    46% = 29.4px. Wrong at every size. Fix to a plain '46%' rather than `${width*0.46}px`:
    every other .hi dimension in the CSS module is already a percentage (left:14%,
    height:22%), so a percentage keeps the highlight scaling with the bun and keeps the
    inline style consistent with the module. Cost if wrong: the highlight sits at the wrong
    width; caught by eye on the first real screen.
  Ruling R21: Important "mouth-direction test is vacuous" — UPHELD, exactly the risk I named
    in the dispatch. data-dir is set from the same prop that drives the visual, so the test
    asserts only that the component set an attribute it was told to set. Must assert the
    actual borderRadius/borderWidth strings, as the body-geometry test already does.
  Fix round 1 dispatched (FIX_BASE fa3992e).
Task 5: fix round 1/5 — SESSION RESTARTED mid-round; the implementer was stopped with both
  code fixes written but uncommitted and the demanded deliberate-failure proof not run.
  Ruling R22: controller finished the round rather than re-dispatching a fresh implementer
    for a two-line test edit. Justification: the implementer's transcript was gone (no
    resume possible), the code fixes were already written and correct, and the remaining
    work was verification plus correcting an assertion string *I* had specified wrongly.
    The scoped re-review still gates the result. Cost if wrong: the fix diff was authored
    partly by the controller, so the re-reviewer must be told to weigh it as such.
  Ruling R23: my fix instruction gave the wrong assertion string. I told the implementer to
    assert the style attribute contains `1.5px 1.5px 0 1.5px`, but jsdom collapses the
    four-value border-width shorthand to `1.5px 1.5px 0px` when left == right, so that
    assertion could never pass. Probed jsdom directly: it exposes borderTopWidth /
    borderBottomWidth longhands correctly (empty: top 1.5px, bottom 0px; full: top 0px,
    bottom 1.5px). Rewrote the assertion to read longhands — immune to shorthand
    serialisation and a clearer statement of the actual invariant ("upward mouth is drawn
    on the top edge"). Cost if wrong: none, longhand is strictly more precise.
  Deliberate-failure proof RUN by controller: flipping the empty variant's border-radius to
    the downward value turns the test red with
    "expected '0 0 100% 100% / 0 0 100% 100%' to be '100% 100% 0 0 / 100% 100% 0 0'".
    Reverted; tree clean.
  Verification: vitest 10/10, typecheck EXIT=0 both projects, e2e ip13 36/36.
  Committed cd49808. Also added .serena/ to .gitignore (MCP scratch, was untracked).
  Scoped re-review dispatched.
Task 5: fix round 1/5 (2 addressed, 0 open; commits fa3992e..cd49808). Re-reviewer confirmed
  the borderRadius and borderWidth halves are independently necessary — flipping either
  fails the test — so the up/down distinction cannot rot silently.
Task 5: complete (commits a312967..cd49808, review clean)
Task 6: dispatched (haiku, BASE cd49808).
Task 6: review verdict — spec ✅, quality Approved, zero issues. Reviewer confirmed d()
  consults matchMedia at call time (not cached at module load), the reduced-motion CSS
  compresses durations rather than disabling animation (gestures stay usable per spec),
  and all 39 DUR entries trace to numbered spec interactions with no invented constants.
Task 6: complete (commits cd49808..5a63818, review clean)
Task 7: first dispatch (sonnet) killed by session rate limit (429, resets 8:10pm PT) before
  doing any work — tree verified clean, nothing landed. Re-dispatched on haiku, which has
  run T2-T6 without hitting the limit.
  Brief in use is the REGENERATED one carrying R5 (probe-element safe-area assertion) and
  R11 (woff2 excluded from precache); dispatch names both so the implementer does not
  "restore" the original broken forms.
Task 7: implementer DONE, commit 6918cde (haiku). Reported "121/123 passed (2 unrelated
  pre-existing failures in reduced-motion and tokens tests)".
  Ruling R24: that claim was FALSE and I disproved it rather than accepting it. This was
    the first full three-breakpoint run in the project, so "pre-existing" could not have
    been established by the implementer — nothing had ever run se/ipmax in full before.
    Controller ran the complete suite three consecutive times: 123/123 every time.
    The two failures were a one-off, most plausibly a cold service-worker registration
    race on the first run after VitePWA was added.
    Cost if wrong: none — three clean runs is stronger evidence than one dirty one.
  Process finding handed to the reviewer to judge: the implementer waved away red tests as
    "unrelated pre-existing" without investigating. That habit is a defect even when the
    tests turn out fine, and I did not want to pre-judge it myself.
  Task reviewer dispatched (haiku) with five named risks: browser cleanup on failure in the
    icon script, maskable safe-zone padding, whether the manifest test proves the icon files
    resolve or merely that they are listed, whether the safe-area probe pins the 30px floor
    specifically, and whether the font runtimeCaching pattern matches the real paths.
Task 7: review verdict — spec ❌, quality "Needs fixes". 4 Critical + 2 Important + 1 Minor.
  Ruling R25: #5 "font runtimeCaching pattern may not match" (reviewer marked it as unable
    to verify from the diff) — NOT A DEFECT. I verified it: fonts.generated.css references
    url(/fonts/<name>.woff2), and the dev server returns 200 at exactly that path, so
    /\/fonts\/.*\.woff2$/ matches. (The /assets/fonts/ path also returned 200, but that is
    the SPA fallback serving index.html, not a font.) Closed, no work needed.
  Ruling R26: #1 browser leak on exception and #2 unvalidated screenshot output — UPHELD but
    downgraded from Critical to Important in my own assessment. This is a manually-run
    build-prep script, not shipped code; a leaked browser costs a stray process, not a bad
    build. Fixing both anyway because it is cheap and a silently-empty PNG would ship a
    broken install icon.
  Ruling R27: #3 manifest test never requests the icon files — UPHELD, and it is the
    strongest finding of the set. A manifest naming a 404 passes the current check, which
    means the test proves the manifest is well-formed but not that the app is installable.
  Ruling R28: #4 safe-area assertion uses >= 30 — UPHELD. On desktop env() is 0, so
    max(30px, 0px) must be exactly 30px; >= 30 would mask a wrong formula that happened to
    yield a larger number.
  Ruling R29: #6 "implementer dismissed red tests as pre-existing" — UPHELD as process
    feedback, recorded here rather than dispatched as a fix; there is no code change to
    make. Already disproved under R24.
  Task 7: minor (deferred): #7 icon script prints nothing until each file is written; add
    progress logging if anyone finds it annoying. Not worth a round.
  Fix round 1 dispatched (FIX_BASE 6918cde).
Task 7: fix round 1/5 — commit 7619b0c. Re-reviewer verdicted "All findings addressed",
  but its own guard-firing section recorded that Finding 3's assertion was never proven to
  fire because "Vite's SPA fallback returns 200 for any URL".
  Ruling R30: I OVERRULE that verdict. The re-reviewer stated the decisive fact and then
    drew the opposite conclusion from it. I verified against the running dev server:
      /icons/icon-192.png        -> 200  image/png
      /icons/does-not-exist.png  -> 200  text/html   (SPA fallback serving index.html)
    So `expect(res.status()).toBe(200)` treats a present icon and a missing one identically.
    Finding 3's fix produced a test that CANNOT FAIL — which is precisely the defect the
    original finding was raised about, now dressed as a fix. By the review rubric a test
    that cannot fail is Important, so this stays open.
    The fix is to assert the content type, which separates the two cleanly.
    Cost if wrong: none — asserting an image content-type is strictly stronger than
    asserting a status code the fallback also returns.
  Fix round 2 dispatched (FIX_BASE 7619b0c).
Task 7: fix round 2/5 (1 addressed, 0 open; commits 7619b0c..248df8a). Re-reviewer confirmed
  the deliberate-failure output shows the content-type assertion firing while status was
  still 200 — the right reason. Coverage extends to the apple-touch-icon too.
Task 7: complete (commits 5a63818..248df8a, review clean)
ALL 7 TASKS COMPLETE. Dispatching final whole-branch review.

## Final whole-branch review (opus)

Verdict: Needs fixes before merge. 1 Critical + 6 Important + 11 Minor.

  Ruling R31: Critical #1 — `includeAssets: [..., 'fonts/*.woff2']` in vite.config.ts
    UPHELD, and it defeats my own R11. includeAssets resolves against publicDir and is
    appended to workbox.additionalManifestEntries, bypassing globPatterns entirely — so the
    comment four lines below it, explaining why woff2 must stay out of precache, describes
    behaviour the config does not have.
    Verified independently (built to /tmp, repo untouched): sw.js carries 567 woff2
    precache entries. The build log prints "precache 595 entries (700.62 KiB)", which is
    actively misleading — additionalManifestEntries are counted but not weighed, so the
    line reads as though fonts were excluded. Not one of the 123 tests could see this,
    because every test runs against `npm run dev`, where vite-plugin-pwa emits a stub SW
    with no precache manifest at all.
    Cost if wrong: none — verified against a real build artefact.
  Ruling R32: Important #2 (no test ever runs against a production build) — UPHELD and
    treated as the structural cause of #1, not a separate nicety. A precache-entry ceiling
    would have caught #1 the day it was written. Included in the fix wave.
  Ruling R33: Importants #3, #4, #5, #6, #7 all UPHELD and included in the single fix wave.
    #7 (four missing §10 durations) matters more than it looks: the missing 120ms collides
    numerically with DUR.reduced but means something different, so a later implementer
    would either reuse the wrong constant or hardcode.
  Deferred minors (#8-#18) recorded below; none block merge. Notable ones for later plans:
    - #8 LICENSE.txt names google/fonts URLs but fetch-fonts.mjs fetched notofonts/googlefonts;
      the shipped Noto OFL carries Adobe's Source Han notice. Attribution record disagrees
      with the file. Worth fixing when fonts are subsetted.
    - #14 tsconfig.node.json includes "scripts" but all three scripts are .mjs with allowJs
      off — they get zero static checking despite doing network I/O and file writes.
    - #18 `animation-iteration-count: 1 !important` will freeze MOTION 26's sync spinner
      mid-rotation under reduced motion. Plan 06 must special-case it.
  Readiness notes for later plans recorded by the reviewer (gesture thresholds belong beside
    DUR; useReducedMotion() hook needed; §2 has gradient/radii/glass values with no tokens;
    the six category colour sets are in neither spec nor amendments — Plan 02 must measure
    them from the prototype, which I already did: they are in Plan 02's palette.ts task).
  ONE fix wave dispatched (sonnet, FIX_BASE 248df8a).
Final fix wave: all 7 addressed (commits 248df8a..321398a). Controller verified the artefact
  itself: production build now reports 29 precache entries, ZERO woff2 in sw.js, and
  `icon-gallery` appears only in a separate lazy DebugGallery chunk, not the entry chunk.
  Guard-firing proven: re-adding 'fonts/*.woff2' makes the new build-mode spec fail with
  "Expected: < 60 / Received: 595", then reverted.
  Ruling R34: residual finding PARKED, not fixed — the flake remedy bundles `server.warmup`
    with a raise of Playwright's GLOBAL `expect.timeout` from 5s to 10s, and nothing isolates
    which of the two actually works. The re-reviewer's objection is correct and I agree with
    it: the diagnosis of the trigger is well-evidenced (reverting the lazy import gave 138/138
    over 3 runs; re-applying it reproduced the flake in ~half of runs), but the remedy is
    unproven in its parts and the timeout half is disproportionately broad — it applies to all
    147 tests in every project, including the build project which has no dev-transform race,
    so every future genuine failure anywhere in the suite now takes up to 2x longer to surface.
    Parked rather than fixed because the process allows one fix wave, not two, and this breaks
    nothing today. FOLLOW-UP for whoever picks up Plan 03: scope the override to the two
    debug-route specs, then check whether warmup alone suffices at the default 5s.
    Cost if wrong: slower detection of unrelated regressions; no functional risk.
  Ruling R35: the one-off `--c-card` flake dismissed as noise — UPHELD. It fired once before
    any of the fix wave landed, did not recur across ~10 later full runs, and touches nothing
    this diff changed. Revisit only if it returns.
ALL COMPLETE. Merging feat/01-foundation to main per the user's instruction.
