import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT = 'src/assets/icons';

const MAP = {
  house:  'house',
  shield: 'umbrella-with-rain-drops',
  cup:    'hot-beverage',
  drink:  'cup-with-straw',
  basket: 'shopping-cart',
  fruit:  'red-apple',
  ticket: 'admission-tickets',
  film:   'film-frames',
  bus:    'bus',
  phone:  'mobile-phone',
  pill:   'pill',
  gift:   'wrapped-gift',
  bag:    'shopping-bags',
  bolt:   'high-voltage',
  coin:   'coin',
};

await mkdir(OUT, { recursive: true });
for (const [key, name] of Object.entries(MAP)) {
  const url = `https://api.iconify.design/fluent-emoji-flat/${name}.svg`;
  const svg = await fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${key} → ${name}: HTTP ${r.status}`);
    return r.text();
  });
  if (!svg.startsWith('<svg')) throw new Error(`${key}: 回傳的不是 SVG`);
  await writeFile(join(OUT, `${key}.svg`), svg);
  console.log(`${key} ← ${name}`);
}
console.log(`完成 ${Object.keys(MAP).length} 個`);
