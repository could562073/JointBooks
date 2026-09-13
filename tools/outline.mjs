import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const file = process.argv[2];
const dom = new JSDOM(fs.readFileSync(file, 'utf8'));
const KEEP = /^(display|flex|flex-direction|justify-content|align-items|gap|padding|margin|width|height|min-|max-|position|top|right|bottom|left|background|border|border-radius|box-shadow|font-size|font-weight|font-family|color|opacity|text-align|letter-spacing|line-height|grid|overflow)/;
function styleOf(el) {
  const s = el.getAttribute('style') || '';
  return s.split(';').map(x => x.trim()).filter(x => x && KEEP.test(x.split(':')[0].trim()))
    .join('; ');
}
function walk(el, d = 0) {
  if (d > 9) return;
  const pad = '  '.repeat(d);
  const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ');
  const st = styleOf(el);
  console.log(`${pad}<${el.tagName.toLowerCase()}>${own ? ' "' + own.slice(0, 30) + '"' : ''}${st ? '  {' + st + '}' : ''}`);
  for (const c of el.children) walk(c, d + 1);
}
walk(dom.window.document.body.firstElementChild);
