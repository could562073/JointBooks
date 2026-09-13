/** 使用者輸入的帳號：去頭尾空白、轉小寫（Google 帳號不分大小寫） */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * 只擋明顯打錯的格式。Google 帳號不一定是 gmail.com（公司 Workspace 帳號也可以），
 * 所以不限網域；真正存不存在由 Drive API 回應決定。
 */
export function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
