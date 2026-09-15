import { test, expect } from '@playwright/test';
import {
  animationsOf, drag, hasDuration, localDate, matrixOf, openApp, otherDayThisMonth,
  sampleText, seedTxns, settle,
} from './helpers';

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

  test('拖曳中高度跟手、沒有過場；上滑超過門檻放手就吸附收起（D1、D2）', async ({ page }) => {
    const handle = page.getByTestId('calendar-handle');
    const region = page.getByTestId('calendar-region');
    const full = await region.evaluate((n) => n.getBoundingClientRect().height);

    // 月曆內容本身不到 460px 上限，要拉超過兩者的差距高度才看得出變化
    const at = await drag(page, handle, 0, -150, { release: false });
    const mid = await region.evaluate((n) => ({
      h: n.getBoundingClientRect().height,
      opacity: Number(getComputedStyle(n).opacity),
      transition: getComputedStyle(n).transitionProperty,
    }));
    expect(mid.h).toBeLessThan(full - 40);
    expect(mid.opacity).toBeLessThan(1);
    expect(mid.transition).toBe('none');

    await page.mouse.move(at.x, at.y - 20);
    await page.mouse.up();
    await expect(handle).toHaveAttribute('data-collapsed');
    await settle(page);
    expect(await region.evaluate((n) => n.getBoundingClientRect().height)).toBeLessThan(2);
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

  test('快速往上輕彈：位移沒過門檻也收起（D4）', async ({ page }) => {
    const handle = page.getByTestId('calendar-handle');
    // 120px 沒到 138px 的距離門檻，只靠速度（>0.4px/ms）判定；每步不停頓，才甩得夠快
    await drag(page, handle, 0, -120, { pause: 0 });
    await expect(handle).toHaveAttribute('data-collapsed');
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
  test('點不同日期：選中框是一塊滑塊，平滑移過去（D9）', async ({ page }) => {
    await openApp(page);
    const slider = page.getByTestId('calendar-slider');
    const before = await slider.boundingBox();
    const style = await slider.evaluate((n) => getComputedStyle(n));
    expect(style.transitionProperty).toContain('left');
    expect(hasDuration(style.transitionDuration, 340)).toBe(true);

    await page.getByTestId(`cell-${otherDayThisMonth()}`).click();
    await settle(page);
    const after = await slider.boundingBox();
    expect([after!.x, after!.y]).not.toEqual([before!.x, before!.y]);
  });

  test('點不同日期：當日總額從舊值跑到新值，不是瞬間換掉（D10）', async ({ page }) => {
    await openApp(page);
    const other = otherDayThisMonth();
    await seedTxns(page, [{ cents: 1_234 }, { day: localDate(other), cents: 98_765 }]);
    await openApp(page);
    await settle(page);
    const total = page.getByTestId('day-total');
    const samples = sampleText(total, 700);
    await page.getByTestId(`cell-${other}`).click();
    const seen = await samples;
    expect(new Set(seen).size).toBeGreaterThanOrEqual(3);
    await expect(total).toContainText('987.65');
  });

  test('換月：收支三卡重新 count-up（D11）', async ({ page }) => {
    await openApp(page);
    await seedTxns(page, [{ cents: 50_000 }, { day: localDate(15, -1), cents: 250_000 }]);
    await openApp(page);
    await settle(page);
    const card = page.getByTestId('card-expense');
    await page.getByRole('button', { name: '上個月' }).click();
    const seen = await sampleText(card, 700);
    expect(new Set(seen).size).toBeGreaterThanOrEqual(3);
  });

  test('減少動態效果：數字直接落在終值，滑塊直接到位（D12）', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openApp(page);
    const other = otherDayThisMonth();
    await seedTxns(page, [{ cents: 1_234 }, { day: localDate(other), cents: 98_765 }]);
    await openApp(page);
    const total = page.getByTestId('day-total');
    const slider = page.getByTestId('calendar-slider');
    expect(await total.textContent()).toContain('12.34');
    const positions = slider.evaluate((n) => new Promise<string[]>((resolve) => {
      const out: string[] = [];
      const t0 = performance.now();
      const tick = () => {
        const c = getComputedStyle(n);
        out.push(`${c.left},${c.top}`);
        if (performance.now() - t0 < 600) requestAnimationFrame(tick); else resolve(out);
      };
      tick();
    }));
    const texts = sampleText(total, 600);
    await page.getByTestId(`cell-${other}`).click();
    // 中間沒有過渡值：只會看到舊值與終值兩種
    expect(new Set(await texts).size).toBeLessThanOrEqual(2);
    expect(new Set(await positions).size).toBeLessThanOrEqual(2);
    await expect(total).toContainText('987.65');
  });
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

  test('按住 ＋ 縮到 .92；滑開手指再放開，不會打開記一筆（D14）', async ({ page }) => {
    const fab = page.getByTestId('fab');
    const box = (await fab.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(fab).toHaveAttribute('data-pressed');
    await page.waitForTimeout(200);
    expect((await matrixOf(fab)).sx).toBeCloseTo(0.92, 2);
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

  test('切分頁：滑塊位移、新頁自方向側滑入、選中頁籤的饅頭壓扁彈回（D17、D27）', async ({ page }) => {
    const slider = page.getByTestId('tab-slider');
    expect(hasDuration(await slider.evaluate((n) => getComputedStyle(n).transitionDuration), 420)).toBe(true);
    const before = await slider.boundingBox();

    await page.getByTestId('tab-stats').click();
    const statsPage = page.getByTestId('stats-screen').locator('xpath=..');
    const forward = await animationsOf(statsPage);
    expect(forward.some((a) => a.duration === 420 && a.from.includes('38px') && !a.from.includes('-38px'))).toBe(true);
    const squash = await animationsOf(page.getByTestId('tab-stats'), true);
    expect(squash.some((a) => a.duration === 420)).toBe(true);
    await settle(page);
    expect((await slider.boundingBox())!.x).not.toBe(before!.x);

    await page.getByTestId('tab-daily').click();
    const back = await animationsOf(page.getByTestId('daily-screen').locator('xpath=..'));
    expect(back.some((a) => a.duration === 420 && a.from.includes('-38px'))).toBe(true);
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

  test('按 › 換月：整區自右側滑入；按 ‹ 自左側（D20）', async ({ page }) => {
    await page.getByRole('button', { name: '下個月' }).click();
    const next = await animationsOf(page.getByTestId('month-body'), true);
    expect(next.some((a) => a.duration === 420 && a.from.includes('38px') && !a.from.includes('-38px'))).toBe(true);
    await settle(page);
    await page.getByRole('button', { name: '上個月' }).click();
    const prev = await animationsOf(page.getByTestId('month-body'), true);
    expect(prev.some((a) => a.duration === 420 && a.from.includes('-38px'))).toBe(true);
  });

  test('點標題：▾ 轉 180°、選擇器由下往上滑入；換年時月份方格整區水平滑動（D21、D22）', async ({ page }) => {
    await page.getByTestId('month-title').click();
    await expect(page.getByTestId('month-picker')).toBeVisible();
    const panel = await animationsOf(page.getByTestId('month-picker'), true);
    expect(panel.some((a) => a.from.includes('10px'))).toBe(true);
    await settle(page);
    expect(Math.abs((await matrixOf(page.getByTestId('month-chevron'))).angle)).toBe(180);

    await page.getByTestId('year-pills').locator('button:not([data-selected])').first().click();
    const grid = await animationsOf(page.getByTestId('month-picker').getByTestId('month-grid'), true);
    expect(grid.some((a) => a.duration === 420 && a.from.includes('38px'))).toBe(true);
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

  test('點另一天：明細逐張延遲 35ms 浮現，第 8 張之後不再加長（D28）', async ({ page }) => {
    const other = otherDayThisMonth();
    await seedTxns(page, Array.from({ length: 10 }, () => ({ day: localDate(other) })));
    await openApp(page);
    await page.getByTestId(`cell-${other}`).click();
    await expect(page.locator('[data-delay]')).toHaveCount(10);
    const delays = await page.locator('[data-delay]').evaluateAll((ns) => ns.map((n) => Number(n.getAttribute('data-delay'))));
    expect(delays.slice(0, 8)).toEqual([0, 35, 70, 105, 140, 175, 210, 245]);
    expect(delays.slice(8)).toEqual([245, 245]);
  });
});
