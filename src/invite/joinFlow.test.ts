import { describe, it, expect } from 'vitest';
import { afterJoin, joinStateOf, needsLoginFirst } from './joinFlow';

const OK = { kind: 'ok' as const, sid: 'SID', expiresAt: 1 };

describe('joinStateOf（§8.1 的分支）', () => {
  it('連結有效且還沒加入 → 顯示邀請卡', () => {
    expect(joinStateOf({ check: OK, joinedSid: null }))
      .toEqual({ kind: 'invite', sid: 'SID' });
  });

  it('已經是成員 → 不重複加入', () => {
    expect(joinStateOf({ check: OK, joinedSid: 'SID' }))
      .toEqual({ kind: 'already', sid: 'SID' });
  });

  it('加入的是別本帳時仍然顯示邀請卡，並標出這台會改記這一本', () => {
    expect(joinStateOf({ check: OK, joinedSid: 'OTHER' }))
      .toEqual({ kind: 'invite', sid: 'SID', switching: true });
  });

  it('連結過期 → expired', () => {
    expect(joinStateOf({ check: { kind: 'expired' }, joinedSid: null }))
      .toEqual({ kind: 'expired' });
  });

  it('簽章不符 → invalid', () => {
    expect(joinStateOf({ check: { kind: 'invalid' }, joinedSid: null }))
      .toEqual({ kind: 'invalid' });
  });

  it('過期的連結即使指向她已加入的帳本也顯示失效', () => {
    // 她本來就進得去，不需要靠這條連結；默默放行反而讓過期形同虛設
    expect(joinStateOf({ check: { kind: 'expired' }, joinedSid: 'SID' }))
      .toEqual({ kind: 'expired' });
  });
});

describe('needsLoginFirst（§8.1 例外分支）', () => {
  it('未登入時先走登入', () => {
    expect(needsLoginFirst(false, { kind: 'invite', sid: 'SID' })).toBe(true);
    expect(needsLoginFirst(false, { kind: 'already', sid: 'SID' })).toBe(true);
  });

  it('已登入就不用', () => {
    expect(needsLoginFirst(true, { kind: 'invite', sid: 'SID' })).toBe(false);
  });

  it('連結本身就失效時不用先登入——登入了也沒東西可加入', () => {
    expect(needsLoginFirst(false, { kind: 'expired' })).toBe(false);
    expect(needsLoginFirst(false, { kind: 'invalid' })).toBe(false);
  });

  it('唯讀試用不需要登入', () => {
    expect(needsLoginFirst(false, { kind: 'browsing' })).toBe(false);
  });
});

describe('afterJoin', () => {
  it('有效與已是成員都進主程式', () => {
    expect(afterJoin({ kind: 'invite', sid: 'S' })).toBe('app');
    expect(afterJoin({ kind: 'already', sid: 'S' })).toBe('app');
  });

  it('失效與唯讀試用留在原頁', () => {
    expect(afterJoin({ kind: 'expired' })).toBe('stay');
    expect(afterJoin({ kind: 'invalid' })).toBe('stay');
    expect(afterJoin({ kind: 'browsing' })).toBe('stay');
  });
});
