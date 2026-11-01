import { test, expect, type Page } from '@playwright/test';
import { drag, openApp, seedTxns, settle } from './helpers';

/**
 * 記一筆／編輯面板：原本 docs/MANUAL-TESTS.md 的 E1–E16（手動驗），能在 Chromium 量到的都搬來這裡。
 */

async function openSheet(page: Page): Promise<void> {
  await page.getByTestId('fab').click();
  await expect(page.getByTestId('entry-sheet')).toBeVisible();
  await settle(page);
}

test.describe('記一筆面板（§5、MOTION #1–#4 #35–#38）', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });

  test('拖把手：跟手往下；往上拉超過原位只有阻尼（×0.4）；不到 110px 彈回，超過就關（E3、E4）', async ({ page }) => {
    await openSheet(page);
    const sheet = page.getByTestId('entry-sheet');
    const handle = page.getByTestId('entry-handle');
    const top0 = (await sheet.boundingBox())!.y;

    const at = await drag(page, handle, 0, 60, { release: false });
    expect((await sheet.boundingBox())!.y).toBeGreaterThan(top0 + 40);
    // 往上拉到原位再多 80px：§10 通則是超出邊界乘阻尼、不硬止，面板最多只往上 80×0.4＝32px
    await page.mouse.move(at.x, at.y - 140, { steps: 18 });
    const up = (await sheet.boundingBox())!.y;
    expect(up).toBeLessThan(top0);
    expect(up).toBeGreaterThanOrEqual(top0 - 40);
    await page.mouse.up();
    await settle(page);
    await expect(sheet).toHaveCount(1);
    expect(Math.abs((await sheet.boundingBox())!.y - top0)).toBeLessThan(2);

    await drag(page, handle, 0, 180, { steps: 12 });
    await expect(sheet).toHaveCount(0, { timeout: 1_500 });
  });

  test('⌫ 鍵是淡紫底 #EDE9FA、深紫圖示 #6B57B8（E7）', async ({ page }) => {
    await openSheet(page);
    const c = await page.getByTestId('key-back').evaluate((n) => ({ bg: getComputedStyle(n).backgroundColor, fg: getComputedStyle(n).color }));
    expect(c.bg).toBe('rgb(237, 233, 250)');
    expect(c.fg).toBe('rgb(107, 87, 184)');
  });

  test('記一筆稅前加稅費：合計算給你看，存完再打開稅還在', async ({ page }) => {
    await openSheet(page);
    await page.getByTestId('key-1').click();
    await page.getByTestId('key-6').click();
    await page.getByTestId('key-.').click();
    await page.getByTestId('key-7').click();
    await page.getByTestId('key-5').click();
    await expect(page.getByTestId('amount-hint')).toHaveText('金額請填稅前');

    await page.getByTestId('field-tax').click();
    await page.getByTestId('key-1').click();
    await page.getByTestId('key-.').click();
    await page.getByTestId('key-0').click();
    await page.getByTestId('key-0').click();
    await expect(page.getByTestId('amount-hint')).toHaveText('含稅合計 $17.75');

    await page.getByTestId('key-save').click();
    await expect(page.getByTestId('entry-sheet')).toHaveCount(0, { timeout: 2_000 });

    // 月曆展開時明細那一列在小手機上會落到分頁列底下，先收起來
    await page.getByTestId('calendar-handle').click();
    await settle(page);
    const row = page.getByTestId('txn-list').locator('li').first();
    await expect(row).toContainText('-$17.75');

    await row.click();
    await expect(page.getByTestId('field-amount')).toContainText('16.75');
    await expect(page.getByTestId('field-tax')).toContainText('1.00');
    await expect(page.getByTestId('amount-hint')).toHaveText('含稅合計 $17.75');
  });

  test('編輯模式按垃圾桶：確認窗彈出並寫出這筆；確認後面板關閉、該筆消失（E14、E15）', async ({ page }) => {
    await seedTxns(page, [{ cents: 4_218 }]);
    await openApp(page);
    // iPhone SE 上月曆展開時，明細那一列會落在分頁列底下；先收起月曆（小手機上使用者也會這樣做）
    await page.getByTestId('calendar-handle').click();
    await settle(page);
    await page.locator('[data-testid^="txn-seed-"]').first().click();
    await expect(page.getByTestId('entry-mode')).toContainText('編輯');
    await settle(page);

    await page.getByTestId('entry-delete').click();
    await expect(page.getByTestId('delete-confirm-subject')).toContainText('42.18');
    await settle(page);

    await page.getByTestId('delete-confirm-confirm').click();
    await expect(page.getByTestId('entry-sheet')).toHaveCount(0, { timeout: 1_500 });
    await expect(page.locator('[data-testid^="txn-seed-"]')).toHaveCount(0, { timeout: 2_000 });
  });

  test('記一筆裡就地新增主分類：立即選中，分類頁排在最上方（E16）', async ({ page }) => {
    await openSheet(page);
    await page.getByTestId('add-main').click();
    await page.getByTestId('category-input').fill('寵物');
    await page.getByTestId('category-input').press('Enter');
    await expect(page.getByTestId('main-chips').locator('[data-selected]')).toContainText('寵物');
    await page.getByTestId('entry-close').click();
    await expect(page.getByTestId('entry-sheet')).toHaveCount(0, { timeout: 1_500 });

    await page.getByTestId('tab-settings').click();
    await page.getByTestId('open-categories').click();
    await expect(page.getByTestId('categories-page').locator('li[data-testid^="cat-"]').first()).toContainText('寵物');
  });

  test('畫面比面板矮時，鍵盤固定在底部一直看得到；捲到最底，備註欄不會被鍵盤蓋住', async ({ page }) => {
    // 使用者回報：iPhone 15 Pro Max 開「顯示放大：較大文字」後可用高度只剩約 765，0 那排被捲到畫面外
    await page.setViewportSize({ width: 375, height: 700 });
    await openSheet(page);
    const sheet = page.getByTestId('entry-sheet');
    // 前提：內容真的比面板高，面板要捲
    expect(await sheet.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);

    const vh = page.viewportSize()!.height;
    const inView = async (testId: string) => {
      const b = (await page.getByTestId(testId).boundingBox())!;
      return b.y >= 0 && b.y + b.height <= vh;
    };
    // 還沒捲：最後一排（0）與儲存鍵都在畫面內
    expect(await inView('key-0')).toBe(true);
    expect(await inView('key-save')).toBe(true);

    // 捲到最底：鍵盤還在原地，備註欄整個露在鍵盤上面
    await sheet.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    await settle(page);
    expect(await inView('key-0')).toBe(true);
    const note = (await page.getByTestId('entry-note').boundingBox())!;
    const pad = (await page.getByTestId('keypad').boundingBox())!;
    expect(note.y + note.height).toBeLessThanOrEqual(pad.y);
  });
});
