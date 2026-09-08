/**
 * 增補檔 A：配置頁的「月結日」與「週起始」已移除，固定為週一 / 每月 1 日。
 * 集中在此，日後若要加回設定只需改這裡與讀取端。
 */
export const WEEK_START = 'monday' as const;
export const MONTH_CLOSING_DAY = 1 as const;

export const MAIN_CURRENCY = 'CAD' as const;

/** §5 數字鍵盤：小數最多兩位、總長 9 字 */
export const AMOUNT_MAX_LEN = 9;
export const AMOUNT_MAX_DECIMALS = 2;

/** §11-5 新建分類的預設值 */
export const NEW_CATEGORY_BUDGET_CENTS = 15_000;   // $150
export const NEW_CATEGORY_ICON = 'bag' as const;

/** §4 月曆格：當天支出 ≥$1000 改顯示 $1.2k */
export const CALENDAR_COMPACT_THRESHOLD_CENTS = 100_000;

/** §4 月曆格底色濃度：rgba(183,166,229, BASE + ratio * SPAN) */
export const CALENDAR_HEAT_BASE = 0.14;
export const CALENDAR_HEAT_SPAN = 0.44;
