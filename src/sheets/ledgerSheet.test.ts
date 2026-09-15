import { describe, it, expect, vi } from 'vitest';
import { defaultCategories } from '../domain/categories';
import type { Category } from '../domain/types';
import type { SheetsClient } from './client';
import {
  CHART_HEADER, createLedger, ENV_RANGE, LEDGER_TITLE, ledgerEnvOf, ledgerTitle, ledgerTitles, SHEET, SHEET_TITLES,
  yearlyFormulaRow, yearlyHeader,
} from './ledgerSheet';

let n = 0;
const CATS: Category[] = defaultCategories(() => `id-${n++}`);

function fakeClient() {
  const updates: { range: string; rows: string[][] }[] = [];
  const client = {
    createSpreadsheet: vi.fn(async () => 'SID-1'),
    update: vi.fn(async (_id: string, range: string, rows: string[][]) => {
      updates.push({ range, rows });
    }),
    append: vi.fn(),
    get: vi.fn(),
    shareWith: vi.fn(),
  } as unknown as SheetsClient;
  return { client, updates };
}

describe('createLedger', () => {
  it('建立四張工作表（§9）', async () => {
    const f = fakeClient();
    await createLedger(f.client, CATS, 2026, 'dev');
    expect(f.client.createSpreadsheet).toHaveBeenCalledWith(ledgerTitle('dev'), SHEET_TITLES);
    expect(SHEET_TITLES).toEqual(['紀錄', '配置', '年報表', '圖表']);
  });

  it('回傳新表的 id', async () => {
    const f = fakeClient();
    await expect(createLedger(f.client, CATS, 2026, 'dev')).resolves.toBe('SID-1');
  });

  it('標頭用 update 而不是 append——重跑一次不會多出第二份標頭', async () => {
    const f = fakeClient();
    await createLedger(f.client, CATS, 2026, 'dev');
    expect(f.client.append).not.toHaveBeenCalled();
    expect(f.updates[0]!.range).toBe(`${SHEET.txns}!A1:N1`);
  });

  it('三張表的標頭都寫進去', async () => {
    const f = fakeClient();
    await createLedger(f.client, CATS, 2026, 'dev');
    const ranges = f.updates.map((u) => u.range);
    expect(ranges).toContain(`${SHEET.txns}!A1:N1`);
    expect(ranges).toContain(`${SHEET.config}!A1:K1`);
    expect(ranges).toContain(`${SHEET.chart}!A1:D1`);
    expect(f.updates.find((u) => u.range.startsWith(SHEET.chart))!.rows[0])
      .toEqual([...CHART_HEADER]);
  });

  it('分類寫進配置頁，從第 2 列起（第 1 列是標頭）', async () => {
    const f = fakeClient();
    await createLedger(f.client, CATS, 2026, 'dev');
    const cfg = f.updates.find((u) => u.range.startsWith(`${SHEET.config}!A2`))!;
    expect(cfg.rows.length).toBe(CATS.reduce((s, c) => s + c.subs.length, 0));
  });

  it('沒有分類時不寫空的配置列', async () => {
    const f = fakeClient();
    await createLedger(f.client, [], 2026, 'dev');
    expect(f.updates.some((u) => u.range.startsWith(`${SHEET.config}!A2`))).toBe(false);
  });

  it('年報表只列支出分類（收入沒有預算也沒有交叉表意義）', async () => {
    const f = fakeClient();
    await createLedger(f.client, CATS, 2026, 'dev');
    const yearly = f.updates.find((u) => u.range.startsWith(SHEET.yearly))!;
    const expenseCount = CATS.filter((c) => c.kind === 'expense' && c.active).length;
    // 標頭 + 每個支出分類一列
    expect(yearly.rows).toHaveLength(expenseCount + 1);
  });

  it('檔名分得出環境：正式版是原名，開發版多「（開發）」', async () => {
    const prod = fakeClient();
    await createLedger(prod.client, CATS, 2026, 'prod');
    expect(prod.client.createSpreadsheet).toHaveBeenCalledWith(LEDGER_TITLE, SHEET_TITLES);
    const dev = fakeClient();
    await createLedger(dev.client, CATS, 2026, 'dev');
    expect(dev.client.createSpreadsheet).toHaveBeenCalledWith('饅頭記帳（開發）', SHEET_TITLES);
  });

  it('配置頁寫下環境標記，就在版本戳記旁邊', async () => {
    const f = fakeClient();
    await createLedger(f.client, CATS, 2026, 'prod');
    const marker = f.updates.find((u) => u.range === `${SHEET.config}!L1:M2`)!;
    expect(marker.rows).toEqual([['版本', '環境'], ['', 'prod']]);
    expect(ENV_RANGE).toBe(`${SHEET.config}!M2`);
  });
});

describe('ledgerTitles', () => {
  it('找舊帳本時也認得改名前的名稱；開發版多認沒有「（開發）」的最早那批', () => {
    expect(LEDGER_TITLE).toBe('饅頭記帳');
    // 改名前建的帳本（正式版上線時叫「饅頭共享記帳」）還是要找得到，不能再建一本
    expect(ledgerTitles('prod')).toEqual(['饅頭記帳', '饅頭共享記帳']);
    expect(ledgerTitles('dev')).toEqual(['饅頭記帳（開發）', '饅頭共享記帳（開發）', '加拿大共用記帳（開發）', '加拿大共用記帳']);
  });
});

describe('ledgerEnvOf', () => {
  it('只有明確寫 prod 才算正式帳本；空白（加標記之前建的）與其他值都算開發', () => {
    expect(ledgerEnvOf('prod')).toBe('prod');
    expect(ledgerEnvOf(' prod ')).toBe('prod');
    expect(ledgerEnvOf('dev')).toBe('dev');
    expect(ledgerEnvOf(undefined)).toBe('dev');
    expect(ledgerEnvOf('')).toBe('dev');
    expect(ledgerEnvOf('PROD')).toBe('dev');
  });
});

describe('yearlyHeader', () => {
  it('分類欄 + 十二個月', () => {
    const h = yearlyHeader(2026);
    expect(h).toHaveLength(13);
    expect(h[0]).toBe('分類');
    expect(h[1]).toBe('2026-01');
    expect(h[12]).toBe('2026-12');
  });
});

describe('yearlyFormulaRow', () => {
  it('第一格是分類名稱，後面十二格是公式', () => {
    const r = yearlyFormulaRow('外食', 2026);
    expect(r).toHaveLength(13);
    expect(r[0]).toBe('外食');
    expect(r[1]!.startsWith('=SUMIFS(')).toBe(true);
  });

  it('加總的是 F 欄實扣 CAD（§14.4：所有統計一律用它）', () => {
    expect(yearlyFormulaRow('外食', 2026)[1]).toContain('紀錄!F:F');
  });

  it('排除軟刪的列', () => {
    expect(yearlyFormulaRow('外食', 2026)[1]).toContain('紀錄!M:M,"FALSE"');
  });

  it('月份區間是半開的，12 月接到隔年 1 月', () => {
    const r = yearlyFormulaRow('外食', 2026);
    expect(r[1]).toContain('">=2026-01-01"');
    expect(r[1]).toContain('"<2026-02-01"');
    expect(r[12]).toContain('">=2026-12-01"');
    expect(r[12]).toContain('"<2027-01-01"');
  });
});
