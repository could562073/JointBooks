import { test, expect } from '@playwright/test';

// 這支 spec 只在 `build` project 底下跑，針對的是 `npm run build && npm run
// preview` 的正式產物（見 playwright.config.ts）。
//
// 為什麼需要獨立一支：dev 模式下 devOptions.enabled 讓 vite-plugin-pwa 只吐出
// 一支 ~3 KB 的 stub service worker，裡面只有 runtimeCaching 規則、完全沒有
// precache manifest。其餘四支 e2e spec（含 pwa.spec.ts）全部跑在 dev server
// 上，所以 globPatterns、includeAssets、precache 大小這幾件事，先前沒有任何
// 測試真的碰過——這正是 18 MB 字型被塞進 precache 的那個 Critical bug，能一路
// 通過 123 個測試都沒被抓到的原因。
//
// 這裡的 ceiling 斷言就是「如果那天寫下 includeAssets: ['fonts/*.woff2']，
// 這支測試會紅」的那一條。

test.describe('PWA 正式建置產物', () => {
  test('manifest.webmanifest 欄位符合 §12.1（比照 dev-mode 版本）', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const manifestUrl = new URL(href!, 'http://localhost:4173').toString();
    const res = await request.get(manifestUrl);
    expect(res.status()).toBe(200);
    const m = await res.json();

    expect(m.display).toBe('standalone');
    expect(m.orientation).toBe('portrait');
    expect(m.theme_color).toBe('#FFF6EC');
    expect(m.background_color).toBe('#FFF6EC');

    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(m.icons.some((i: { purpose?: string }) => i.purpose?.includes('maskable'))).toBe(true);
  });

  test('sw.js 有被建置出來且可正常取得', async ({ request }) => {
    const res = await request.get('http://localhost:4173/sw.js');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/javascript/);

    const body = await res.text();
    expect(body.length).toBeGreaterThan(0);
    expect(body).toContain('precacheAndRoute');
  });

  test('precache manifest 有上限：不能再把字型 subset 塞進安裝時要抓的清單', async ({ request }) => {
    const res = await request.get('http://localhost:4173/sw.js');
    expect(res.status()).toBe(200);
    const body = await res.text();

    // 每一筆 precache 項目在產出的 sw.js 裡都會有一個 {url: 開頭。這比對著
    // workbox 版本號去解析陣列語法更穩，也不受 minifier 輸出格式變動影響。
    const entries = body.match(/\{url:/g) ?? [];
    // app shell（js/css/html）＋ 16 個圖示 SVG ＋ 4 個 PWA png 圖示（含重複列出
    // 的 icon 陣列）＋ manifest.webmanifest，目前 30 筆。給到 60 當上限，
    // 留一點成長空間，但 567 筆字型 subset 絕對撞不進來。
    expect(entries.length).toBeLessThan(60);

    // 直接點名：precache 清單裡不該有任何一筆 url 指向 fonts/ 底下的檔案。
    // （注意别用寬鬆的 /fonts\/.*woff2/ 去比對整份檔案——runtimeCaching 那條
    // CacheFirst 規則的 regex 原始碼裡本來就合法地寫著 fonts 和 woff2，比對
    // 整份文字會誤判。這裡鎖定「precache 項目」本身的形狀。）
    expect(body).not.toMatch(/\{url:"fonts\//);
  });

  test('GitHub Pages 找不到網址時回的 404.html 就是 App 本身，直接打開邀請連結不會停在 404 頁（原本手動清單 I38）', async ({ request }) => {
    const index = await (await request.get('http://localhost:4173/index.html')).text();
    const notFound = await request.get('http://localhost:4173/404.html');
    expect(notFound.status()).toBe(200);
    expect(await notFound.text()).toBe(index);
  });
});
