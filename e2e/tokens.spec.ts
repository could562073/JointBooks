import { test, expect } from '@playwright/test';

const TOKENS: Record<string, string> = {
  '--c-bg': '#FFF6EC',
  '--c-card': '#FFFFFF',
  '--c-text': '#4A3F36',
  '--c-face': '#3B3229',
  '--c-text-2': 'rgba(74,63,54,.5)',
  '--c-text-3': 'rgba(74,63,54,.45)',
  '--c-text-4': 'rgba(74,63,54,.42)',
  '--c-primary': '#B7A6E5',
  '--c-primary-deep': '#6B57B8',
  '--c-primary-deep-shadow': '#4E3F92',
  '--c-hi': '#CDC0F0',
  '--c-shade': '#9484CE',
  '--c-tint': '#EDE9FA',
  '--c-tint-ink': '#5E4FA0',
  '--c-income': '#3E7F63',
  '--c-income-bg': '#E6F4EE',
  '--c-income-bar-a': '#DDA6D0',
  '--c-income-bar-b': '#88CFC6',
  '--c-expense': '#B85F42',
  '--c-expense-bg': '#FBEBE4',
  '--c-sync': '#4E9B7A',
  '--c-blush': '#F79BA0',
  '--r-lg': '24px',
  '--r-md': '20px',
  '--r-sm': '18px',
  '--r-pill': '999px',
  '--sh-card': '0 3px 0 rgba(74,63,54,.06)',
  '--sh-card-lg': '0 4px 0 rgba(74,63,54,.07)',
};

test.describe('design tokens', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  for (const [name, expected] of Object.entries(TOKENS)) {
    test(`${name} = ${expected}`, async ({ page }) => {
      const actual = await page.evaluate(
        (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
        name
      );
      expect(actual).toBe(expected);
    });
  }

  test('沒有任何模糊陰影 token', async ({ page }) => {
    const shadows = await page.evaluate(() =>
      ['--sh-card', '--sh-card-lg'].map((n) =>
        getComputedStyle(document.documentElement).getPropertyValue(n).trim()
      )
    );
    // 實體感陰影的 blur radius 必須是 0：格式為 "0 Npx 0 rgba(...)"
    for (const s of shadows) expect(s).toMatch(/^0 \d+px 0 /);
  });

  test('color-scheme 固定 light，body 不出現橡皮筋捲動', async ({ page }) => {
    const cs = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
    expect(cs).toBe('light');
    const ob = await page.evaluate(() => getComputedStyle(document.body).overscrollBehavior);
    expect(ob).toBe('none');
  });
});
