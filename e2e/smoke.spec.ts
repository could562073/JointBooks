import { test, expect } from '@playwright/test';

test('app shell 掛載成功且頁面底色正確', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('app-root')).toBeVisible();
  const bg = await page.evaluate(() =>
    getComputedStyle(document.body).backgroundColor
  );
  expect(bg).toBe('rgb(255, 246, 236)');
});
