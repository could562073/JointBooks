import { test, expect, type Page } from '@playwright/test';
import { animationsOf, drag, hasDuration, openApp, settle } from './helpers';

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
  test('進子頁自右側 38px 滑入 420ms；按 ‹ 配置頁自左側滑回（C1）', async ({ page }) => {
    await openApp(page);
    await page.getByTestId('tab-settings').click();
    await settle(page);
    await page.getByTestId('open-categories').click();
    const enter = await animationsOf(page.getByTestId('categories-page').locator('xpath=..'));
    expect(enter.some((a) => a.duration === 420 && a.from.includes('38px'))).toBe(true);
    await settle(page);

    await page.getByTestId('categories-back').click();
    const settings = page.getByTestId('settings-screen');
    await expect(settings).toHaveAttribute('data-returning');
    expect((await animationsOf(settings)).some((a) => a.duration === 420 && a.from.includes('-38px'))).toBe(true);
  });

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

  test('刪分類：確認後卡片先收合才消失（C7）', async ({ page }) => {
    await openCategories(page);
    const id = await firstCardId(page);
    await drag(page, page.getByTestId(`cat-${id}`), -100, 0, { steps: 14 });
    await settle(page);
    await page.getByTestId(`cat-${id}-delete`).click();
    await page.evaluate(() => {
      const w = window as unknown as { __collapsed: boolean };
      w.__collapsed = false;
      new MutationObserver((ms) => {
        if (ms.some((m) => (m.target as Element).hasAttribute('data-collapsing'))) w.__collapsed = true;
      }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['data-collapsing'] });
    });
    await page.getByTestId('cat-delete-confirm-confirm').click();
    await expect(page.getByTestId(`cat-${id}`)).toHaveCount(0, { timeout: 2_000 });
    expect(await page.evaluate(() => (window as unknown as { __collapsed: boolean }).__collapsed)).toBe(true);
  });

  test('新增分類：新卡在最上方浮現、名稱欄自動聚焦、不展開圖示選擇器（C8）', async ({ page }) => {
    await openCategories(page);
    await page.getByTestId('categories-add').click();
    // 新分類先存進資料庫才長出卡片：等它的名稱輸入欄出現再量
    const input = page.getByTestId('categories-page').locator('input[data-testid$="-name-input"]');
    await expect(input).toBeFocused();
    const first = page.getByTestId('categories-page').locator('li[data-testid^="cat-"]').first();
    await expect(first.locator('input[data-testid$="-name-input"]')).toHaveCount(1);
    expect((await animationsOf(first)).some((a) => a.duration === 320 && a.from.includes('-10px'))).toBe(true);
    await expect(page.getByTestId('icon-picker')).toHaveCount(0);
  });

  test('點分類圖示：選擇器由下往上 240ms 滑入（C9）', async ({ page }) => {
    await openCategories(page);
    const id = await firstCardId(page);
    await page.getByTestId(`cat-${id}-icon`).click();
    const anims = await animationsOf(page.getByTestId('icon-picker'));
    expect(anims.some((a) => a.duration === 240 && a.from.includes('10px'))).toBe(true);
  });

  test('點金額 pill：變成輸入欄（寬度過場 200ms）並聚焦；✓ 之後彈一下（C11）', async ({ page }) => {
    await openCategories(page);
    const id = await firstCardId(page);
    await page.getByTestId(`cat-${id}-budget`).click();
    const input = page.getByTestId(`cat-${id}-budget-input`);
    await expect(input).toBeFocused();
    expect(hasDuration(await input.evaluate((n) => getComputedStyle(n).transitionDuration), 200)).toBe(true);
    await input.fill('321');
    await page.getByTestId(`cat-${id}-budget-ok`).click();
    await expect(page.getByTestId(`cat-${id}-budget`)).toHaveAttribute('data-popping');
  });

  test('切支出／收入：滑塊位移，清單整區自方向側滑入（C12）', async ({ page }) => {
    await openCategories(page);
    expect(hasDuration(await page.getByTestId('catkind-slider').evaluate((n) => getComputedStyle(n).transitionDuration), 420)).toBe(true);
    await page.getByTestId('catkind-income').click();
    const list = await animationsOf(page.getByTestId('categories-scroll'), true);
    expect(list.some((a) => a.duration === 420 && a.from.includes('38px'))).toBe(true);
  });
});

test('配置頁開關：knob 位移 220ms，軌道同時轉色（C13）', async ({ page }) => {
  await openApp(page);
  await page.getByTestId('tab-settings').click();
  await settle(page);
  const toggle = page.getByTestId('toggle-who');
  const knob = page.getByTestId('toggle-who-knob');
  expect(hasDuration(await knob.evaluate((n) => getComputedStyle(n).transitionDuration), 220)).toBe(true);
  const before = { x: (await knob.boundingBox())!.x, bg: await toggle.evaluate((n) => getComputedStyle(n).backgroundColor) };
  await toggle.click();
  await settle(page);
  expect((await knob.boundingBox())!.x).not.toBe(before.x);
  expect(await toggle.evaluate((n) => getComputedStyle(n).backgroundColor)).not.toBe(before.bg);
});
