import { test, expect, type Page } from '@playwright/test';
import { animationsOf, hasDuration, localDate, openApp, sampleText, seedTxns, settle } from './helpers';

/**
 * 統計頁：原本 docs/MANUAL-TESTS.md 的 S1–S10（手動驗），能在 Chromium 量到的都搬來這裡。
 */

const money = (s: string) => Number(s.replace(/[^0-9.-]/g, ''));

async function goStats(page: Page): Promise<void> {
  await page.getByTestId('tab-stats').click();
  await expect(page.getByTestId('stats-screen')).toBeVisible();
}

test('週／月／年：白色滑塊位移 420ms（S1）', async ({ page }) => {
  await openApp(page);
  await goStats(page);
  await settle(page);
  const slider = page.getByTestId('dimension-slider');
  expect(hasDuration(await slider.evaluate((n) => getComputedStyle(n).transitionDuration), 420)).toBe(true);
  const x0 = (await slider.boundingBox())!.x;
  await page.getByTestId('dimension-week').click();
  await settle(page);
  expect((await slider.boundingBox())!.x).not.toBe(x0);
});

test('進統計頁數字跑上來；換維度從前一個值跑到新值，不是從 0 重跑（S2、S3）', async ({ page }) => {
  await openApp(page);
  // 一筆在今天（本週），一筆在本月但離今天超過一週，本週與本月的支出才會不同
  const far = new Date().getDate() > 8 ? 1 : 28;
  await seedTxns(page, [{ cents: 10_000 }, { day: localDate(far), cents: 90_000 }]);
  await openApp(page);
  await goStats(page);
  const expense = page.getByTestId('overview-expense');
  expect(new Set(await sampleText(expense, 700)).size).toBeGreaterThanOrEqual(3);
  await expect(expense).toContainText('1,000', { timeout: 2_000 });

  await page.getByTestId('dimension-week').click();
  const values = (await sampleText(expense, 700)).map(money);
  expect(Math.min(...values)).toBeGreaterThan(0);
  expect(values[0]).toBeGreaterThan(values[values.length - 1]!);
  await expect(expense).toContainText('100', { timeout: 2_000 });
});

test('換維度：支出線重新描出來（600ms）；線的樣式正確（S4、S5）', async ({ page }) => {
  await openApp(page);
  await seedTxns(page, [{ cents: 10_000 }, { cents: 5_000, kind: 'income' }]);
  await openApp(page);
  await goStats(page);
  await settle(page);
  await page.getByTestId('dimension-year').click();
  expect((await animationsOf(page.getByTestId('trend-expense'))).some((a) => a.duration === 600)).toBe(true);
  await settle(page);

  const line = await page.getByTestId('trend-expense').evaluate((n) => getComputedStyle(n).stroke);
  const income = await page.getByTestId('trend-income').evaluate((n) => ({ stroke: getComputedStyle(n).stroke, dash: getComputedStyle(n).strokeDasharray }));
  expect(line).toBe('rgb(148, 132, 206)');
  expect(income.stroke).toBe('rgb(125, 184, 157)');
  expect(income.dash).not.toBe('none');
  await expect(page.getByTestId('trend-area')).toBeAttached();
});

test('預算條：依序由左往右填充（每條差 50ms）；超支轉橘並閃一下、寫出超支多少；用到九成轉黃（S6、S7、S8）', async ({ page }) => {
  await openApp(page);
  // 娛樂預算 200 花 250（超支 50）；交通預算 180 花 162（九成）
  await seedTxns(page, [{ categoryIndex: 4, cents: 25_000 }, { categoryIndex: 5, cents: 16_200 }]);
  await openApp(page);
  await goStats(page);

  const bars = page.locator('[data-testid$="-bar"][data-state]');
  await expect(bars.first()).toBeAttached();
  const fills = await bars.evaluateAll((ns) => ns.map((n) => n.getAnimations()
    .map((a) => a.effect!.getComputedTiming())
    .filter((t) => Number(t.duration) === 600)
    .map((t) => Number(t.delay))[0]));
  expect(fills.length).toBeGreaterThan(2);
  fills.forEach((delay, i) => expect(delay).toBe(i * 50));

  const over = page.locator('[data-testid$="-bar"][data-state="over"]');
  const warn = page.locator('[data-testid$="-bar"][data-state="warn"]');
  await expect(over).toHaveCount(1);
  await expect(warn).toHaveCount(1);
  expect((await animationsOf(over)).some((a) => a.duration === 200)).toBe(true);
  await settle(page);
  expect(await over.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe('rgb(242, 179, 160)');
  expect(await warn.evaluate((n) => getComputedStyle(n).backgroundColor)).toBe('rgb(246, 216, 154)');
  await expect(page.locator('[data-testid$="-over"]')).toHaveText('超支 $50');
});

test('減少動態效果：數字直接落在終值、折線不描線（S9）', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openApp(page);
  await seedTxns(page, [{ cents: 10_000 }]);
  await openApp(page);
  await goStats(page);
  const seen = await sampleText(page.getByTestId('overview-expense'), 400);
  expect(new Set(seen).size).toBe(1);
  expect(seen[0]).toContain('100');
  expect(await page.getByTestId('trend-expense').getAttribute('style') ?? '').not.toContain('stroke-dasharray');
});

test('日常頁選了別月的某一天：統計頁的期間是那一天所在的月份（S10）', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: '上個月' }).click();
  await page.getByTestId('cell-15').click();
  await goStats(page);
  const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).getMonth() + 1;
  await expect(page.getByTestId('overview-period')).toContainText(`${prev}/1 ~ ${prev}/`);
});
