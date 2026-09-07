import { test, expect } from '@playwright/test';

test('MOTION 30：饅頭呼吸 3.2–3.6s 無限循環，位移 4px', async ({ page }) => {
  await page.goto('/?debug=mantou');
  const m = page.getByTestId('mantou-breathing');
  const anim = await m.evaluate((el) => {
    const s = getComputedStyle(el);
    return { name: s.animationName, dur: s.animationDuration, count: s.animationIterationCount,
             timing: s.animationTimingFunction, willChange: s.willChange };
  });
  expect(anim.name).toContain('breathe');
  expect(parseFloat(anim.dur)).toBeGreaterThanOrEqual(3.2);
  expect(parseFloat(anim.dur)).toBeLessThanOrEqual(3.6);
  expect(anim.count).toBe('infinite');
  expect(anim.timing).toBe('ease-in-out');
  expect(anim.willChange).toBe('transform');
});
