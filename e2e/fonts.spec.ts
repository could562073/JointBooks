import { test, expect } from '@playwright/test';

// 每套字體用一段代表性文字。CJK 字型依 unicode-range 切成數百個 subset，
// document.fonts.check() 不帶文字時用的預設樣本字串落不進任何 subset，
// 會對「檔案其實正常」的字型回傳 false。先 load 指定文字再 check 才是真的驗證，
// 因為 load() 會實際去抓對應的 woff2 並解析。
const SAMPLES = [
  { family: 'Zen Maru Gothic', spec: '700 20px "Zen Maru Gothic"', text: '饅頭記帳' },
  { family: 'Noto Sans TC',    spec: '400 16px "Noto Sans TC"',    text: '收入支出結餘' },
  { family: 'Baloo 2',         spec: '700 16px "Baloo 2"',         text: '1234567890' },
];

test.describe('自架字體', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
  });

  test('三套字體的 woff2 都取得到且解析得開', async ({ page }) => {
    const results = await page.evaluate(async (samples) => {
      const out: Record<string, boolean> = {};
      for (const s of samples) {
        await document.fonts.load(s.spec, s.text);
        out[s.family] = document.fonts.check(s.spec, s.text);
      }
      return out;
    }, SAMPLES);

    expect(results).toEqual({
      'Zen Maru Gothic': true,
      'Noto Sans TC': true,
      'Baloo 2': true,
    });
  });

  test('字體從同源載入，不打 Google CDN', async ({ page, context }) => {
    const external: string[] = [];
    context.on('request', (r) => {
      const u = r.url();
      if (u.includes('fonts.googleapis.com') || u.includes('fonts.gstatic.com')) external.push(u);
    });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    expect(external).toEqual([]);
  });

  test('.num utility 套用 Baloo 2 700', async ({ page }) => {
    await page.evaluate(() => {
      const el = document.createElement('span');
      el.className = 'num';
      el.id = 'probe';
      el.textContent = '1,234';
      document.body.appendChild(el);
    });
    const cs = await page.evaluate(() => {
      const s = getComputedStyle(document.getElementById('probe')!);
      return { family: s.fontFamily, weight: s.fontWeight };
    });
    expect(cs.family).toContain('Baloo 2');
    expect(cs.weight).toBe('700');
  });
});
