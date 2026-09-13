import { describe, it, expect } from 'vitest';
import { DEFAULT_MEMBERS, type Members } from '../domain/members';
import { MEMBERS_RANGE, membersToRows, rowsToMembers } from './memberRows';

const CUSTOM: Members = { 我: { name: 'Rex', color: 'blue' }, 妻: { name: '雪雪大人', color: 'peach' } };

describe('成員名稱與顏色在試算表裡的樣子', () => {
  it('放在配置頁 N–P 欄，第一列是標頭', () => {
    expect(MEMBERS_RANGE).toBe('配置!N1:P3');
    expect(membersToRows(CUSTOM)).toEqual([
      ['成員', '名稱', '饅頭顏色'],
      ['我', 'Rex', 'blue'],
      ['妻', '雪雪大人', 'peach'],
    ]);
  });

  it('寫出去再讀回來一樣', () => {
    expect(rowsToMembers(membersToRows(CUSTOM).slice(1))).toEqual(CUSTOM);
  });

  it('還沒有人改過（空的）回 null，保留本機的', () => {
    expect(rowsToMembers([])).toBeNull();
  });

  it('只有一列時另一位用預設；被人手動改壞的值也用預設', () => {
    expect(rowsToMembers([['妻', '小雪', 'mint']])).toEqual({ 我: DEFAULT_MEMBERS.我, 妻: { name: '小雪', color: 'mint' } });
    expect(rowsToMembers([['我', '', 'rainbow']])!.我).toEqual(DEFAULT_MEMBERS.我);
  });
});
