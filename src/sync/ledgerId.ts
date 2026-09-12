import { db } from '../db/schema';

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
