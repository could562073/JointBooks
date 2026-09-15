import { describe, expect, it } from 'vitest';
import { versionLabel } from './appVersion';

describe('配置頁底下的版本', () => {
  it('提交碼加上建置的月日時分', () => {
    expect(versionLabel('4fc7fdb', '2026-09-14T22:19:15Z')).toMatch(/^版本 4fc7fdb · \d{1,2}\/\d{1,2} \d{2}:\d{2}$/);
  });

  it('沒有建置時間（本機測試）或時間壞掉：只顯示版本', () => {
    expect(versionLabel('dev', undefined)).toBe('版本 dev');
    expect(versionLabel('dev', 'not-a-date')).toBe('版本 dev');
  });
});
