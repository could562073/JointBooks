import { chromium } from '@playwright/test';
import path from 'node:path';

const PROTO = 'file://' + path.resolve('加拿大共用記帳 原型.html');

const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2 })).newPage();
p.on('console', (msg) => console.log('PAGE:', msg.text()));
p.on('pageerror', (err) => console.log('PAGEERROR:', err.message));
await p.goto(PROTO);
await p.waitForFunction(() => !document.getElementById('__bundler_thumbnail'), null, { timeout: 60000 }).catch((e)=>console.log('wait1 fail', e.message));
await p.waitForTimeout(3000);

const info = await p.evaluate(() => {
  const cands = [...document.querySelectorAll('*')].filter(e => {
    const r = e.getBoundingClientRect();
    return Math.abs(r.width - 390) < 6 && r.height > 700;
  });
  const el = cands[cands.length - 1];
  if (!el) return { error: 'no frame element found', count: cands.length };
  // find candidate buttons within
  const buttons = [...el.querySelectorAll('button, [role=button]')];
  return {
    frameFound: true,
    buttonCount: buttons.length,
    buttons: buttons.slice(0, 40).map(b => ({
      tag: b.tagName, text: b.textContent.trim().slice(0,20),
      aria: b.getAttribute('aria-label'),
      cls: b.className,
      rect: (() => { const r=b.getBoundingClientRect(); return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}; })(),
    })),
  };
});
console.log(JSON.stringify(info, null, 2));
await b.close();
