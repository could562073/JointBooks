import { describe, expect, it } from 'vitest';
import { buildStamp, versionLabel } from './appVersion';

describe('配置頁底下的版本', () => {
  it('語意化版本，後面帶這次建置的提交碼', () => {
    expect(versionLabel('1.2.3', '4548372')).toBe('v1.2.3 · 4548372');
  });

  it('拿不到提交碼（本機開發）時只寫版本號', () => {
    expect(versionLabel('1.2.3', '')).toBe('v1.2.3');
  });

  it('建置時間放在長按的提示裡；沒有或壞掉就不顯示', () => {
    expect(buildStamp('2026-09-15T08:59:00Z')).toMatch(/^建置於 \d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
    expect(buildStamp(undefined)).toBe('');
    expect(buildStamp('not-a-date')).toBe('');
  });
});
