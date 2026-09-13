/**
 * 饅頭可以選的顏色（使用者要求：在配置頁幫兩個人的饅頭換色）。
 * 這裡只管名稱；實際色碼是 tokens.css 的 --c-mantou-* 變數。
 */
export const MANTOU_COLORS = ['purple', 'pink', 'blue', 'mint', 'peach', 'butter'] as const;

export type MantouColor = (typeof MANTOU_COLORS)[number];

export const MANTOU_COLOR_LABEL: Record<MantouColor, string> = {
  purple: '薰衣草紫',
  pink: '櫻花粉',
  blue: '天空藍',
  mint: '薄荷綠',
  peach: '蜜桃橘',
  butter: '奶油黃',
};

export function isMantouColor(v: unknown): v is MantouColor {
  return typeof v === 'string' && (MANTOU_COLORS as readonly string[]).includes(v);
}
