import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const OUT = 'public/icons';
await mkdir(OUT, { recursive: true });

// maskable 需要安全區留白：內容縮到 80%
const svg = (size, pad) => {
  const s = size * pad;
  const o = (size - s) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="#FFF6EC"/>
    <g transform="translate(${o} ${o + s * 0.08}) scale(${s / 200})">
      <path d="M100 8a92 74 0 0 1 92 74v28a26 26 0 0 1-26 26H34a26 26 0 0 1-26-26V82A92 74 0 0 1 100 8z" fill="#B7A6E5"/>
      <ellipse cx="72" cy="42" rx="42" ry="15" fill="#CDC0F0" opacity=".8"/>
      <ellipse cx="70" cy="86" rx="8" ry="11" fill="#3B3229"/>
      <ellipse cx="130" cy="86" rx="8" ry="11" fill="#3B3229"/>
      <circle cx="40" cy="106" r="9" fill="#F79BA0" opacity=".55"/>
      <circle cx="160" cy="106" r="9" fill="#F79BA0" opacity=".55"/>
      <rect x="52" y="132" width="30" height="15" rx="7.5" fill="#9484CE"/>
      <rect x="118" y="132" width="30" height="15" rx="7.5" fill="#9484CE"/>
    </g>
  </svg>`;
};

const targets = [
  { file: 'icon-192.png', size: 192, pad: 0.94 },
  { file: 'icon-512.png', size: 512, pad: 0.94 },
  { file: 'icon-512-maskable.png', size: 512, pad: 0.8 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0.94 },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  await page.setContent(`<body style="margin:0">${svg(t.size, t.pad)}</body>`);
  await writeFile(`${OUT}/${t.file}`, await page.screenshot({ omitBackground: false }));
  await page.close();
  console.log(t.file);
}
await browser.close();
