import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'public/fonts';

// 只抓需要的字重，避免包出 20MB。中文字型檔本身很大，接受。
const FAMILIES = [
  { css: 'Zen+Maru+Gothic:wght@500;700', slug: 'zen-maru-gothic', ofl: 'https://raw.githubusercontent.com/googlefonts/zen-marugothic/main/OFL.txt' },
  { css: 'Noto+Sans+TC:wght@400;500;700', slug: 'noto-sans-tc', ofl: 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/OFL.txt' },
  { css: 'Baloo+2:wght@600;700', slug: 'baloo2', ofl: 'https://raw.githubusercontent.com/googlefonts/baloo/main/OFL.txt' },
];

// 帶現代 UA 才會拿到 woff2
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0 Safari/537.36';

await mkdir(OUT, { recursive: true });

let combined = '';
let totalFiles = 0;

// 取回各家的 OFL.txt，置於 public/fonts/ 以滿足 OFL 1.1 散布要求
for (const fam of FAMILIES) {
  try {
    const oflRes = await fetch(fam.ofl);
    if (!oflRes.ok) throw new Error(`OFL fetch failed with ${oflRes.status}`);
    const oflText = await oflRes.text();
    if (!oflText) throw new Error('OFL.txt returned empty');
    await writeFile(join(OUT, `OFL-${fam.slug}.txt`), oflText);
    console.log(`${fam.slug}: OFL.txt 取得成功`);
  } catch (e) {
    console.error(`警告：無法取得 ${fam.slug} 的 OFL.txt from ${fam.ofl}：${e.message}`);
    console.error(`  請手動將 OFL.txt 從 ${fam.ofl} 放入 public/fonts/OFL-${fam.slug}.txt`);
  }
}

for (const fam of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${fam.css}&display=swap`;
  const cssRes = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!cssRes.ok) throw new Error(`CSS fetch for ${fam.slug} failed: ${cssRes.status} ${url}`);
  const css = await cssRes.text();
  if (!css) throw new Error(`CSS for ${fam.slug} returned empty`);

  let i = 0;
  let skipped = 0;
  const rewritten = [];
  for (const block of css.split('@font-face').slice(1)) {
    // 假設 Google Fonts CSS2 API 返回 src: url(https://…woff2) 的格式。
    // 如果這個假設被打破（API 改版、回應格式變化），下面的正規表達式會有 match 失敗。
    // 我們會計數 skipped block，並在有任何 skipped block 時拋錯 —— 這樣能把無聲的 no-op 轉成可見的失敗。
    const m = block.match(/src:\s*url\((https:[^)]+\.woff2)\)/);
    if (!m) {
      skipped++;
      continue;
    }
    const file = `${fam.slug}-${i++}.woff2`;
    const fontRes = await fetch(m[1]);
    if (!fontRes.ok) throw new Error(`Font fetch failed: ${fontRes.status} ${m[1]}`);
    const buf = Buffer.from(await fontRes.arrayBuffer());
    if (buf.length === 0) throw new Error(`Font file is empty: ${m[1]}`);
    await writeFile(join(OUT, file), buf);
    rewritten.push('@font-face' + block.replace(m[1], `/fonts/${file}`));
  }

  // 失敗條件：家族產出 0 個檔案、或有任何 skipped block（表示格式假設被打破）
  if (i === 0) throw new Error(`${fam.slug}: 沒有產出任何 .woff2 檔案`);
  if (skipped > 0) throw new Error(`${fam.slug}: 有 ${skipped} 個 @font-face block 無法解析（可能 CSS 格式改變）`);

  combined += rewritten.join('\n') + '\n';
  totalFiles += i;
  console.log(`${fam.slug}: ${i} 個檔案 (skipped: ${skipped})`);
}

await writeFile('src/styles/fonts.generated.css', combined);
console.log(`\n寫出 src/styles/fonts.generated.css (總計 ${totalFiles} 個 woff2 檔案)`);
