import { test, expect, type Page } from '@playwright/test';
import { localDate, openApp, seedTxns, settle } from './helpers';

/**
 * 統計頁：原本 docs/MANUAL-TESTS.md 的 S1–S10（手動驗），能在 Chromium 量到的都搬來這裡。
 */

const money = (s: string) => Number(s.replace(/[^0-9.-]/g, ''));

async function goStats(page: Page): Promise<void> {
  await page.getByTestId('tab-stats').click();
  await expect(page.getByTestId('stats-screen')).toBeVisible();
}

test('統計頁的支出：本月與本週各自算對（S2、S3）', async ({ page }) => {
  await openApp(page);
  // 一筆在今天（本週），一筆在本月但離今天超過一週，本週與本月的支出才會不同
  const far = new Date().getDate() > 8 ? 1 : 28;
  await seedTxns(page, [{ cents: 10_000 }, { day: localDate(far), cents: 90_000 }]);
  await openApp(page);
  await goStats(page);
  const expense = page.getByTestId('overview-expense');
  await expect(expense).toContainText('1,000', { timeout: 2_000 });

  await page.getByTestId('dimension-week').click();
  await expect.poll(async () => money((await expense.textContent()) ?? ''), { timeout: 2_000 }).toBe(100);
});

test('換維度後趨勢圖的線樣式正確（S4、S5）', async ({ page }) => {
  await openApp(page);
  await seedTxns(page, [{ cents: 10_000 }, { cents: 5_000, kind: 'income' }]);
  await openApp(page);
  await goStats(page);
  await settle(page);
  await page.getByTestId('dimension-year').click();
  await settle(page);

  const line = await page.getByTestId('trend-expense').evaluate((n) => getComputedStyle(n).stroke);
  const income = await page.getByTestId('trend-income').evaluate((n) => ({ stroke: getComputedStyle(n).stroke, dash: getComputedStyle(n).strokeDasharray }));
  expect(line).toBe('rgb(148, 132, 206)');
  expect(income.stroke).toBe('rgb(125, 184, 157)');
  expect(income.dash).not.toBe('none');
  await expect(page.getByTestId('trend-area')).toBeAttached();
});

test('預算條：超支轉橘、寫出超支多少；用到九成轉黃（S6、S7、S8）', async ({ page }) => {
  await openApp(page);
  // 娛樂預算 200 花 250（超支 50）；交通預算 180 花 162（九成）
  await seedTxns(page, [{ categoryIndex: 4, cents: 25_000 }, { categoryIndex: 5, cents: 16_200 }]);
  await openApp(page);
  await goStats(page);

  const bars = page.locator('[data-testid$="-bar"][data-state]');
  await expect(bars.first()).toBeAttached();

  const over = page.locator('[data-testid$="-bar"][data-state="over"]');
  const warn = page.locator('[data-testid$="-bar"][data-state="warn"]');
  await expect(over).toHaveCount(1);
  await expect(warn).toHaveCount(1);
  await settle(page);
  expect(await over.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe('rgb(242, 179, 160)');
  expect(await warn.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe('rgb(246, 216, 154)');
  await expect(page.locator('[data-testid$="-over"]')).toHaveText('超支 $50');
});

test('日常頁選了別月的某一天：統計頁的期間是那一天所在的月份（S10）', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: '上個月' }).click();
  await page.getByTestId('cell-15').click();
  await goStats(page);
  const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getMonth() + 1;
  await expect(page.getByTestId('overview-period')).toContainText(`${prev}/1 ~ ${prev}/`);
});
