import { describe, it, expect } from 'vitest';
import { cleanName, DEFAULT_MEMBERS, MEMBER_NAME_MAX, normalizeMembers } from './members';
import { otherPerson, roleLabel } from './people';

describe('帳本裡的兩位', () => {
  it('另一位與身分', () => {
    expect(otherPerson('我')).toBe('妻');
    expect(otherPerson('妻')).toBe('我');
    expect(roleLabel('我')).toBe('擁有者');
    expect(roleLabel('妻')).toBe('可編輯');
  });
});

describe('normalizeMembers', () => {
  it('沒存過：老公紫、雪雪大人粉（使用者指定的預設名稱）', () => {
    expect(normalizeMembers(undefined)).toEqual(DEFAULT_MEMBERS);
    expect(DEFAULT_MEMBERS.妻.name).toBe('雪雪大人');
  });

  it('只改了一位時另一位維持預設；不認得的顏色、空名稱也用預設', () => {
    expect(normalizeMembers({ 妻: { name: '小雪', color: 'mint' } }))
      .toEqual({ 我: DEFAULT_MEMBERS.我, 妻: { name: '小雪', color: 'mint' } });
    expect(normalizeMembers({ 我: { name: '   ', color: 'rainbow' }, 妻: 42 })).toEqual(DEFAULT_MEMBERS);
  });
});

describe('cleanName', () => {
  it('去頭尾空白、截到上限', () => {
    expect(cleanName('  小雪  ', 'x')).toBe('小雪');
    expect([...cleanName('一'.repeat(20), 'x')]).toHaveLength(MEMBER_NAME_MAX);
  });

  it('以字為單位截，emoji 不會被切一半', () => {
    const name = cleanName('🐻'.repeat(20), 'x');
    expect([...name]).toHaveLength(MEMBER_NAME_MAX);
    expect(name).toBe('🐻'.repeat(MEMBER_NAME_MAX));
  });
});
