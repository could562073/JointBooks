import type { Person } from '../../domain/types';

/**
 * §4 明細列的時間。createdAt 是 ISO 8601，這裡取本地時間的時:分。
 * 不用 toLocaleTimeString：它的輸出隨執行環境的 locale 與時區資料變動，
 * 同一筆紀錄在不同機器上會顯示成不同字串。
 */
export function txnTime(createdAt: string): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** §4：記帳人頭像底色。我 = 主色紫，老婆 = 收入條的粉 */
export function avatarColor(by: Person): string {
  return by === '我' ? '#B7A6E5' : '#DDA6D0';
}
