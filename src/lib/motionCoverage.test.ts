import { describe, it, expect } from 'vitest';
import { DUR, EASE } from './motion';
import { GESTURE } from './gesture';
// 用 Vite 的 ?raw 而不是 node:fs：tsconfig 的 types 只給 vite/client，刻意不含
// node，這樣 app 程式碼誤用 Node API 時 typecheck 會擋下來。為了一支測試把
// "node" 加進去會把那道防線拆掉，而 ?raw 由 vite/client 宣告型別，不需要。
import doc from '../../docs/MOTION.md?raw';
const rows = doc.split('\n').filter((l) => /^\| \d+ \|/.test(l));

describe('MOTION.md 與程式碼同步', () => {
  it('剛好 37 條', () => {
    expect(rows).toHaveLength(37);
  });

  it('編號不重複', () => {
    const ids = rows.map((r) => Number(r.split('|')[1]!.trim()));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('§A 已刪除的 #20 不在表內', () => {
    const ids = rows.map((r) => Number(r.split('|')[1]!.trim()));
    expect(ids).not.toContain(20);
  });

  it('每一個提到的 DUR / EASE / GESTURE 識別字都真的存在', () => {
    const missing: string[] = [];
    for (const m of doc.matchAll(/`(DUR|EASE|GESTURE)\.(\w+)`/g)) {
      const [, table, key] = m as unknown as [string, string, string];
      const src = table === 'DUR' ? DUR : table === 'EASE' ? EASE : GESTURE;
      if (!(key in src)) missing.push(`${table}.${key}`);
    }
    expect(missing).toEqual([]);
  });

  it('每一列都指派了負責的計畫', () => {
    for (const r of rows) {
      const plan = r.split('|')[4]!.trim();
      expect(plan, r).toMatch(/^0[1-9]$/);
    }
  });
});
