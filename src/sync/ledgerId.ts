import { db } from '../db/schema';
import type { Person } from '../domain/types';

/**
 * 本機記住的帳本 id（Google 試算表的 spreadsheetId）。
 *
 * 有它才有真正的邀請連結，也才知道「她是不是已經加入過這一本」（§8.1 的
 * 第三個分支）。放在 meta 表而不是 localStorage：同一份 IndexedDB 一起被
 * resetDb 清掉，不會出現「帳目清了、帳本 id 還留著」的半殘狀態。
 */
const KEY = 'spreadsheetId';

export async function joinedSid(): Promise<string | null> {
  const row = await db.meta.get(KEY);
  return typeof row?.value === 'string' ? row.value : null;
}

export async function setJoinedSid(sid: string): Promise<void> {
  await db.meta.put({ key: KEY, value: sid });
}

export async function clearJoinedSid(): Promise<void> {
  await db.meta.delete(KEY);
}

/**
 * 這台裝置上的人是帳本裡的哪一位（明細的 by 欄位）：建立帳本的人是「我」，
 * 用邀請連結加入的人是「妻」。沒記過就是建立者——只有加入成功時才寫成「妻」。
 */
export const SELF_KEY = 'selfPerson';

export async function setSelfPerson(p: Person): Promise<void> {
  await db.meta.put({ key: SELF_KEY, value: p });
}
