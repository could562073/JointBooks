import { GESTURE } from '../../lib/gesture';
import type { GesturePreset } from '../../lib/gesture';

/** §10 #15：左滑最大 84px 露出刪除鍵 */
export const CARD_OPEN_X = GESTURE.categoryCard.min ?? -84;

/**
 * 把 preset 的邊界平移到目前的基準位置。
 *
 * 手勢引擎回報的位移是「這一次拖曳的變化量」，而 preset 的 min/max 寫的是
 * 卡片的**絕對位置**（§10 #15：「超出原位或超過 84px 才套阻尼」）。卡片已經
 * 展開在 -84 時，往右拖 60px 的變化量是 +60，用原 preset 會被當成越過 max=0
 * 而套上阻尼——但它其實只是往回走，完全在合法範圍內。
 *
 * 邊界跟著基準平移之後：關閉時（base 0）等同原 preset，展開時（base -84）
 * 變成 [0, 84]，剛好是「可以往右拖回原位」。
 */
export function shiftBounds(base: number): GesturePreset {
  const p = GESTURE.categoryCard;
  return {
    ...p,
    min: p.min === null ? null : p.min - base,
    max: p.max === null ? null : p.max - base,
  };
}

/** 卡片目前的實際位移。base 是吸附後的落點，offset 是這次拖曳的變化量 */
export function cardX(open: boolean, offset: number): number {
  return (open ? CARD_OPEN_X : 0) + offset;
}

/**
 * 放手後要開還是關。direction 來自 decideSnap：
 * -1 是往左（露出刪除鍵），1 是往右（收回去）。
 */
export function snapToOpen(direction: -1 | 1): boolean {
  return direction === -1;
}
