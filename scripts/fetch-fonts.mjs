import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'public/fonts';

// 只抓需要的字重，避免包出 20MB。中文字型檔本身很大，接受。
const FAMILIES = [
  { css: 'Zen+Maru+Gothic:wght@500;700', slug: 'zen-maru-gothic' },
  { css: 'Noto+Sans+TC:wght@400;500;700', slug: 'noto-sans-tc' },
  { css: 'Baloo+2:wght@600;700', slug: 'baloo2' },
];

// 帶現代 UA 才會拿到 woff2
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

await mkdir(OUT, { recursive: true });

let combined = '';
for (const fam of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${fam.css}&display=swap`;
  const css = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text());

  let i = 0;
  const rewritten = [];
  for (const block of css.split('@font-face').slice(1)) {
    const m = block.match(/src:\s*url\((https:[^)]+\.woff2)\)/);
    if (!m) continue;
    const file = `${fam.slug}-${i++}.woff2`;
    const buf = Buffer.from(await fetch(m[1]).then((r) => r.arrayBuffer()));
    await writeFile(join(OUT, file), buf);
    rewritten.push('@font-face' + block.replace(m[1], `/fonts/${file}`));
  }
  combined += rewritten.join('\n') + '\n';
  console.log(`${fam.slug}: ${i} 個檔案`);
}

await writeFile('src/styles/fonts.generated.css', combined);
console.log('寫出 src/styles/fonts.generated.css');
