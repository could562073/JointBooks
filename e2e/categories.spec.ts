import { test, expect, type Page } from '@playwright/test';
import { drag, openApp, settle } from './helpers';

/**
 * 配置頁與分類子頁：原本 docs/MANUAL-TESTS.md 的 C1–C13（手動驗），能在 Chromium 量到的都搬來這裡。
 * 左滑的門檻與阻尼數值另有 gesture.spec.ts。
 */

async function openCategories(page: Page): Promise<void> {
  await openApp(page);
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('open-categories').click();
  await expect(page.getByTestId('categories-page')).toBeVisible();
  await settle(page);
}

/** 清單第一張分類卡的 id（卡片 testid 是 cat-<id>） */
async function firstCardId(page: Page): Promise<string> {
  const tid = await page.getByTestId('categories-page').locator('li[data-testid^="cat-"]').first().getAttribute('data-testid');
  return tid!.slice('cat-'.length);
}

test.describe('分類子頁（§7.2、MOTION #14–#19）', () => {

  test('分類卡左滑：跟手露出刪除鍵；往右拖回原位（C2、C4、C5）', async ({ page }) => {
    await openCategories(page);
    const id = await firstCardId(page);
    const card = page.getByTestId(`cat-${id}`);

    // data-open 掛在卡片本體（li 裡面那一層），不是 li
    await drag(page, card, -100, 0, { steps: 14 });
    await expect(card.locator('[data-open]')).toHaveCount(1);
    await settle(page);
    await drag(page, card, 100, 0, { steps: 14 });
    await expect(card.locator('[data-open]')).toHaveCount(0);
  });

  test('在卡上小幅度（<10px）移動後放開：卡內的名稱仍點得到（C6）', async ({ page }) => {
    await openCategories(page);
    const id = await firstCardId(page);
    const name = page.getByTestId(`cat-${id}-name`);
    const b = (await name.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 5, b.y + b.height / 2, { steps: 3 });
    await page.mouse.up();
    await expect(page.getByTestId(`cat-${id}-name-input`)).toBeVisible();
  });

  test('刪分類：確認後卡片消失（C7）', async ({ page }) => {
    await openCategories(page);
    const id = await firstCardId(page);
    await drag(page, page.getByTestId(`cat-${id}`), -100, 0, { steps: 14 });
    await settle(page);
    await page.getByTestId(`cat-${id}-delete`).click();
    await page.getByTestId('cat-delete-confirm-confirm').click();
    await expect(page.getByTestId(`cat-${id}`)).toHaveCount(0, { timeout: 2_000 });
  });

  test('新增分類：新卡在最上方、名稱欄自動聚焦、不展開圖示選擇器（C8）', async ({ page }) => {
    await openCategories(page);
    await page.getByTestId('categories-add').click();
    // 新分類先存進資料庫才長出卡片：等它的名稱輸入欄出現再量
    const input = page.getByTestId('categories-page').locator('input[data-testid$="-name-input"]');
    await expect(input).toBeFocused();
    const first = page.getByTestId('categories-page').locator('li[data-testid^="cat-"]').first();
    await expect(first.locator('input[data-testid$="-name-input"]')).toHaveCount(1);
    await expect(page.getByTestId('icon-picker')).toHaveCount(0);
  });

  test('點金額 pill：變成輸入欄並聚焦；✓ 之後存下新的預算（C11）', async ({ page }) => {
    await openCategories(page);
    const id = await firstCardId(page);
    await page.getByTestId(`cat-${id}-budget`).click();
    const input = page.getByTestId(`cat-${id}-budget-input`);
    await expect(input).toBeFocused();
    await input.fill('321');
    await page.getByTestId(`cat-${id}-budget-ok`).click();
    await expect(page.getByTestId(`cat-${id}-budget`)).toContainText('321');
  });

});

test('配置頁開關：點了 knob 換邊、軌道轉色（C13）', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-settings').click();
  await settle(page);
  const toggle = page.getByTestId('toggle-who');
  const knob = page.getByTestId('toggle-who-knob');
  const before = { x: (await knob.boundingBox())!.x, bg: await toggle.evaluate((n) => getComputedStyle(n).backgroundColor) };
  await toggle.click();
  await settle(page);
  expect((await knob.boundingBox())!.x).not.toBe(before.x);
  expect(await toggle.evaluate((n) => getComputedStyle(n).backgroundColor)).not.toBe(before.bg);
});
