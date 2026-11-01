import { test, expect } from '@playwright/test';
import { localDate, openApp, seedTxns, settle } from './helpers';

/** 搜尋頁：入口、版面、在真正的瀏覽器裡點結果跳回日常頁 */
test.describe('搜尋', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await seedTxns(page, [
      { note: 'Costco', cents: 8_820, categoryIndex: 3 },
      { note: 'Costco', cents: 2_180, categoryIndex: 3, by: '妻', day: localDate(4, -1) },
      { note: 'Brunch', cents: 1_230, categoryIndex: 2 },
      { note: 'GST credit', cents: 18_640, kind: 'income' },
    ]);
    await openApp(page);
  });

  test('放大鏡是月份列右側 40px 的圓鈕', async ({ page }) => {
    const btn = page.getByTestId('search-open');
    const box = (await btn.boundingBox())!;
    expect(Math.round(box.width)).toBe(40);
    expect(Math.round(box.height)).toBe(40);
    const nav = (await page.getByTestId('month-nav').boundingBox())!;
    expect(box.x + box.width).toBeCloseTo(nav.x + nav.width, 0);
  });

  test('開啟後蓋過分頁列、輸入框聚焦；輸入後列出結果並標亮', async ({ page }, info) => {
    await page.getByTestId('search-open').click();
    const screenEl = page.getByTestId('search-screen');
    await expect(page.getByTestId('search-input')).toBeFocused();
    // 分頁列被蓋住：分頁列中心點上面是搜尋頁
    const tab = (await page.getByTestId('tab-bar').boundingBox())!;
    const onTop = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('[data-testid="search-screen"]') !== null,
      [tab.x + tab.width / 2, tab.y + tab.height / 2]);
    expect(onTop).toBe(true);

    await page.getByTestId('search-input').fill('c');
    await expect(page.getByTestId('search-count')).toHaveText('找到 4 筆');
    await expect(screenEl.locator('mark').first()).toBeVisible();
    await settle(page);
    await page.screenshot({ path: info.outputPath('search-results.png') });

    // 沒有水平捲動
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
  });

  test('點上個月的結果，日常頁切到那個月並選中那天', async ({ page }) => {
    await page.getByTestId('search-open').click();
    await page.getByTestId('search-input').fill('costco');
    const last = page.getByTestId('search-screen').locator('li button').last();
    await last.click();
    await expect(page.getByTestId('search-screen')).toHaveCount(0);
    const d = new Date(localDate(4, -1));
    await expect(page.getByTestId('month-title')).toContainText(`${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月`);
  });

  test('按 Enter 記進最近搜尋，重新整理後還在', async ({ page }, info) => {
    await page.getByTestId('search-open').click();
    await page.getByTestId('search-input').fill('Costco');
    await page.getByTestId('search-input').press('Enter');
    await page.reload();
    await page.getByTestId('daily-screen').waitFor();
    await page.getByTestId('search-open').click();
    await expect(page.getByTestId('search-recent')).toContainText('Costco');
    await settle(page);
    await page.screenshot({ path: info.outputPath('search-idle.png') });
  });
});
