import { test, expect } from '@playwright/test';

test.describe('PWA 外殼', () => {
  test('manifest 欄位符合 §12.1', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(href).toBeTruthy();

    const m = await (await request.get(new URL(href!, 'http://localhost:5173').toString())).json();
    expect(m.display).toBe('standalone');
    expect(m.orientation).toBe('portrait');
    expect(m.theme_color).toBe('#FFF6EC');
    expect(m.background_color).toBe('#FFF6EC');

    const sizes = m.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(m.icons.some((i: { purpose?: string }) => i.purpose?.includes('maskable'))).toBe(true);

    // Verify all icon URLs are actually reachable and return 200
    for (const icon of m.icons) {
      const iconUrl = new URL(icon.src, 'http://localhost:5173').toString();
      const res = await request.get(iconUrl);
      expect(res.status()).toBe(200);
    }
  });

  test('iOS meta 齊備', async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]'))
      .toHaveAttribute('content', 'yes');
    await expect(page.locator('meta[name="apple-mobile-web-app-status-bar-style"]'))
      .toHaveAttribute('content', 'default');

    const appleIconLink = page.locator('link[rel="apple-touch-icon"]');
    await expect(appleIconLink).toHaveCount(1);

    // Verify apple-touch-icon URL is reachable
    const iconHref = await appleIconLink.getAttribute('href');
    expect(iconHref).toBeTruthy();
    const iconRes = await request.get(new URL(iconHref!, 'http://localhost:5173').toString());
    expect(iconRes.status()).toBe(200);

    await expect(page.locator('meta[name="viewport"]'))
      .toHaveAttribute('content', /viewport-fit=cover/);
  });

  test('安全區變數存在，且底部實際算出來至少 30px', async ({ page }) => {
    await page.goto('/');

    // 注意：不能對 getPropertyValue('--safe-bottom') 直接 parseFloat。
    // 自訂屬性取回的是「宣告原文」，也就是字串 "max(30px, env(safe-area-inset-bottom, 0px))"，
    // parseFloat 會得到 NaN，而 NaN >= 30 恆為 false —— 這樣寫測試永遠是紅的。
    // 要驗證的是它「算出來」的長度，所以套到探針元素上再讀計算值。
    const v = await page.evaluate(() => {
      const s = getComputedStyle(document.documentElement);
      const declaredTop = s.getPropertyValue('--safe-top').trim();

      const probe = document.createElement('div');
      probe.style.paddingBottom = 'var(--safe-bottom)';
      probe.style.paddingTop = 'var(--safe-top)';
      document.body.appendChild(probe);
      const cs = getComputedStyle(probe);
      const computed = { bottom: cs.paddingBottom, top: cs.paddingTop };
      probe.remove();

      return { declaredTop, ...computed };
    });

    expect(v.declaredTop).not.toBe('');
    // 桌機的 env(safe-area-inset-*) 為 0，故 max(30px, 0px) 應算出 30px
    expect(parseFloat(v.bottom)).toBe(30);
    expect(parseFloat(v.top)).toBeGreaterThanOrEqual(0);
  });

  test('§11-12：外層不出現第二條 scrollbar', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(() => ({
      docScrolls: document.scrollingElement!.scrollHeight >
                  document.scrollingElement!.clientHeight + 1,
      bodyOverflow: getComputedStyle(document.body).overflow,
    }));
    expect(overflow.docScrolls).toBe(false);
    expect(overflow.bodyOverflow).toBe('hidden');
  });
});
