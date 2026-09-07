import { test, expect } from '@playwright/test';

test.describe('自架字體', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
  });

  test('三套字體都載入', async ({ page }) => {
    const loaded = await page.evaluate(() => ({
      title: document.fonts.check('700 20px "Zen Maru Gothic"'),
      body: document.fonts.check('400 16px "Noto Sans TC"'),
      num: document.fonts.check('700 16px "Baloo 2"'),
    }));
    expect(loaded).toEqual({ title: true, body: true, num: true });
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
