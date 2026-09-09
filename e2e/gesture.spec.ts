import { test, expect, type Page, type Locator } from '@playwright/test';

/**
 * 從計算後的 transform 取出位移。
 * translate3d 搭配 will-change: transform 時，Chrome 可能回報 matrix3d 而不是 matrix，
 * 兩種都要吃 —— 只認 matrix 的正規式會 match 失敗然後 null 解參考。
 *   matrix(a, b, c, d, tx, ty)
 *   matrix3d(...12 個值..., tx, ty, tz, 1)
 */
async function translationOf(el: Locator): Promise<{ x: number; y: number }> {
  return el.evaluate((n) => {
    const t = getComputedStyle(n).transform;
    if (t === 'none') return { x: 0, y: 0 };
    const v = t.slice(t.indexOf('(') + 1, -1).split(',').map((s) => Number(s.trim()));
    return t.startsWith('matrix3d')
      ? { x: v[12]!, y: v[13]! }
      : { x: v[4]!, y: v[5]! };
  });
}

/** 用真實 pointer 事件拖曳，分段移動讓 pointermove 真的觸發 */
async function drag(
  page: Page, testId: string, dx: number, dy: number, steps = 12
) {
  const box = (await page.getByTestId(testId).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
    await page.waitForTimeout(8);
  }
  await page.mouse.up();
  await page.waitForTimeout(50);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?debug=gesture');
  // goto() 只等到 load，不保證 lazy-import 的 debug chunk 已經 parse／render
  // 完成——第一個互動可能跟 chunk 載入賽跑。等一個把手真正 visible 再開始。
  await page.getByTestId('drag-panelDismiss').waitFor({ state: 'visible' });
});

test('§11-15：未超過 10px 門檻時，卡內按鈕仍收得到 click', async ({ page }) => {
  const btn = page.getByTestId('btn-categoryCard');
  const box = (await btn.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 5, box.y + box.height / 2);
  await page.mouse.up();
  await expect(page.getByTestId('log-categoryCard')).toHaveText(/click/);
});

test('超過門檻後接管，click 不再觸發', async ({ page }) => {
  await drag(page, 'btn-categoryCard', -60, 0);
  const log = await page.getByTestId('log-categoryCard').textContent();
  expect(log).not.toContain('click');
  expect(log).toContain('snap:-1');
});

test('§10 #7：跟手比例 ×0.55，且拖曳中沒有 transition', async ({ page }) => {
  const el = page.getByTestId('drag-monthSwipe');
  const box = (await el.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(x - i * 8, y); await page.waitForTimeout(8); }

  const mid = await el.evaluate((n) => ({
    transition: getComputedStyle(n).transitionProperty,
    dragging: n.getAttribute('data-dragging'),
  }));
  const { x: tx } = await translationOf(el);
  await page.mouse.up();

  expect(mid.dragging).toBe('1');
  expect(mid.transition).toBe('none');   // 拖曳中必須關掉 transition
  expect(tx).toBeCloseTo(-44, 0);         // 拖 80px × 0.55 = 44px
});

test('§10 #15：超出 -84px 界線後套阻尼，不是硬止', async ({ page }) => {
  const el = page.getByTestId('drag-categoryCard');
  const box = (await el.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) { await page.mouse.move(x - i * 8, y); await page.waitForTimeout(8); }
  const { x: tx } = await translationOf(el);
  await page.mouse.up();

  // 拖 128px：界 -84，超出 44px × 0.3 → -97.2
  expect(tx).toBeLessThan(-84);          // 有越界，不是硬止在 -84
  expect(tx).toBeCloseTo(-97.2, 0);
});

test('§10 #13：位移 <6px 判為點擊而非拖曳', async ({ page }) => {
  await drag(page, 'drag-calendarHandle', 0, 4, 3);
  await expect(page.getByTestId('log-calendarHandle')).toHaveText(/tap/);
});

test('§10 #13：位移 >138px 吸附', async ({ page }) => {
  await drag(page, 'drag-calendarHandle', 0, -160);
  await expect(page.getByTestId('log-calendarHandle')).toHaveText(/snap:-1/);
});

test('§10 #22/#35：面板不往上超過 0', async ({ page }) => {
  const el = page.getByTestId('drag-panelDismiss');
  const box = (await el.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(x, y - i * 8); await page.waitForTimeout(8); }
  const { y: ty } = await translationOf(el);
  await page.mouse.up();
  // 往上 80px：界 0，超出 -80 × 0.4 = -32（有阻尼但不硬止）
  expect(ty).toBeCloseTo(-32, 0);
});

test('touch-action 依軸設定（§10 通則）', async ({ page }) => {
  const y = await page.getByTestId('drag-calendarHandle')
    .evaluate((n) => getComputedStyle(n).touchAction);
  const x = await page.getByTestId('drag-monthSwipe')
    .evaluate((n) => getComputedStyle(n).touchAction);
  expect(y).toBe('none');
  expect(x).toBe('pan-y');
});
