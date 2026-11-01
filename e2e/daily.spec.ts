import { test, expect } from '@playwright/test';
import { drag, openApp, seedTxns, settle } from './helpers';

/**
 * 日常頁：原本 docs/MANUAL-TESTS.md 的 D1–D28（手動驗），能在 Chromium 量到的都搬來這裡。
 * 門檻與跟手比例的數值另有 gesture.spec.ts；這裡驗的是實際畫面上的行為。
 */

test.describe('月曆把手（§4、MOTION #13）', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });

  test('點一下切換收起／展開，提示文字跟著換（D5、D8）', async ({ page }) => {
    const handle = page.getByTestId('calendar-handle');
    await expect(handle).toContainText('往上滑看更多明細');
    await handle.click();
    await expect(handle).toHaveAttribute('data-collapsed');
    await expect(handle).toContainText('往下拉看月曆');
    await handle.click();
    await expect(handle).not.toHaveAttribute('data-collapsed');
  });

  test('只往上滑一小段就慢慢放手：彈回展開（D3）', async ({ page }) => {
    const handle = page.getByTestId('calendar-handle');
    const region = page.getByTestId('calendar-region');
    const full = await region.evaluate((n) => n.getBoundingClientRect().height);
    await drag(page, handle, 0, -40, { steps: 10, pause: 30 });
    await settle(page);
    await expect(handle).not.toHaveAttribute('data-collapsed');
    expect(Math.abs(await region.evaluate((n) => n.getBoundingClientRect().height) - full)).toBeLessThan(2);
  });

  test('收起後往下拉：跟手回來，高度不超過 460px 上限（D6）', async ({ page }) => {
    const handle = page.getByTestId('calendar-handle');
    const region = page.getByTestId('calendar-region');
    await handle.click();
    await settle(page);
    // 放開的位置要留在視窗內，否則 pointerup 不會送出、手勢結束不了
    const box = (await handle.boundingBox())!;
    const room = page.viewportSize()!.height - (box.y + box.height / 2) - 10;
    await drag(page, handle, 0, room, { steps: 20, release: false });
    expect(await region.evaluate((n) => n.getBoundingClientRect().height)).toBeLessThanOrEqual(461);
    await page.mouse.up();
    await expect(handle).not.toHaveAttribute('data-collapsed');
  });

  test('明細捲到中段後收起再展開，捲動位置不變（D7）', async ({ page }) => {
    await seedTxns(page, Array.from({ length: 30 }, () => ({})));
    await openApp(page);
    const scroll = page.getByTestId('txn-scroll');
    await scroll.evaluate((n) => { n.scrollTop = 150; });
    const handle = page.getByTestId('calendar-handle');
    await handle.click();
    await settle(page);
    await handle.click();
    await settle(page);
    expect(Math.abs(await scroll.evaluate((n) => n.scrollTop) - 150)).toBeLessThanOrEqual(2);
  });
});

test.describe('月曆選取與數字（§4、MOTION #6 #12 #31）', () => {

});

test.describe('懸浮 ＋ 與分頁列（§2、MOTION #8 #9 #10 #28 #29）', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });

  test('＋ 是 54×54、圓角 19px、紫色漸層，沒有投射陰影（D13）', async ({ page }) => {
    const s = await page.getByTestId('fab').evaluate((n) => {
      const c = getComputedStyle(n);
      return { w: n.getBoundingClientRect().width, h: n.getBoundingClientRect().height, r: c.borderRadius, bg: c.backgroundImage, shadow: c.boxShadow };
    });
    expect([Math.round(s.w), Math.round(s.h)]).toEqual([54, 54]);
    expect(s.r).toBe('19px');
    expect(s.bg).toContain('linear-gradient');
    // 每一道不是 inset 的陰影，模糊半徑都必須是 0（只允許髮絲邊）
    const outer = s.shadow.split(/,(?![^(]*\))/).map((x) => x.trim()).filter((x) => !x.includes('inset'));
    for (const sh of outer) {
      const lengths = sh.replace(/rgba?\([^)]*\)/, '').trim().split(/\s+/).map(parseFloat);
      expect(lengths[2] ?? 0, sh).toBe(0);
    }
  });

  test('按住 ＋ 後滑開手指再放開，不會打開記一筆（D14）', async ({ page }) => {
    const fab = page.getByTestId('fab');
    const box = (await fab.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(fab).toHaveAttribute('data-pressed');
    await page.mouse.move(20, 200, { steps: 5 });
    await expect(fab).not.toHaveAttribute('data-pressed');
    await page.mouse.up();
    await page.waitForTimeout(300);
    await expect(page.getByTestId('entry-sheet')).toHaveCount(0);
  });

  test('＋ 只在日常頁（D15）', async ({ page }) => {
    await page.getByTestId('tab-stats').click();
    await expect(page.getByTestId('fab')).toHaveCount(0);
    await page.getByTestId('tab-settings').click();
    await expect(page.getByTestId('fab')).toHaveCount(0);
    await page.getByTestId('tab-daily').click();
    await expect(page.getByTestId('fab')).toHaveCount(1);
  });

  test('分頁列是毛玻璃：半透明加 blur（D16）', async ({ page }) => {
    const glass = await page.getByTestId('tab-bar').evaluate((bar) => {
      for (let n: Element | null = bar; n; n = n.parentElement) {
        const c = getComputedStyle(n) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
        const f = c.backdropFilter || c.webkitBackdropFilter || '';
        if (f.includes('blur')) return f;
      }
      for (const n of bar.querySelectorAll('*')) {
        const c = getComputedStyle(n) as CSSStyleDeclaration & { webkitBackdropFilter?: string };
        const f = c.backdropFilter || c.webkitBackdropFilter || '';
        if (f.includes('blur')) return f;
      }
      return '';
    });
    expect(glass).toContain('blur(22px)');
  });

});

test.describe('換月與年月選擇器（MOTION #7 #33 #34）', () => {
  test.beforeEach(async ({ page }) => { await openApp(page); });

  test('月曆往左滑換到下個月；斜著滑（垂直為主）不換（D18、D19）', async ({ page }) => {
    const title = page.getByTestId('month-title');
    const start = await title.textContent();
    await drag(page, page.getByTestId('month-calendar'), -40, 170, { steps: 14 });
    await settle(page);
    expect(await title.textContent()).toBe(start);

    await drag(page, page.getByTestId('month-calendar'), -160, 0, { steps: 14 });
    await expect(title).not.toHaveText(start ?? '');
  });

});

test.describe('下拉重整與明細浮現（MOTION #5 #27）', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await seedTxns(page, Array.from({ length: 30 }, () => ({})));
    await openApp(page);
    await settle(page);
  });

  test('明細不在頂端時往下拉：不會觸發重整（D24）', async ({ page }) => {
    const scroll = page.getByTestId('txn-scroll');
    await scroll.evaluate((n) => { n.scrollTop = 200; });
    await drag(page, scroll, 0, 120, { release: false });
    await expect(page.getByTestId('pull-indicator')).toHaveAttribute('data-phase', 'idle');
    await page.mouse.up();
  });

  test('捲到頂再往下拉：指示器跟手、上限 64px，放手轉一圈收回；之後照常捲動（D25、D26）', async ({ page }) => {
    const scroll = page.getByTestId('txn-scroll');
    const pull = page.getByTestId('pull-indicator');
    // iPhone SE 只有 667 高：先收起月曆讓明細有空間，拖曳也不能拉出視窗外（否則 pointerup 送不出去）
    await page.getByTestId('calendar-handle').click();
    await settle(page);
    const start = (await scroll.boundingBox())!;
    const room = Math.min(260, page.viewportSize()!.height - (start.y + start.height / 2) - 10);
    await drag(page, scroll, 0, room, { steps: 20, release: false });
    await expect(pull).toHaveAttribute('data-phase', 'pulling');
    expect((await pull.boundingBox())!.height).toBeLessThanOrEqual(65);
    await page.mouse.up();
    await expect(pull).toHaveAttribute('data-phase', 'spinning');
    await expect(pull).toHaveAttribute('data-phase', 'idle', { timeout: 5_000 });

    const box = (await scroll.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 400);
    await expect.poll(() => scroll.evaluate((n) => n.scrollTop)).toBeGreaterThan(0);
  });

});
