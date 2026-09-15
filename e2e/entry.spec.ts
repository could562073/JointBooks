import { test, expect, type Page } from '@playwright/test';
import { animationsOf, drag, hasDuration, matrixOf, openApp, sawAttribute, seedTxns, settle, watchAttribute } from './helpers';

/**
 * 記一筆／編輯面板：原本 docs/MANUAL-TESTS.md 的 E1–E16（手動驗），能在 Chromium 量到的都搬來這裡。
 */

async function openSheet(page: Page): Promise<void> {
  await page.getByTestId('fab').click();
  await expect(page.getByTestId('entry-sheet')).toBeVisible();
  await settle(page);
}

/** 記下畫面上有沒有任何元素被加上 data-collapsing（高度收合動畫只有 260ms，輪詢容易錯過） */
async function watchCollapsing(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __collapsed: boolean };
    w.__collapsed = false;
    new MutationObserver((ms) => {
      if (ms.some((m) => (m.target as Element).hasAttribute('data-collapsing'))) w.__collapsed = true;
    }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-collapsing'] });
  });
}

test.describe('記一筆面板（§5、MOTION #1–#4 #35–#38）', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });

  test('點 ＋：面板由下往上 340ms 滑進來、遮罩淡入；按 ✕ 播完下滑才消失（E1、E2）', async ({ page }) => {
    await page.getByTestId('fab').click();
    const sheet = page.getByTestId('entry-sheet');
    const sheetIn = await animationsOf(sheet);
    expect(sheetIn.some((a) => a.duration === 340 && a.from.includes('100%'))).toBe(true);
    expect((await animationsOf(page.getByTestId('entry-scrim'))).length).toBeGreaterThan(0);
    await settle(page);

    await page.getByTestId('entry-close').click();
    await expect(page.locator('[data-closing]').first()).toBeAttached();
    await page.waitForTimeout(120);
    await expect(sheet).toHaveCount(1);
    await expect(sheet).toHaveCount(0, { timeout: 1_500 });
  });

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

  test('按住數字鍵：下壓 3px、縮 .96、底色轉淡紫；儲存鍵只下壓 4px 不縮放（E5、E6）', async ({ page }) => {
    await openSheet(page);
    const press = async (testId: string) => {
      // iPhone SE 高度只有 667，鍵盤在面板裡要先捲進畫面，否則滑鼠按到畫面外
      await page.getByTestId(testId).scrollIntoViewIfNeeded();
      const b = (await page.getByTestId(testId).boundingBox())!;
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.mouse.down();
      await expect(page.getByTestId(testId)).toHaveAttribute('data-pressed');
      await page.waitForTimeout(200);
    };

    await press('key-7');
    const key = await matrixOf(page.getByTestId('key-7'));
    expect(key.y).toBeCloseTo(3, 0);
    expect(key.sx).toBeCloseTo(0.96, 2);
    expect(await page.getByTestId('key-7').evaluate((n) => getComputedStyle(n).backgroundColor)).toBe('rgb(237, 233, 250)');
    await page.mouse.up();
    await expect(page.getByTestId('key-7')).not.toHaveAttribute('data-pressed');

    await press('key-save');
    const save = await matrixOf(page.getByTestId('key-save'));
    expect(save.y).toBeCloseTo(4, 0);
    expect(save.sx).toBeCloseTo(1, 2);
    await page.mouse.move(5, 5);
    await page.mouse.up();
  });

  test('⌫ 鍵是淡紫底 #EDE9FA、深紫圖示 #6B57B8（E7）', async ({ page }) => {
    await openSheet(page);
    const c = await page.getByTestId('key-back').evaluate((n) => ({ bg: getComputedStyle(n).backgroundColor, fg: getComputedStyle(n).color }));
    expect(c.bg).toBe('rgb(237, 233, 250)');
    expect(c.fg).toBe('rgb(107, 87, 184)');
  });

  test('切換支出／收入：滑塊位移 420ms，底色跟著換（E8）', async ({ page }) => {
    await openSheet(page);
    const slider = page.getByTestId('kind-slider');
    expect(hasDuration(await slider.evaluate((n) => getComputedStyle(n).transitionDuration), 420)).toBe(true);
    const before = { x: (await slider.boundingBox())!.x, bg: await slider.evaluate((n) => getComputedStyle(n).backgroundColor) };
    await page.getByTestId('kind-income').click();
    await settle(page);
    expect((await slider.boundingBox())!.x).not.toBe(before.x);
    expect(await slider.evaluate((n) => getComputedStyle(n).backgroundColor)).not.toBe(before.bg);
  });

  test('點日期欄：▾ 轉 180°、欄位套紫框、小月曆由下往上滑入（E9）', async ({ page }) => {
    await openSheet(page);
    await page.getByTestId('date-row').click();
    await expect(page.getByTestId('mini-calendar')).toBeVisible();
    const panel = await animationsOf(page.getByTestId('date-row-panel'), true);
    expect(panel.some((a) => a.duration === 240)).toBe(true);
    await settle(page);
    expect(Math.abs((await matrixOf(page.getByTestId('date-row-chevron'))).angle)).toBe(180);
    expect(await page.getByTestId('date-row').evaluate((n) => getComputedStyle(n).boxShadow)).toContain('183, 166, 229');
  });

  test('存一筆：月曆那天的金額跳一下、新紀錄浮現（E12、E13）', async ({ page }) => {
    await openSheet(page);
    // 金額跳一下只有 300ms，而且那格原本沒金額時是新長出來的元素，用觀察的不用輪詢
    await watchAttribute(page, 'data-popping');
    await page.getByTestId('key-4').click();
    await page.getByTestId('key-2').click();
    await page.getByTestId('key-save').click();
    await expect.poll(() => sawAttribute(page, 'data-popping'), { timeout: 2_000 }).toBe(true);
    const rows = await animationsOf(page.getByTestId('txn-list'), true);
    expect(rows.some((a) => a.duration === 320)).toBe(true);
  });

  test('編輯模式按垃圾桶：確認窗彈出並寫出這筆；確認後面板關閉、該筆收合消失（E14、E15）', async ({ page }) => {
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
    const dialog = await animationsOf(page.getByTestId('delete-confirm-scrim'), true);
    expect(dialog.some((a) => a.duration === 220)).toBe(true);
    await settle(page);

    await watchCollapsing(page);
    await page.getByTestId('delete-confirm-confirm').click();
    await expect(page.getByTestId('entry-sheet')).toHaveCount(0, { timeout: 1_500 });
    await expect(page.locator('[data-testid^="txn-seed-"]')).toHaveCount(0, { timeout: 2_000 });
    expect(await page.evaluate(() => (window as unknown as { __collapsed: boolean }).__collapsed)).toBe(true);
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
});
