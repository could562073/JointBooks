import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
const OUT = process.env.CLAUDE_JOB_DIR + '/tmp/proto';
fs.mkdirSync(OUT, { recursive: true });
const PROTO = 'file://' + path.resolve('加拿大共用記帳 原型.html');

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2 })).newPage();
await p.goto(PROTO);
await p.waitForFunction(() => !document.getElementById('__bundler_thumbnail'), null, { timeout: 60000 }).catch(()=>{});
await p.waitForTimeout(3000);

async function grab(name) {
  const html = await p.evaluate(() => {
    const cands = [...document.querySelectorAll('*')].filter(e => {
      const r = e.getBoundingClientRect();
      return Math.abs(r.width - 390) < 6 && r.height > 700;
    });
    const el = cands[cands.length - 1];
    if (!el) return '';
    const clone = el.cloneNode(true);
    clone.querySelectorAll('img,image').forEach(n => n.setAttribute('src', '[img]'));
    return clone.outerHTML;
  });
  fs.writeFileSync(`${OUT}/${name}.html`, html.replace(/data:[^"')]{100,}/g, '[b64]'));
  const box = await p.evaluate(() => {
    const cands = [...document.querySelectorAll('*')].filter(e => {
      const r = e.getBoundingClientRect();
      return Math.abs(r.width - 390) < 6 && r.height > 700;
    });
    const r = cands[cands.length - 1].getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await p.screenshot({ path: `${OUT}/${name}.png`, clip: box });
  console.log(name, html.length);
}

const click = async (text) => {
  const el = p.locator(`button:has-text("${text}"), [role=button]:has-text("${text}")`).first();
  if (await el.count()) { await el.click(); await p.waitForTimeout(900); return true; }
  console.log('MISS', text); return false;
};

// 記一筆的懸浮 ＋ 鍵在這份原型裡是純 SVG 圖示（<button><svg><path>…），沒有
// 任何文字節點，所以 `button:has-text("＋")` 永遠比對不到。改用幾何比對：
// 手機框內、右下角、邊長 44~64px 的正方形、裡面有 <svg> 的按鈕。
const clickFab = async () => {
  const box = await p.evaluate(() => {
    const cands = [...document.querySelectorAll('*')].filter(e => {
      const r = e.getBoundingClientRect();
      return Math.abs(r.width - 390) < 6 && r.height > 700;
    });
    const frame = cands[cands.length - 1];
    if (!frame) return null;
    const fr = frame.getBoundingClientRect();
    const btns = [...document.querySelectorAll('button')].filter((btn) => {
      const r = btn.getBoundingClientRect();
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      return (
        r.width >= 44 && r.width <= 64 &&
        Math.abs(r.width - r.height) < 6 &&
        btn.querySelector('svg') &&
        cx > fr.x + fr.width - 100 &&
        cy > fr.y + fr.height - 200
      );
    });
    if (!btns.length) return null;
    const r = btns[btns.length - 1].getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!box) { console.log('MISS ＋ (fab)'); return false; }
  await p.mouse.click(box.x, box.y);
  await p.waitForTimeout(900);
  return true;
};

await grab('01-daily');
// App 內的分頁
for (const [t, n] of [['統計','02-stats'], ['配置','03-settings']]) {
  if (await click(t)) await grab(n);
}
// 配置頁 → 分類子頁
if (await click('編輯分類')) await grab('04-categories');
await p.reload(); await p.waitForTimeout(4000);
// 記一筆
if (await clickFab()) await grab('05-entry');
await p.reload(); await p.waitForTimeout(4000);
// 上方切頁：登入 / 接受邀請
for (const [t, n] of [['登入','06-login'], ['接受邀請','07-join']]) {
  if (await click(t)) await grab(n);
}
await b.close();
