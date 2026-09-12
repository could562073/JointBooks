import type { Category } from '../domain/types';
import type { SheetsClient } from './client';
import { CATEGORY_HEADER, categoryToRows, TXN_HEADER } from './rows';

/** §9：四張工作表 */
export const SHEET = {
  txns: '紀錄',
  config: '配置',
  yearly: '年報表',
  chart: '圖表',
} as const;

export const SHEET_TITLES = [SHEET.txns, SHEET.config, SHEET.yearly, SHEET.chart] as const;

export const LEDGER_TITLE = '加拿大共用記帳';

/** §9 圖表頁：月份 | 支出 | 收入 | 結餘 */
export const CHART_HEADER = ['月份', '支出', '收入', '結餘'] as const;

/**
 * §9 年報表頁：分類 × 十二個月交叉表，SUMIFS 取自紀錄頁。
 *
 * 公式寫死用 B 欄（主分類名稱）而不是 K 欄（主分類ID）比對：這張表是給人在
 * Sheets 裡直接看的，用 id 當列標題沒人看得懂。代價是分類改名後要重寫列標題
 * ——增補檔 C-3 已經指明「改名後由 App 重寫該列標題」。
 */
export function yearlyFormulaRow(categoryName: string, year: number): string[] {
  const months = Array.from({ length: 12 }, (_, m) => {
    const start = `${year}-${String(m + 1).padStart(2, '0')}-01`;
    const end = m === 11 ? `${year + 1}-01-01` : `${year}-${String(m + 2).padStart(2, '0')}-01`;
    // F 欄是實扣 CAD；所有統計一律用它（§14.4）
    return `=SUMIFS(${SHEET.txns}!F:F,${SHEET.txns}!B:B,"${categoryName}"`
      + `,${SHEET.txns}!A:A,">=${start}",${SHEET.txns}!A:A,"<${end}"`
      + `,${SHEET.txns}!M:M,"FALSE")`;
  });
  return [categoryName, ...months];
}

export function yearlyHeader(year: number): string[] {
  return ['分類', ...Array.from({ length: 12 }, (_, m) => `${year}-${String(m + 1).padStart(2, '0')}`)];
}

/**
 * §14.3：建立帳本 = 在使用者硬碟建立一份 Spreadsheet，寫入四張工作表與標頭列。
 *
 * 標頭用 update 而不是 append：append 會加在「已有內容的最後一列之後」，
 * 對一張全新的空表雖然結果一樣，但只要重跑一次就會多出第二份標頭。
 */
export async function createLedger(
  client: SheetsClient,
  categories: readonly Category[],
  year: number,
  title = LEDGER_TITLE
): Promise<string> {
  const id = await client.createSpreadsheet(title, SHEET_TITLES);

  await client.update(id, `${SHEET.txns}!A1:N1`, [[...TXN_HEADER]]);
  await client.update(id, `${SHEET.config}!A1:J1`, [[...CATEGORY_HEADER]]);
  await client.update(id, `${SHEET.chart}!A1:D1`, [[...CHART_HEADER]]);

  const configRows = categories.flatMap(categoryToRows);
  if (configRows.length > 0) {
    await client.update(id, `${SHEET.config}!A2:J${configRows.length + 1}`, configRows);
  }

  const expense = categories.filter((c) => c.kind === 'expense' && c.active);
  await client.update(id, `${SHEET.yearly}!A1:M${expense.length + 1}`, [
    yearlyHeader(year),
    ...expense.map((c) => yearlyFormulaRow(c.name, year)),
  ]);

  return id;
}
