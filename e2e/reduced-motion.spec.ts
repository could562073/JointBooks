import { test, expect } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

test('reduced-motion：動畫降為 120ms 但元素仍在原位', async ({ page }) => {
  await page.goto('/?debug=mantou');
  const m = page.getByTestId('mantou-breathing');

  const dur = await m.evaluate((el) => getComputedStyle(el).animationDuration);
  expect(dur).toBe('0.12s');

  // 版面不變：饅頭仍可見且有實際尺寸（§15.2-32）
  const bb = await m.boundingBox();
  expect(bb!.width).toBeGreaterThan(0);
  expect(bb!.height).toBeGreaterThan(0);
});
