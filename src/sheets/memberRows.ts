import { normalizeMembers, type Members } from '../domain/members';
import type { Person } from '../domain/types';
import { SHEET } from './ledgerSheet';

/**
 * 成員名稱與饅頭顏色放在配置頁 N–P 欄（A–J 是分類、L 是版本戳記、M 是環境標記）。
 * 寫的時候連標頭一起寫；讀的時候只讀兩列資料。
 */
export const MEMBERS_RANGE = `${SHEET.config}!N1:P3`;
export const MEMBERS_READ_RANGE = `${SHEET.config}!N2:P3`;
export const MEMBERS_HEADER = ['成員', '名稱', '饅頭顏色'] as const;

export function membersToRows(m: Members): string[][] {
  return [
    [...MEMBERS_HEADER],
    ['我', m.我.name, m.我.color],
    ['妻', m.妻.name, m.妻.color],
  ];
}

/** 讀回來的資料列。一列都沒有（還沒有人改過）回 null，呼叫端就保留本機的 */
export function rowsToMembers(rows: readonly (readonly string[])[]): Members | null {
  const found: Partial<Record<Person, { name: unknown; color: unknown }>> = {};
  for (const r of rows) {
    const p = r[0]?.trim();
    if (p === '我' || p === '妻') found[p] = { name: r[1], color: r[2] };
  }
  if (!found.我 && !found.妻) return null;
  return normalizeMembers(found);
}
