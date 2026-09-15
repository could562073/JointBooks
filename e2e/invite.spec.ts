import { test, expect, type Page } from '@playwright/test';
import { animationsOf, drag, openApp, setMeta, settle } from './helpers';

/**
 * 邀請面板：原本 docs/MANUAL-TESTS.md 的 I4–I13（手動驗），不需要 Google 帳號的部分搬來這裡。
 * 純本機模式沒有「分享帳本」那一步，給一個假的帳本 id，面板就直接有邀請連結。
 */

async function openInvite(page: Page): Promise<void> {
  await openApp(page);
  await setMeta(page, 'spreadsheetId', '1aB9kQ_e2e_fake_spreadsheet_id');
  await openApp(page);
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('invite-member').click();
  await expect(page.getByTestId('invite-panel')).toBeVisible();
}

test('邀請面板由底部滑入（I4）', async ({ page }) => {
  await openInvite(page);
  const anims = await animationsOf(page.getByTestId('invite-panel'));
  expect(anims.some((a) => a.duration === 340 && a.from.includes('100%'))).toBe(true);
});

test('拖把手：不到門檻彈回，超過門檻放手才關（I5）', async ({ page }) => {
  await openInvite(page);
  await settle(page);
  const handle = page.getByTestId('invite-handle');
  await drag(page, handle, 0, 50, { steps: 10, pause: 30 });
  await settle(page);
  await expect(page.getByTestId('invite-panel')).toBeVisible();
  await drag(page, handle, 0, 200, { steps: 12 });
  await expect(page.getByTestId('invite-panel')).toHaveCount(0, { timeout: 1_500 });
});

test('複製邀請連結：按鈕轉綠、文字變「已複製連結」，2.2 秒後復原；剪貼簿就是那條連結（I6、I7）', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openInvite(page);
  const copy = page.getByTestId('invite-copy');
  await copy.click();
  await expect(copy).toHaveAttribute('data-copied');
  await expect(copy).toHaveText('已複製連結');
  await expect.poll(() => copy.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe('rgb(62, 127, 99)');
  const link = await page.getByTestId('invite-link').getAttribute('data-url');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(link);
  await expect(copy).toHaveText('複製邀請連結', { timeout: 3_500 });
});

test('顯示 QR Code：由下往上滑入（I8）', async ({ page }) => {
  await openInvite(page);
  await page.getByTestId('invite-qr-toggle').click();
  await expect(page.getByTestId('invite-qr')).toBeVisible();
  const anims = await animationsOf(page.getByTestId('invite-qr'), true);
  expect(anims.some((a) => a.duration === 240 && a.from.includes('10px'))).toBe(true);
});

test('系統分享單按取消：什麼都不發生（I11）', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: () => Promise.reject(new DOMException('使用者取消', 'AbortError')),
    });
  });
  await openInvite(page);
  await page.getByTestId('invite-share').click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('invite-note')).toHaveCount(0);
  await expect(page.getByTestId('invite-copy')).not.toHaveAttribute('data-copied');
});

test('不支援系統分享：退回複製並說明（I12）', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  });
  await openInvite(page);
  await page.getByTestId('invite-share').click();
  await expect(page.getByTestId('invite-note')).toHaveText('這個裝置不支援分享，已改為複製連結');
});

test('預覽對方看到的畫面：進接受邀請頁的預覽，結束預覽回主程式（I13、I29）', async ({ page }) => {
  await openInvite(page);
  await page.getByTestId('invite-preview').click();
  await expect(page.getByTestId('join-page')).toHaveAttribute('data-state', 'invite');
  await expect(page.getByTestId('join-preview-note')).toBeVisible();
  await expect(page.getByTestId('launch-screen')).toHaveCount(0, { timeout: 8_000 });
  await page.getByTestId('join-cta').click();
  await expect(page.getByTestId('daily-screen')).toBeVisible();
});
