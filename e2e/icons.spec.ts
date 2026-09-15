import { test, expect } from '@playwright/test';

test('16 個圖示全部從專案內載入且無 CDN 請求', async ({ page, context }) => {
  const cdn: string[] = [];
  context.on('request', (r) => {
    if (r.url().includes('iconify.design')) cdn.push(r.url());
  });

  await page.goto('/?debug=icons');   // App 在此 query 下渲染 <IconGallery />
  const imgs = page.getByTestId('icon-gallery').locator('img');
  await expect(imgs).toHaveCount(16);

  // Wait for all images to load
  await page.waitForLoadState('networkidle');

  const broken = await imgs.evaluateAll((els) =>
    els.filter((e) => !(e as HTMLImageElement).naturalWidth).map((e) => e.getAttribute('alt'))
  );
  expect(broken).toEqual([]);
  expect(cdn).toEqual([]);
});
