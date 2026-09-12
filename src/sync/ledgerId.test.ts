import { describe, it, expect, beforeEach } from 'vitest';
import { db, resetDb } from '../db/schema';
import { clearJoinedSid, joinedSid, setJoinedSid } from './ledgerId';

/** ledgerId 沒有把 key 匯出去（外面不該直接碰），測試裡照著寫一份 */
const KEY_FOR_TEST = 'spreadsheetId';

beforeEach(() => resetDb());

describe('ledgerId', () => {
  it('還沒加入任何帳本時是 null', async () => {
    expect(await joinedSid()).toBeNull();
  });

  it('存下來之後讀得回同一個 id', async () => {
    await setJoinedSid('1aB9kQ');
    expect(await joinedSid()).toBe('1aB9kQ');
  });

  it('再存一次是覆蓋，不會留下兩個帳本 id', async () => {
    await setJoinedSid('first');
    await setJoinedSid('second');
    expect(await joinedSid()).toBe('second');
    expect(await db.meta.where('key').equals(KEY_FOR_TEST).count()).toBe(1);
  });

  it('清掉之後回到 null', async () => {
    await setJoinedSid('1aB9kQ');
    await clearJoinedSid();
    expect(await joinedSid()).toBeNull();
  });

  it('清一個本來就沒有的 id 不會爆', async () => {
    await expect(clearJoinedSid()).resolves.toBeUndefined();
  });

  it('meta 裡存到非字串時當作沒有，不把物件往下傳', async () => {
    await db.meta.put({ key: KEY_FOR_TEST, value: { oops: true } });
    expect(await joinedSid()).toBeNull();
  });
});
