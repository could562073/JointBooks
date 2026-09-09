/**
 * HANDOFF.md §10 的手勢門檻，一個 preset 對應一個消費者。
 * 與 src/lib/motion.ts 的 DUR 是同一類東西：規格編號過的數值，集中一處，
 * 元件只寫 useDragGesture(GESTURE.monthSwipe, { ... })，不重抄數字。
 */

export type GesturePreset = {
  /** 主軸；另一軸的位移用來判斷是否放棄 */
  axis: 'x' | 'y';
  /** 超過這個位移才接管手勢並 setPointerCapture；0 = 按下即接管 */
  takeoverPx: number;
  /** 跟手比例，1 = 1:1 */
  followRatio: number;
  /** 允許範圍；null = 該端無界 */
  min: number | null;
  max: number | null;
  /** 超出範圍後的位移倍率（§10 通則：0.3～0.5） */
  damping: number;
  /** 放手位移超過此值即吸附 */
  snapDistancePx: number;
  /** 放手速度超過此值即吸附，px/ms */
  snapVelocity: number;
  /** 位移小於此值視為點擊；0 = 不判定 */
  tapPx: number;
  /** 另一軸位移超出主軸這麼多就放棄手勢；null = 不放棄 */
  abandonPx: number | null;
};

export const GESTURE: Record<
  'calendarHandle' | 'monthSwipe' | 'categoryCard' | 'panelDismiss' | 'pullRefresh',
  GesturePreset
> = {
  /** #13 月曆收起／展開。按下即接管，因為把手本身沒有其他可點目標 */
  calendarHandle: {
    axis: 'y', takeoverPx: 0, followRatio: 1,
    min: null, max: null, damping: 0.4,
    snapDistancePx: 138, snapVelocity: 0.4,
    tapPx: 6, abandonPx: null,
  },

  /** #7 月曆左右滑換月。10px 門檻是為了不攔掉日期格的點擊（§11-15） */
  monthSwipe: {
    axis: 'x', takeoverPx: 10, followRatio: 0.55,
    min: null, max: null, damping: 0.4,
    snapDistancePx: 56, snapVelocity: 0.35,
    tapPx: 0, abandonPx: 18,
  },

  /** #15 分類卡左滑露出刪除鍵。同樣需要 10px 門檻，否則卡內按鈕收不到 click */
  categoryCard: {
    axis: 'x', takeoverPx: 10, followRatio: 1,
    min: -84, max: 0, damping: 0.3,
    snapDistancePx: 42, snapVelocity: 0.35,
    tapPx: 0, abandonPx: null,
  },

  /** #22 邀請面板／#35 記一筆面板，把手下滑關閉。不往上超過 0 */
  panelDismiss: {
    axis: 'y', takeoverPx: 0, followRatio: 1,
    min: 0, max: null, damping: 0.4,
    snapDistancePx: 110, snapVelocity: 0.4,
    tapPx: 0, abandonPx: null,
  },

  /** #27 下拉重整。上限 64px，全程阻尼 .5 */
  pullRefresh: {
    axis: 'y', takeoverPx: 0, followRatio: 1,
    min: 0, max: 64, damping: 0.5,
    snapDistancePx: 64, snapVelocity: 0.4,
    tapPx: 0, abandonPx: null,
  },
};
