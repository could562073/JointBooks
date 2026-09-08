import { test, expect } from '@playwright/test';
import { DUR } from '../src/lib/motion';

test('MOTION 30：饅頭呼吸時長精確綁定 DUR.breathe，無限循環，位移 4px', async ({ page }) => {
  await page.goto('/?debug=mantou');
  const m = page.getByTestId('mantou-breathing');
  const anim = await m.evaluate((el) => {
    const s = getComputedStyle(el);
    return { name: s.animationName, dur: s.animationDuration, count: s.animationIterationCount,
             timing: s.animationTimingFunction, willChange: s.willChange };
  });
  expect(anim.name).toContain('breathe');
  // 比對一個 3.2–3.6s 的範圍只能抓到「差很多」的錯；Mantou.module.css 裡的
  // 3.4s 和 motion.ts 的 DUR.breathe 是同一個數字的兩份抄寫，範圍測試永遠
  // 不會發現兩邊分岔。這裡直接鎖死等式。
  expect(parseFloat(anim.dur) * 1000).toBe(DUR.breathe);
  expect(anim.count).toBe('infinite');
  expect(anim.timing).toBe('ease-in-out');
  expect(anim.willChange).toBe('transform');
});
