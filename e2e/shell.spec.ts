import { test, expect } from '@playwright/test';
import { openApp, setMeta, settle } from './helpers';

/**
 * App 外殼：啟動畫面（原本手動清單 I48）與返回鍵先關面板（I51）。
 */

test('打開時先蓋啟動畫面，約 2.6 秒後消失；載入前的底色就是同一個淡紫（I48）', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const splash = page.getByTestId('launch-screen');
  await expect(splash).toBeVisible();
  await expect(splash).toContainText('饅頭記帳');
  await expect(splash).toContainText('our little money book');
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe('rgb(237, 233, 250)');
  await expect(splash).toHaveCount(0, { timeout: 4_000 });
  expect(errors).toEqual([]);
});

test('減少動態效果時啟動畫面照樣出現、照樣消失', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.getByTestId('launch-screen')).toBeVisible();
  await expect(page.getByTestId('launch-screen')).toHaveCount(0, { timeout: 3_500 });
});

test('?debug= 展示頁不蓋啟動畫面', async ({ page }) => {
  await page.goto('/?debug=icons');
  await page.waitForTimeout(800);
  await expect(page.getByTestId('launch-screen')).toHaveCount(0);
});

test('記一筆面板：按返回先關面板、留在 App；用 ✕ 關掉時自己退掉那一格（I51）', async ({ page }) => {
  await openApp(page);
  const sheet = page.getByTestId('entry-sheet');
  await page.getByTestId('fab').click();
  await expect(sheet).toBeVisible();
  expect(await page.evaluate(() => Boolean(history.state?.jbLayer))).toBe(true);

  await page.goBack();
  await expect(sheet).toHaveCount(0, { timeout: 3_000 });
  await expect(page.getByTestId('daily-screen')).toBeVisible();

  await page.getByTestId('fab').click();
  await expect(sheet).toBeVisible();
  await settle(page);
  // 用畫面上的按鈕關掉（iPhone SE 上面板頂端比較高，點遮罩的座標會點到面板本身）
  await page.getByTestId('entry-close').click();
  await expect(sheet).toHaveCount(0, { timeout: 3_000 });
  await expect.poll(() => page.evaluate(() => history.state?.jbLayer ?? null)).toBeNull();
});

test('邀請面板：按返回先關面板、留在配置頁（I51）', async ({ page }) => {
  await openApp(page);
  await setMeta(page, 'spreadsheetId', '1aB9kQ_e2e_fake_spreadsheet_id');
  await openApp(page);
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('invite-member').click();
  await expect(page.getByTestId('invite-panel')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('invite-panel')).toHaveCount(0, { timeout: 3_000 });
  await expect(page.getByTestId('settings-screen')).toBeVisible();
});
