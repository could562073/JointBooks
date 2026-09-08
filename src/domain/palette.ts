export type ColorSet = {
  /** 深字色，用於分類 pill 文字 */
  color: string;
  /** 淡底色，用於圖示方塊與 chip 底 */
  tint: string;
  /** 中間色，用於預算條 */
  blob: string;
  /** 高光色 */
  spike: string;
};

/**
 * 六組紫色系配色。
 * 數值取自原型原始碼；順序採 addCat 的 pal 循環順序（新增分類就是照這個序繞）。
 */
export const PALETTE: readonly ColorSet[] = [
  { color: '#5E4FA0', tint: '#EDE9FA', blob: '#B7A6E5', spike: '#CDC0F0' },
  { color: '#8A4F9E', tint: '#F4E9FA', blob: '#CFA3E0', spike: '#E2C0EE' },
  { color: '#4F52A0', tint: '#E9EAFA', blob: '#A7A9E5', spike: '#C0C2F0' },
  { color: '#9E4F87', tint: '#FAE9F3', blob: '#DDA6D0', spike: '#EDC2E2' },
  { color: '#6B4FA0', tint: '#EFE9FA', blob: '#BFA3E5', spike: '#D4C0F0' },
  { color: '#5A5AA8', tint: '#EAEAF8', blob: '#ADADE0', spike: '#C6C6EE' },
] as const;

export function colorSetOf(index: number): ColorSet {
  return PALETTE[((index % PALETTE.length) + PALETTE.length) % PALETTE.length]!;
}
