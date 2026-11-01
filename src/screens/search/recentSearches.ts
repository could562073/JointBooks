/**
 * 最近搜尋存在這台手機的 localStorage，每個人各自一份，不同步到試算表——
 * 那是各自的搜尋習慣，不是帳本的一部分。
 */
export const RECENT_SEARCHES_KEY = 'manto.recentSearch';
export const RECENT_MAX = 5;

/** 把一個詞放到最前面；重複的去掉，超過上限從尾端丟掉。空白詞不收 */
export function pushRecent(list: string[], term: string): string[] {
  const t = term.trim();
  if (!t) return list;
  return [t, ...list.filter((x) => x !== t)].slice(0, RECENT_MAX);
}

/** 讀不到（第一次使用、私密瀏覽擋掉 storage、內容壞掉）一律當成空的 */
export function loadRecent(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function saveRecent(list: string[]): void {
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // 存不了就只在這次開著時有效
  }
}
