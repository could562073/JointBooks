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

export const LEDGER_TITLE = '饅頭記帳';

/** 改名前的帳本名稱，找自己之前建的帳本時一併認得。2026-09-13 從這個名稱改成「饅頭共享記帳」 */
const LEGACY_TITLE = '加拿大共用記帳';

/** 正式版上線時的名稱，2026-09-14 使用者改名成「饅頭記帳」 */
const SHARED_TITLE = '饅頭共享記帳';

/**
 * 帳本屬於哪個環境。開發版（npm run dev）建的是測試帳本，部署出去的正式版建的
 * 才是真正在記的帳；兩邊不能混用，否則測試資料會寫進真帳。
 */
export type LedgerEnv = 'dev' | 'prod';

/** 雲端硬碟裡一眼分得出來：開發版的檔名多一個「（開發）」 */
export function ledgerTitle(env: LedgerEnv): string {
  return env === 'prod' ? LEDGER_TITLE : `${LEDGER_TITLE}（開發）`;
}

/**
 * 找自己之前建的帳本時要認得的名稱：現在的、改名前的。已經建好的帳本不會跟著改檔名，
 * 換手機或清過資料時還是要接回那一本，不能因為改名就再建一本新的。
 * 正式版上線時叫「饅頭共享記帳」，沒用過更早的「加拿大共用記帳」。
 * 加上環境標記之前建的帳本全是開發時建的，當時檔名還沒有「（開發）」，所以開發版多認一個。
 */
export function ledgerTitles(env: LedgerEnv): string[] {
  return env === 'prod'
    ? [LEDGER_TITLE, SHARED_TITLE]
    : [ledgerTitle('dev'), `${SHARED_TITLE}（開發）`, `${LEGACY_TITLE}（開發）`, LEGACY_TITLE];
}

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
  env: LedgerEnv
): Promise<string> {
  const id = await client.createSpreadsheet(ledgerTitle(env), SHEET_TITLES);

  await client.update(id, `${SHEET.txns}!A1:N1`, [[...TXN_HEADER]]);
  await client.update(id, `${SHEET.config}!A1:K1`, [[...CATEGORY_HEADER]]);
  await client.update(id, `${SHEET.chart}!A1:D1`, [[...CHART_HEADER]]);

  const configRows = categories.flatMap(categoryToRows);
  if (configRows.length > 0) {
    await client.update(id, `${SHEET.config}!A2:K${configRows.length + 1}`, configRows);
  }

  const expense = categories.filter((c) => c.kind === 'expense' && c.active);
  await client.update(id, `${SHEET.yearly}!A1:M${expense.length + 1}`, [
    yearlyHeader(year),
    ...expense.map((c) => yearlyFormulaRow(c.name, year)),
  ]);

  // 版本戳記（REV_RANGE＝配置!L2）先放空值，同步控制器之後每次推送就改寫它；
  // 環境標記（ENV_RANGE＝配置!M2）寫了就不再動
  await client.update(id, `${SHEET.config}!L1:M2`, [['版本', '環境'], ['', env]]);

  return id;
}

/**
 * 版本戳記所在的儲存格（配置頁 A–K 已被分類用掉，L 欄空著）。
 *
 * 任何一台裝置把變更推上來之後就改寫這一格；另一台每 5 秒輪詢時只讀這一格，
 * 沒變就不必把整張紀錄表拉下來。紀錄表會越記越長，這一格永遠只有一個值。
 */
export const REV_RANGE = `${SHEET.config}!L2`;

/** 環境標記所在的儲存格，就在版本戳記旁邊 */
export const ENV_RANGE = `${SHEET.config}!M2`;

/**
 * 只有明確寫著 prod 才算正式帳本。空白一律當成開發：加上這個標記之前建的帳本
 * 全是開發時建的；而且判錯的方向是安全的——正式版會拒絕它，不會把測試帳當真帳。
 */
export function ledgerEnvOf(cell: string | undefined): LedgerEnv {
  return cell?.trim() === 'prod' ? 'prod' : 'dev';
}

/** 配置頁放分類的範圍（第 1 列是標頭，K 欄是修改時間）；L 欄以後是版本戳記、環境標記與成員，不在範圍內 */
export const CATEGORIES_RANGE = `${SHEET.config}!A2:K`;

/**
 * 把分類整批寫回配置頁，並照新的分類重寫年報表（改名、新增的分類在年報表才對得上）。
 * 先清再寫：分類或子分類變少時，舊的列才不會留在表上。
 */
export async function writeCategories(
  client: SheetsClient,
  id: string,
  categories: readonly Category[],
  year: number
): Promise<void> {
  await client.clear(id, CATEGORIES_RANGE);
  // 標頭一起寫：加上 K 欄（修改時間）之前建的帳本，標頭列只到 J
  await client.update(id, `${SHEET.config}!A1:K1`, [[...CATEGORY_HEADER]]);
  const configRows = categories.flatMap(categoryToRows);
  if (configRows.length > 0) {
    await client.update(id, `${SHEET.config}!A2:K${configRows.length + 1}`, configRows);
  }

  const expense = categories.filter((c) => c.kind === 'expense' && c.active);
  await client.clear(id, `${SHEET.yearly}!A1:M`);
  await client.update(id, `${SHEET.yearly}!A1:M${expense.length + 1}`, [
    yearlyHeader(year),
    ...expense.map((c) => yearlyFormulaRow(c.name, year)),
  ]);
}
