import { describe, it, expect } from 'vitest';
// 用 ?raw 讀 index.html：這條測試守的是「加入主畫面」時預設帶出的名稱
import html from '../../index.html?raw';

const meta = (name: string) => html.match(new RegExp(`<meta name="${name}" content="([^"]+)"`))?.[1];

describe('加入主畫面的預設名稱是「饅頭記帳」（使用者要求）', () => {
  it('iPhone 讀 apple-mobile-web-app-title，沒有時才退回網頁標題', () => {
    expect(meta('apple-mobile-web-app-title')).toBe('饅頭記帳');
    expect(html).toContain('<title>饅頭記帳</title>');
  });

  it('其他瀏覽器讀 application-name', () => {
    expect(meta('application-name')).toBe('饅頭記帳');
  });
});
