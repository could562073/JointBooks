import { test, expect } from '@playwright/test';
import { EASE } from '../src/lib/motion';

// motion.css 的 --ease-* 自訂屬性和 motion.ts 的 EASE 是同一組四條 easing
// 各自抄了一份字串。目前沒有任何元件消費 CSS 那份，也沒有任何測試檢查兩邊
// 一致——Plan 03／04 一旦有人改了其中一邊而漏改另一邊，37 個動畫全部悄悄
// 分岔，只能靠人眼對曲線才會在驗收時發現。這支 spec 把兩邊釘在一起。

const CSS_TO_EASE: Record<string, keyof typeof EASE> = {
  '--ease-enter': 'enter',
  '--ease-move': 'move',
  '--ease-sheet': 'sheet',
  '--ease-exit': 'exit',
};

test.describe('motion 常數：CSS 與 TS 兩份 easing 必須逐字一致', () => {
  test.beforeEach(async ({ page }) => { await page.goto('/'); });

  for (const [cssVar, key] of Object.entries(CSS_TO_EASE)) {
    test(`${cssVar} 等於 EASE.${key}`, async ({ page }) => {
      const actual = await page.evaluate(
        (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(),
        cssVar
      );
      expect(actual).toBe(EASE[key]);
    });
  }
});
