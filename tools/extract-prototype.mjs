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

await grab('01-daily');
// App 內的分頁
for (const [t, n] of [['統計','02-stats'], ['配置','03-settings']]) {
  if (await click(t)) await grab(n);
}
// 配置頁 → 分類子頁
if (await click('編輯分類')) await grab('04-categories');
await p.reload(); await p.waitForTimeout(4000);
// 記一筆
if (await click('＋')) await grab('05-entry');
await p.reload(); await p.waitForTimeout(4000);
// 上方切頁：登入 / 接受邀請
for (const [t, n] of [['登入','06-login'], ['接受邀請','07-join']]) {
  if (await click(t)) await grab(n);
}
await b.close();
