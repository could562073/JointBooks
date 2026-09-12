/** §14.5：所有寫入要 exponential backoff 重試（429／5xx），最多 5 次 */
export const MAX_ATTEMPTS = 5;
export const BASE_DELAY_MS = 500;
export const MAX_DELAY_MS = 30_000;

/**
 * 該不該重試這個 HTTP 狀態。
 *
 * 只重試 429 與 5xx：4xx（401 過期、403 沒權限、400 參數錯）重試幾次都是
 * 同樣的結果，只是把配額燒光（§14.7：Sheets 每分鐘每使用者約 60 次）。
 * 401 由 token 續期那條路處理，不走重試。
 */
export function isRetryable(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

/**
 * 第 attempt 次重試前要等多久（attempt 從 1 起算）。
 *
 * 加上 0–25% 的抖動：兩支手機同時斷線再同時回線的話，固定間隔會讓它們
 * 一直對齊著打同一秒，抖動把它們錯開。
 */
export function delayFor(attempt: number, random: () => number = Math.random): number {
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  return Math.round(exp * (1 + random() * 0.25));
}

/** 還能不能再試 */
export function canRetry(attempts: number): boolean {
  return attempts < MAX_ATTEMPTS;
}
