import { isMantouColor, type MantouColor } from './mantouColors';
import type { Person } from './types';

/**
 * 帳本成員的名稱與饅頭顏色（使用者要求：稱謂可自訂、饅頭可換色，而且要存到雲端）。
 *
 * 「我」「妻」只是資料裡的身分代號——「我」是建立帳本的人、「妻」是用邀請連結加入的人。
 * 兩個人都是使用者，畫面上一律顯示這裡的名稱，不再寫死「我／老婆」。
 */
export type Member = { name: string; color: MantouColor };
export type Members = Record<Person, Member>;

/** 名稱最多幾個字：成員列、記一筆面板都要放得下 */
export const MEMBER_NAME_MAX = 12;

/** 使用者指定的預設名稱：建立帳本的那位叫「我」、加入的那位叫「雪雪大人」 */
export const DEFAULT_MEMBERS: Readonly<Members> = {
  我: { name: '我', color: 'purple' },
  妻: { name: '雪雪大人', color: 'pink' },
};

/** 去頭尾空白、截到上限（以字為單位，emoji 不會被切一半）；空的用 fallback */
export function cleanName(v: unknown, fallback: string): string {
  const s = typeof v === 'string' ? [...v.trim()].slice(0, MEMBER_NAME_MAX).join('') : '';
  return s || fallback;
}

/** 讀回存著的（本機或雲端）；缺的、壞的一律用預設，不讓壞資料把畫面弄壞 */
export function normalizeMembers(v: unknown): Members {
  const o = (typeof v === 'object' && v !== null ? v : {}) as Partial<Record<Person, unknown>>;
  const one = (p: Person): Member => {
    const raw = o[p];
    const m = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Record<keyof Member, unknown>>;
    return {
      name: cleanName(m.name, DEFAULT_MEMBERS[p].name),
      color: isMantouColor(m.color) ? m.color : DEFAULT_MEMBERS[p].color,
    };
  };
  return { 我: one('我'), 妻: one('妻') };
}
