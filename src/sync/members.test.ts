import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../db/schema';
import { DEFAULT_MEMBERS, type Members } from '../domain/members';
import { ledgerRepo } from '../repo/ledgerRepo';
import { localMembers, MEMBERS_DIRTY_KEY, MEMBERS_KEY, membersSync, resetLocalMembers } from './members';

const CUSTOM: Members = { 我: { name: 'Rex', color: 'blue' }, 妻: { name: '小雪', color: 'mint' } };

beforeEach(async () => {
  await resetDb();
  await ledgerRepo.bootstrap();
});

describe('成員的本機存放與同步標記', () => {
  it('沒存過是預設', async () => {
    expect(await localMembers()).toEqual(DEFAULT_MEMBERS);
    expect(await membersSync.dirty()).toBe(false);
  });

  it('從雲端拉回來就存到本機', async () => {
    await membersSync.save(CUSTOM);
    expect(await localMembers()).toEqual(CUSTOM);
  });

  it('本機有還沒推的修改：拉回來的不覆蓋', async () => {
    await ledgerRepo.setMeta(MEMBERS_KEY, CUSTOM);
    await ledgerRepo.setMeta(MEMBERS_DIRTY_KEY, true);
    await membersSync.save(DEFAULT_MEMBERS);
    expect(await localMembers()).toEqual(CUSTOM);
  });

  it('改記另一本帳時：回到預設、沒有待推', async () => {
    await ledgerRepo.setMeta(MEMBERS_KEY, CUSTOM);
    await ledgerRepo.setMeta(MEMBERS_DIRTY_KEY, true);
    await resetLocalMembers();
    expect(await localMembers()).toEqual(DEFAULT_MEMBERS);
    expect(await membersSync.dirty()).toBe(false);
  });

  it('推完才清待推標記；推的途中又改了就留著，下一輪再推', async () => {
    await ledgerRepo.setMeta(MEMBERS_KEY, CUSTOM);
    await ledgerRepo.setMeta(MEMBERS_DIRTY_KEY, true);
    await membersSync.markPushed(DEFAULT_MEMBERS);   // 推的是舊的
    expect(await membersSync.dirty()).toBe(true);
    await membersSync.markPushed(CUSTOM);
    expect(await membersSync.dirty()).toBe(false);
  });
});
