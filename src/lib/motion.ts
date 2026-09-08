/**
 * HANDOFF.md §10 的動畫通則與時長，集中在此。
 * 每個消費端請在註解標上 MOTION 編號，驗收時要逐條對照。
 */

export const EASE = {
  /** 進場（彈出、滑入、展開） */
  enter: 'cubic-bezier(.2,.8,.2,1)',
  /** 頁面／大區塊位移與手勢回彈 */
  move: 'cubic-bezier(.22,1,.36,1)',
  /** 記一筆面板進場專用 */
  sheet: 'cubic-bezier(.32,.72,0,1)',
  /** 離場 */
  exit: 'ease-out',
} as const;

export const DUR = {
  sheetIn: 340,        // #1  記一筆面板進場
  sheetOut: 260,       // #2  記一筆面板離場
  scrimSheetIn: 200,   // #1  遮罩淡入
  scrimSheetOut: 220,  // #2  遮罩淡出
  keyPress: 140,       // #3  數字鍵按壓
  riseIn: 320,         // #4 #5 #17 卡片浮現
  riseStagger: 35,     // #5  逐張延遲（第 8 張後不再遞增）
  calCellPop: 300,     // #4  月曆格金額 scale 1→1.12→1
  slide: 420,          // #7 #8 #9 #10 #14 #32 #34 方向性水平滑動
  slideBack: 300,      // #7  手勢未達門檻的彈回
  calSnap: 340,        // #6 #13 選中滑塊位移／月曆收展吸附
  countUp: 900,        // #11 #31 收支數字 count-up
  dayTotal: 480,       // §11-20 當日總額
  trendDraw: 600,      // #11 折線 stroke-dashoffset
  budgetFill: 600,     // #12 預算條填充
  budgetStagger: 50,   // #12 每條延遲
  budgetFlash: 200,    // #12 超支閃紅
  popIn: 240,          // #18 #20 #24 #38 小面板展開
  chevron: 220,        // #20 #33 #38 ▾ 旋轉
  morph: 200,          // #19 pill → 輸入欄
  morphPop: 240,       // #19 ✓ 後 scale 1→1.06→1
  dialogIn: 220,       // #16 #37 確認窗 scale .94→1
  scrimIn: 180,        // #16 #37 確認窗遮罩
  rowCollapse: 260,    // #16 #37 卡片／列高度收合
  cardSnap: 380,       // #15 分類卡左滑回彈
  toggleKnob: 220,     // #21 開關 knob
  panelSnap: 260,      // #22 #35 面板下滑關閉／彈回
  copyFeedback: 200,   // #23 複製回饋轉色
  copyRevert: 2200,    // #23 2.2s 後復原
  toastIn: 280,        // #25 toast 進場
  toastHold: 6000,     // #25 停留 6s
  toastOut: 220,       // #25 toast 離場
  syncSpin: 900,       // #26 同步中圓環
  syncSettle: 200,     // #26 完成縮回
  pullSpin: 700,       // #27 下拉重整轉一圈
  pullSettle: 300,     // #27 回彈
  fabPress: 120,       // #28 懸浮 ＋ 按下
  fabRelease: 180,     // #28 鬆手回彈
  breathe: 3400,       // #30 呼吸（3.2–3.6s）
  reduced: 120,        // prefers-reduced-motion 統一時長
} as const;

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** 取實際要用的時長；reduced-motion 時一律 120ms */
export function d(ms: number): number {
  return prefersReducedMotion() ? DUR.reduced : ms;
}
