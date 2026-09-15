import { test, expect, type Locator } from '@playwright/test';

/**
 * iPhone 點到字小於 16px 的輸入框會自動放大、之後不縮回（使用者回報改月預算時整頁放大）。
 *
 * global.css 本來就寫了輸入框至少 16px，但各元件的 CSS Modules class 權重較高、把它蓋回
 * 12–13px，所以第一次只改 viewport 時真機上照樣放大。jsdom 不套用 CSS、也不認得
 * (pointer: coarse)，Vitest 讀 CSS 還是空字串，只能在真實瀏覽器模擬觸控裝置量實際字級。
 */
test.use({ hasTouch: true, isMobile: true });

const px = (el: Locator) => el.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));

test('觸控裝置上：分類與預算頁的月預算、分類名稱輸入框都至少 16px', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('daily-screen').waitFor();
  expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);

  await page.getByTestId('tab-settings').click();
  await page.getByTestId('open-categories').click();

  await page.locator('[data-testid$="-budget"]').first().click();
  const budget = page.locator('[data-testid$="-budget-input"]').first();
  await expect(budget).toBeVisible();
  expect(await px(budget)).toBeGreaterThanOrEqual(16);
  await page.locator('[data-testid$="-budget-cancel"]').first().click();

  await page.locator('[data-testid^="cat-"][data-testid$="-name"]').first().click();
  const name = page.locator('[data-testid$="-name-input"]').first();
  await expect(name).toBeVisible();
  expect(await px(name)).toBeGreaterThanOrEqual(16);
});
