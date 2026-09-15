import { expect, type Locator, type Page } from '@playwright/test';

/**
 * 原本列在 docs/MANUAL-TESTS.md、改成自動化的那批 spec 共用的工具。
 * 跑在純本機模式的 dev server（playwright.config 的 5174，不帶 Google 用戶端 ID）。
 */

/** 打開 App，等啟動畫面蓋完（每次整頁載入都會蓋約 2.6 秒） */
export async function openApp(page: Page, path = '/'): Promise<void> {
  try {
    await page.goto(path);
  } catch (e) {
    // WSL 上偶爾在載入途中回報 net::ERR_NETWORK_CHANGED（網路介面抖一下），跟 App 無關，只重來這一種
    if (!String(e).includes('ERR_NETWORK_CHANGED')) throw e;
    await page.goto(path);
  }
  await page.getByTestId('daily-screen').waitFor();
  await expect(page.getByTestId('launch-screen')).toHaveCount(0, { timeout: 8_000 });
}

export type SeedTxn = {
  /** YYYY-MM-DD，預設今天 */
  day?: string;
  cents?: number;
  by?: '我' | '妻';
  kind?: 'expense' | 'income';
  /** 依排序取第幾個分類，預設依序輪流 */
  categoryIndex?: number;
  note?: string;
};

/** 今天或本月某天的 YYYY-MM-DD（本機時區） */
export function localDate(day?: number, monthDelta = 0): string {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth() + monthDelta, day ?? d.getDate());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
}

/** 本月裡跟今天不同的一天（今天是 1 號就用 2 號） */
export function otherDayThisMonth(): number {
  return new Date().getDate() === 1 ? 2 : 1;
}

/**
 * 直接把紀錄寫進 IndexedDB（分類要先存在：先 openApp 一次讓 App 建好預設分類），
 * 寫完要重新 openApp 才會讀進畫面。
 */
export async function seedTxns(page: Page, rows: SeedTxn[]): Promise<void> {
  await page.evaluate(async ({ rows, today }) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('joint-books');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    type Cat = { id: string; kind: string; name: string; order: number; subs: { id: string; name: string }[] };
    const cats = await new Promise<Cat[]>((res, rej) => {
      const rq = db.transaction('categories').objectStore('categories').getAll();
      rq.onsuccess = () => res(rq.result as Cat[]);
      rq.onerror = () => rej(rq.error);
    });
    cats.sort((a, b) => a.order - b.order);
    const txns = rows.map((r, i) => {
      const pool = cats.filter((c) => c.kind === (r.kind ?? 'expense'));
      const c = pool[(r.categoryIndex ?? i) % pool.length]!;
      const cents = r.cents ?? 1_000 + i * 100;
      const at = new Date(Date.now() - i * 60_000).toISOString();
      return {
        id: `seed-${i}-${Math.random().toString(36).slice(2, 8)}`,
        date: r.day ?? today,
        mainId: c.id, subId: c.subs[0]!.id, mainName: c.name, subName: c.subs[0]!.name,
        amountCents: cents, currency: 'CAD', actualCadCents: cents,
        by: r.by ?? '我', note: r.note ?? '', createdAt: at, updatedAt: at, deleted: false,
      };
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('txns', 'readwrite');
      for (const t of txns) tx.objectStore('txns').put(t);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { rows, today: localDate() });
}

/** 寫一筆 meta（例如 spreadsheetId，讓邀請面板有連結） */
export async function setMeta(page: Page, key: string, value: unknown): Promise<void> {
  await page.evaluate(async ({ key, value }) => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('joint-books');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise<void>((res, rej) => {
      const tx = db.transaction('meta', 'readwrite');
      tx.objectStore('meta').put({ key, value });
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, { key, value });
}

/** 等所有有限次數的動畫播完（饅頭呼吸這類無限循環的不等） */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => document.getAnimations().every((a) =>
      a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
    undefined,
    { timeout: 5_000 }
  );
}

/** 計算後的 transform 拆成位移、縮放、旋轉角度 */
export async function matrixOf(el: Locator): Promise<{ x: number; y: number; sx: number; sy: number; angle: number }> {
  return el.evaluate((n) => {
    const t = getComputedStyle(n).transform;
    if (t === 'none') return { x: 0, y: 0, sx: 1, sy: 1, angle: 0 };
    const v = t.slice(t.indexOf('(') + 1, -1).split(',').map((s) => Number(s.trim()));
    const [a, b, c, d] = t.startsWith('matrix3d') ? [v[0]!, v[1]!, v[4]!, v[5]!] : [v[0]!, v[1]!, v[2]!, v[3]!];
    const [x, y] = t.startsWith('matrix3d') ? [v[12]!, v[13]!] : [v[4]!, v[5]!];
    return { x, y, sx: Math.hypot(a, b), sy: Math.hypot(c, d), angle: Math.round((Math.atan2(b, a) * 180) / Math.PI) };
  });
}

export type AnimInfo = { duration: number; delay: number; iterations: number; from: string; to: string };

/** 元素（含子孫）身上的 CSS 動畫：時長、延遲、第一格與最後一格的 transform／opacity */
export async function animationsOf(el: Locator, subtree = false): Promise<AnimInfo[]> {
  return el.evaluate((n, subtree) => n.getAnimations({ subtree }).map((a) => {
    const t = a.effect!.getComputedTiming();
    const kf = (a.effect as KeyframeEffect).getKeyframes();
    const pick = (k: Keyframe | undefined) => `${k?.transform ?? ''} ${k?.opacity ?? ''} ${k?.strokeDashoffset ?? ''}`.trim();
    return {
      duration: Number(t.duration), delay: Number(t.delay), iterations: Number(t.iterations),
      from: pick(kf[0]), to: pick(kf[kf.length - 1]),
    };
  }), subtree);
}

/**
 * 用真實 pointer 事件拖曳（分段移動才會觸發 pointermove）。
 *
 * 每一步最多 8px：滑鼠不像手指會自動把事件綁在按下的那個元素上，第一步就跨出把手的話，
 * 手勢還沒接管、還沒 setPointerCapture，之後的事件全跑到別的元素去，拖曳就不算數。
 */
export async function drag(
  page: Page,
  target: Locator,
  dx: number,
  dy: number,
  opts: { steps?: number; pause?: number; release?: boolean } = {}
): Promise<{ x: number; y: number }> {
  const box = (await target.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const steps = Math.max(opts.steps ?? 12, Math.ceil(Math.hypot(dx, dy) / 8));
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps);
    if ((opts.pause ?? 16) > 0) await page.waitForTimeout(opts.pause ?? 16);
  }
  if (opts.release !== false) await page.mouse.up();
  return { x: x + dx, y: y + dy };
}

/** 一段時間內每一格畫面取一次文字（count-up 有沒有真的在跑） */
export function sampleText(el: Locator, ms: number): Promise<string[]> {
  return el.evaluate((n, ms) => new Promise<string[]>((resolve) => {
    const out: string[] = [];
    const t0 = performance.now();
    const tick = () => {
      out.push(n.textContent ?? '');
      if (performance.now() - t0 < ms) requestAnimationFrame(tick);
      else resolve(out);
    };
    tick();
  }), ms);
}

/** CSS 秒數字串（"0.42s, 0.34s"）裡有沒有這個毫秒數 */
export function hasDuration(css: string, ms: number): boolean {
  return css.split(',').some((s) => Math.round(parseFloat(s) * 1000) === ms);
}

/**
 * 開始記錄畫面上有沒有出現過某個屬性。短暫的動畫狀態（例如 300ms 的 data-popping）
 * 輪詢容易錯過，而且可能是新長出來的元素本身就帶著，所以屬性與子節點變動都要看
 */
export async function watchAttribute(page: Page, attr: string): Promise<void> {
  await page.evaluate((attr) => {
    const w = window as unknown as { __seen?: Record<string, boolean> };
    w.__seen = { ...(w.__seen ?? {}), [attr]: document.querySelector(`[${attr}]`) !== null };
    new MutationObserver(() => {
      if (document.querySelector(`[${attr}]`)) w.__seen![attr] = true;
    }).observe(document.body, { attributes: true, childList: true, subtree: true });
  }, attr);
}

export async function sawAttribute(page: Page, attr: string): Promise<boolean> {
  return page.evaluate((attr) => (window as unknown as { __seen?: Record<string, boolean> }).__seen?.[attr] === true, attr);
}
