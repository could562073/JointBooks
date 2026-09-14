import { describe, it, expect, vi } from 'vitest';
import { defaultCategories } from '../domain/categories';
import type { SheetsClient } from './client';
import { CATEGORIES_RANGE, SHEET, writeCategories } from './ledgerSheet';

let n = 0;
const CATS = defaultCategories(() => `c-${n++}`);

function fakeClient() {
  const calls: { op: 'clear' | 'update'; range: string; rows?: string[][] }[] = [];
  const client = {
    clear: vi.fn(async (_id: string, range: string) => { calls.push({ op: 'clear', range }); }),
    update: vi.fn(async (_id: string, range: string, rows: string[][]) => { calls.push({ op: 'update', range, rows }); }),
  } as unknown as SheetsClient;
  return { client, calls };
}

describe('writeCategories：分類整批寫回試算表', () => {
  it('先清掉配置頁的分類區再寫，舊的列不會留在表上', async () => {
    const f = fakeClient();
    await writeCategories(f.client, 'SID', CATS, 2026);
    expect(CATEGORIES_RANGE).toBe('配置!A2:J');
    const clearIdx = f.calls.findIndex((c) => c.op === 'clear' && c.range === CATEGORIES_RANGE);
    const writeIdx = f.calls.findIndex((c) => c.op === 'update' && c.range.startsWith(`${SHEET.config}!A2:J`));
    expect(clearIdx).toBeGreaterThanOrEqual(0);
    expect(writeIdx).toBeGreaterThan(clearIdx);
    expect(f.calls[writeIdx]!.rows).toHaveLength(CATS.reduce((sum, c) => sum + c.subs.length, 0));
  });

  it('年報表也照新的分類重寫（只列啟用中的支出分類）', async () => {
    const f = fakeClient();
    await writeCategories(f.client, 'SID', CATS, 2026);
    const yearly = f.calls.find((c) => c.op === 'update' && c.range.startsWith(SHEET.yearly))!;
    const expense = CATS.filter((c) => c.kind === 'expense' && c.active);
    expect(yearly.rows).toHaveLength(expense.length + 1);
    expect(f.calls.some((c) => c.op === 'clear' && c.range === `${SHEET.yearly}!A1:M`)).toBe(true);
  });

  it('分類清空時不寫空的配置列，但仍清掉舊的', async () => {
    const f = fakeClient();
    await writeCategories(f.client, 'SID', [], 2026);
    expect(f.calls.some((c) => c.op === 'clear' && c.range === CATEGORIES_RANGE)).toBe(true);
    expect(f.calls.some((c) => c.op === 'update' && c.range.startsWith(`${SHEET.config}!A2`))).toBe(false);
  });
});
