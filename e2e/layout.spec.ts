import { test, expect, type Page } from '@playwright/test';

/**
 * §15.1-23～28 的版面驗收（MANUAL-TESTS 的 V1–V9）。
 *
 * 這幾條原本列在人工清單上：jsdom 的 getBoundingClientRect 一律回 0、CSS
 * Modules 的樣式也沒被套用，量不出任何東西。真實瀏覽器量得到，所以搬來
 * Playwright，375／390／430 三個斷點各跑一次。
 */

const MIN_HIT = 44;

/** 造幾筆帳：版面問題要有內容才看得出來 */
async function seed(page: Page, count = 6): Promise<void> {
  await page.goto('/');
  await page.getByTestId('daily-screen').waitFor();

  await page.evaluate(async (n: number) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('joint-books');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });

    type Cat = { id: string; kind: string; name: string; subs: { id: string; name: string }[] };
    const cats = await new Promise<Cat[]>((res, rej) => {
      const rq = db.transaction('categories').objectStore('categories').getAll();
      rq.onsuccess = () => res(rq.result as Cat[]);
      rq.onerror = () => rej(rq.error);
    });
    const expense = cats.filter((c) => c.kind === 'expense');
    const income = cats.filter((c) => c.kind === 'income');

    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const rows = Array.from({ length: n }, (_, i) => {
      // 最後一筆記成收入，讓收入的樣式也進到掃描範圍
      const pool = i === n - 1 && income.length ? income : expense;
      const c = pool[i % pool.length]!;
      const cents = [520, 2_900, 12_800, 99_999, 1_250, 780][i % 6]!;
      return {
        id: `seed-${i}`, date,
        mainId: c.id, subId: c.subs[0]!.id,
        mainName: c.name, subName: c.subs[0]!.name,
        amountCents: cents, currency: 'CAD', actualCadCents: cents,
        by: i % 2 ? '妻' : '我',
        // 長備註要被 ellipsis 截掉，不能把整列撐寬
        note: i === 0 ? 'Costco 週採買，順便買了貓砂與一堆日用品還有很長的備註' : '',
        createdAt: new Date(Date.now() - i * 60_000).toISOString(),
        updatedAt: new Date(Date.now() - i * 60_000).toISOString(),
        deleted: false,
      };
    });

    await new Promise<void>((res, rej) => {
      const tx = db.transaction('txns', 'readwrite');
      for (const r of rows) tx.objectStore('txns').put(r);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, count);

  await page.reload();
  await page.getByTestId('txn-list').waitFor();
  await settle(page);
}

/**
 * 等所有動畫停下來再量。
 * 進場動畫期間元素是被 translate 出去的，那時候量 scrollWidth 會量到位移量
 * 而不是真的溢出——實測日常頁會多報 10px、換頁後多報 38px，剛好就是 MOTION
 * #7／#8 的位移距離。
 */
async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.getAnimations().every((a) => {
      if (a.playState !== 'running') return true;
      // 饅頭的呼吸（MOTION #30）是無限循環的，等它停會等到天荒地老
      return a.effect?.getComputedTiming().iterations === Infinity;
    }),
    undefined,
    { timeout: 5_000 }
  );
}

type Hit = { what: string; w: number; h: number };

/** 量一組選擇器底下所有可見元素的命中區 */
async function hitAreas(page: Page, selector: string): Promise<Hit[]> {
  return page.evaluate((sel) => {
    const out: { what: string; w: number; h: number }[] = [];
    // 只量真的可以點的：前一版用 [data-testid^="by-"] 之類的前綴，把明細列的
    // 頭像、分段滑塊、開關 knob、分頁列的饅頭、幣別提示 <p> 全掃了進來，
    // 那些都不是點擊目標，量它們只會製造假的違規。
    const clickable = (el: Element) =>
      el.matches('button, a[href], input, textarea, [role="button"]');
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (!clickable(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      // 命中區可以用 ::after 撐大而不改變外觀，所以量的是它與虛擬元素的聯集
      const after = getComputedStyle(el, '::after');
      let w = r.width;
      let h = r.height;
      if (after.content !== 'none' && after.position === 'absolute') {
        const inset = (v: string) => (v === 'auto' ? 0 : parseFloat(v) || 0);
        w += -inset(after.left) + -inset(after.right);
        h += -inset(after.top) + -inset(after.bottom);
      }
      out.push({
        what: el.dataset.testid ?? el.getAttribute('aria-label') ?? (el.textContent ?? '').trim().slice(0, 14),
        w: Math.round(w), h: Math.round(h),
      });
    }
    return out;
  }, selector);
}

function tooSmall(hits: Hit[]): string[] {
  return hits.filter((x) => x.w < MIN_HIT || x.h < MIN_HIT).map((x) => `${x.what} ${x.w}x${x.h}`);
}

test.describe('V1 §15.1-23 可點元素的命中區至少 44×44', () => {
  test('日常頁：月曆格、月份箭頭、分頁列、懸浮 ＋', async ({ page }) => {
    await seed(page);
    const hits = await hitAreas(page, '[data-testid^="cell-"], [aria-label="上個月"], [aria-label="下個月"], [data-testid^="tab-"], [data-testid="fab"]');
    expect(hits.length).toBeGreaterThan(30);
    expect(tooSmall(hits)).toEqual([]);
  });

  test('記一筆：數字鍵、幣別、人、儲存鍵', async ({ page }) => {
    await seed(page);
    await page.getByTestId('fab').click();
    await page.getByTestId('entry-sheet').waitFor();
    await settle(page);
    const hits = await hitAreas(page, '[data-testid^="key-"], [data-testid^="currency-"], [data-testid^="by-"], [data-testid="entry-close"]');
    expect(tooSmall(hits)).toEqual([]);
  });

  test('記一筆：分類與子分類 chip', async ({ page }) => {
    await seed(page);
    await page.getByTestId('fab').click();
    await page.getByTestId('category-row').click();
    await settle(page);
    const hits = await hitAreas(page, '[data-testid^="main-"], [data-testid^="sub-"], [data-testid="add-main"], [data-testid="add-sub"]');
    expect(hits.length).toBeGreaterThan(4);
    expect(tooSmall(hits)).toEqual([]);
  });

  test('統計頁：週／月／年分段', async ({ page }) => {
    await seed(page);
    await page.getByTestId('tab-stats').click();
    await page.getByTestId('stats-screen').waitFor();
    await settle(page);
    expect(tooSmall(await hitAreas(page, '[data-testid^="dimension-"]'))).toEqual([]);
  });

  test('配置頁：兩個開關與各列', async ({ page }) => {
    await seed(page);
    await page.getByTestId('tab-settings').click();
    await page.getByTestId('settings-screen').waitFor();
    await settle(page);
    const hits = await hitAreas(page, '[data-testid^="toggle-"], [data-testid="invite-member"], [data-testid="open-categories"]');
    expect(tooSmall(hits)).toEqual([]);
  });

  test('分類子頁：返回／新增、分段、卡內的名稱與預算、子分類 chip', async ({ page }) => {
    await seed(page);
    await page.getByTestId('tab-settings').click();
    await page.getByTestId('open-categories').click();
    await page.getByTestId('categories-page').waitFor();
    await settle(page);
    const hits = await hitAreas(page, '[data-testid="categories-back"], [data-testid="categories-add"], [data-testid^="catkind-"], [data-testid$="-name"], [data-testid$="-budget"], [data-testid^="sub-"], [data-testid$="-addsub"], [data-testid$="-icon"]');
    expect(hits.length).toBeGreaterThan(10);
    expect(tooSmall(hits)).toEqual([]);
  });

  test('圖示選擇器：每一格', async ({ page }) => {
    await seed(page);
    await page.getByTestId('tab-settings').click();
    await page.getByTestId('open-categories').click();
    await page.getByTestId('categories-page').waitFor();
    await page.locator('[data-testid$="-icon"]').first().click();
    await page.getByTestId('icon-picker').waitFor();
    await settle(page);
    const hits = await hitAreas(page, '[data-testid^="icon-"]');
    expect(hits.length).toBe(15);   // icon-picker 本身是 div，clickable 會擋掉
    expect(tooSmall(hits)).toEqual([]);
  });

  test('確認窗的 ✓／✕', async ({ page }) => {
    await seed(page);
    await page.getByTestId(`txn-seed-0`).click();
    await page.getByTestId('entry-delete').click();
    await page.getByTestId('delete-confirm').waitFor();
    await settle(page);
    const hits = await hitAreas(page, '[data-testid="delete-confirm-cancel"], [data-testid="delete-confirm-confirm"]');
    expect(hits).toHaveLength(2);
    expect(tooSmall(hits)).toEqual([]);
  });
});

/** 量一個元素的 rect（相對視窗） */
async function rectOf(page: Page, testId: string) {
  return page.getByTestId(testId).evaluate((n) => {
    const r = n.getBoundingClientRect();
    return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) };
  });
}

/** 把某個捲動容器往下捲 */
async function scrollBy(page: Page, testId: string, dy: number) {
  await page.getByTestId(testId).evaluate((n, d) => { n.scrollTop = d; }, dy);
  await page.waitForTimeout(60);
}

test.describe('V2／V3 §15.1-24 容器不得被內容溢出', () => {
  test('分類卡完整包住自己的子分類 chip', async ({ page }) => {
    await seed(page);
    await page.getByTestId('tab-settings').click();
    await page.getByTestId('open-categories').click();
    await page.getByTestId('categories-page').waitFor();
    await settle(page);

    // 這條是有來歷的：分類卡曾因欄方向 flex 被壓縮而把子分類 chip 裁掉
    const clipped = await page.evaluate(() => {
      const out: string[] = [];
      for (const box of document.querySelectorAll<HTMLElement>('[data-testid$="-subs"]')) {
        const b = box.getBoundingClientRect();
        for (const chip of box.children) {
          const c = chip.getBoundingClientRect();
          if (c.bottom > b.bottom + 1 || c.right > b.right + 1 || c.top < b.top - 1) {
            out.push(`${(chip as HTMLElement).dataset.testid ?? chip.textContent} 超出 ${box.dataset.testid}`);
          }
        }
      }
      return out;
    });
    expect(clipped).toEqual([]);
  });

  test('卡片類容器的內容都沒有被裁掉', async ({ page }) => {
    await seed(page);
    const cards = async () => page.evaluate(() => {
      const sel = [
        '[data-testid="card-income"]', '[data-testid="card-expense"]', '[data-testid="card-net"]',
        '[data-testid^="txn-seed-"]', '[data-testid^="cat-"]', '[data-testid^="budget-"]',
        '[data-testid="overview-card"]',
      ].join(',');
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(sel)) {
        const cs = getComputedStyle(el);
        if (/auto|scroll/.test(cs.overflowX + cs.overflowY)) continue;
        // text-overflow: ellipsis 本來就靠 scrollWidth > clientWidth 才裁得出「…」
        if (cs.textOverflow === 'ellipsis') continue;
        const dh = el.scrollHeight - el.clientHeight;
        const dw = el.scrollWidth - el.clientWidth;
        if (dh > 1 || dw > 1) out.push(`${el.dataset.testid} 溢出 h+${dh} w+${dw}`);
      }
      return out;
    });

    expect(await cards()).toEqual([]);

    await page.getByTestId('tab-stats').click();
    await page.getByTestId('stats-screen').waitFor();
    await settle(page);
    expect(await cards()).toEqual([]);

    await page.getByTestId('tab-settings').click();
    await page.getByTestId('open-categories').click();
    await page.getByTestId('categories-page').waitFor();
    await settle(page);
    expect(await cards()).toEqual([]);
  });
});

test.describe('V4 §15.1-25 文字不得溢出容器', () => {
  test('日常頁、統計頁、分類子頁的文字都在框內', async ({ page }) => {
    await seed(page);

    const overflowing = async () => page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const range = document.createRange();
      let n: Node | null;
      while ((n = walker.nextNode())) {
        if (!n.nodeValue?.trim()) continue;
        const parent = n.parentElement!;
        const cs = getComputedStyle(parent);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        // 刻意用 ellipsis 截斷的（備註）不算溢出：它的 range 本來就比框寬，
        // 但畫面上被 overflow:hidden 切掉並補上「…」
        if (cs.textOverflow === 'ellipsis') continue;
        range.selectNodeContents(n);
        const t = range.getBoundingClientRect();
        const p = parent.getBoundingClientRect();
        if (t.width === 0) continue;
        if (t.right > p.right + 1 || t.left < p.left - 1) {
          out.push(`「${n.nodeValue.trim().slice(0, 12)}」 ${Math.round(t.left)}–${Math.round(t.right)} vs ${Math.round(p.left)}–${Math.round(p.right)}`);
        }
      }
      return out;
    });

    expect(await overflowing()).toEqual([]);

    await page.getByTestId('tab-stats').click();
    await page.getByTestId('stats-screen').waitFor();
    await settle(page);
    expect(await overflowing()).toEqual([]);

    await page.getByTestId('tab-settings').click();
    await page.getByTestId('open-categories').click();
    await page.getByTestId('categories-page').waitFor();
    await settle(page);
    expect(await overflowing()).toEqual([]);
  });

  test('整頁不得橫向捲動', async ({ page }) => {
    await seed(page);
    for (const tab of ['daily', 'stats', 'settings'] as const) {
      await page.getByTestId(`tab-${tab}`).click();
      await page.getByTestId(`${tab}-screen`).waitFor();
      await settle(page);
      const over = await page.evaluate(() => ({
        doc: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        body: document.body.scrollWidth - document.body.clientWidth,
      }));
      expect(over, `${tab} 頁有橫向捲動`).toEqual({ doc: 0, body: 0 });
    }
  });
});

test.describe('V5／V6／V7 §15.1-26～28 固定區在捲動後不動', () => {
  test('分類子頁捲動後，標題列與分段列不動', async ({ page }) => {
    await seed(page);
    await page.getByTestId('tab-settings').click();
    await page.getByTestId('open-categories').click();
    await page.getByTestId('categories-page').waitFor();
    await settle(page);

    const before = {
      back: await rectOf(page, 'categories-back'),
      seg: await rectOf(page, 'catkind-expense'),
    };
    await scrollBy(page, 'categories-scroll', 400);
    expect(await rectOf(page, 'categories-back')).toEqual(before.back);
    expect(await rectOf(page, 'catkind-expense')).toEqual(before.seg);
  });

  test('日常頁捲動明細後，月曆與月份列不動', async ({ page }) => {
    await seed(page, 20);
    const before = {
      nav: await rectOf(page, 'month-nav'),
      cal: await rectOf(page, 'month-calendar'),
    };
    await scrollBy(page, 'txn-scroll', 300);
    expect(await rectOf(page, 'month-nav')).toEqual(before.nav);
    expect(await rectOf(page, 'month-calendar')).toEqual(before.cal);
  });

  test('捲動後底部分頁列與懸浮 ＋ 不動', async ({ page }) => {
    await seed(page, 20);
    const before = { bar: await rectOf(page, 'tab-bar'), fab: await rectOf(page, 'fab') };
    await scrollBy(page, 'txn-scroll', 300);
    expect(await rectOf(page, 'tab-bar')).toEqual(before.bar);
    expect(await rectOf(page, 'fab')).toEqual(before.fab);

    await page.getByTestId('tab-stats').click();
    await page.getByTestId('stats-screen').waitFor();
    await settle(page);
    const bar = await rectOf(page, 'tab-bar');
    await scrollBy(page, 'stats-scroll', 400);
    expect(await rectOf(page, 'tab-bar')).toEqual(bar);
  });
});

test.describe('V9 §15.1-1 每頁只有一個主捲動區', () => {
  test('三頁都只有一個可捲的容器，且外層不捲', async ({ page }) => {
    await seed(page, 20);
    const scrollers = async () => page.evaluate(() => {
      const out: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>('*')) {
        const cs = getComputedStyle(el);
        if (!/auto|scroll/.test(cs.overflowY)) continue;
        if (el.scrollHeight <= el.clientHeight + 1) continue;   // 可捲但沒東西可捲
        out.push(el.dataset.testid ?? el.tagName.toLowerCase());
      }
      return out;
    });

    expect(await scrollers()).toEqual(['txn-scroll']);

    await page.getByTestId('tab-stats').click();
    await page.getByTestId('stats-screen').waitFor();
    await settle(page);
    expect(await scrollers()).toEqual(['stats-scroll']);

    await page.getByTestId('tab-settings').click();
    await page.getByTestId('open-categories').click();
    await page.getByTestId('categories-page').waitFor();
    await settle(page);
    expect(await scrollers()).toEqual(['categories-scroll']);
  });
});

test.describe('V8 增補檔 B-3：iPhone SE 375×667 記一筆不溢出', () => {
  test('數字鍵盤四列與儲存鍵完整可見', async ({ page }, info) => {
    test.skip(info.project.name !== 'se', '這條只在 375×667 有意義');
    await seed(page);
    await page.getByTestId('fab').click();
    await page.getByTestId('entry-sheet').waitFor();
    await settle(page);

    const vh = page.viewportSize()!.height;
    for (const k of ['key-1', 'key-4', 'key-7', 'key-.', 'key-save']) {
      const r = await rectOf(page, k);
      expect(r.h, `${k} 沒有高度`).toBeGreaterThan(0);
      expect(r.top + r.h, `${k} 被畫面底部切掉`).toBeLessThanOrEqual(vh);
      expect(r.top, `${k} 被推出畫面上方`).toBeGreaterThanOrEqual(0);
    }
  });
});
