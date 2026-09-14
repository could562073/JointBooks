import { describe, it, expect } from 'vitest';
// 用 ?raw 讀 index.html：這條測試守的是 head 裡的 viewport 設定
import html from '../../index.html?raw';

describe('整頁不縮放（像原生 App）', () => {
  const viewport = html.match(/<meta name="viewport" content="([^"]+)"/)?.[1] ?? '';

  it('擋掉 iPhone 點輸入框時的自動放大，也不能雙指縮放', () => {
    expect(viewport).toContain('maximum-scale=1');
    expect(viewport).toContain('user-scalable=no');
  });

  it('仍然延伸到瀏海與 Home 指示條底下，安全區域才量得到', () => {
    expect(viewport).toContain('viewport-fit=cover');
  });
});
