import type { IconKey } from '../components/Icon';
import { toCents } from '../domain/money';
import type { Category, Currency, Person, SubCategory, Txn } from '../domain/types';

/** 增補檔 C-3 紀錄頁欄序（A–N）。順序就是寫入順序，不要在別處重排 */
export const TXN_HEADER = [
  '日期', '主分類', '子分類', '金額', '幣別', '實扣 CAD', '記帳人', '備註',
  'id', 'updatedAt', '主分類ID', '子分類ID', 'deleted', 'createdAt',
] as const;

/**
 * 增補檔 C-3 配置頁欄序（A–I），外加 J 欄「配色」。
 *
 * C-3 沒有列配色欄，但少了它同步一趟回來每個分類的顏色都會變成同一個
 * ——colorSet 是 App 產生的、無法從其他欄推得。§14.4 本來就預期實作會需要
 * 額外欄位（「配置頁加 icon 與 id 欄」），這裡沿用同一個做法。
 */
export const CATEGORY_HEADER = [
  '主分類ID', '主分類', '子分類ID', '子分類', '圖示', '月預算 CAD', '排序', '啟用', 'kind', '配色',
] as const;

const CURRENCIES = new Set<Currency>(['CAD', 'TWD', 'USD']);

/**
 * 金額寫成不帶千分位的小數兩位字串。
 *
 * 不能用 domain 的 formatCents：它會加千分位，而 valueInputOption 是 RAW，
 * `1,280.00` 會被 Sheets 原樣存成**文字**，年報表頁的 SUMIFS 就加不到它。
 * 補到兩位小數是為了對帳好看；Sheets 仍會把它認成數字。
 */
function amount(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** 讀回來時容忍人在 Sheet 上手打的千分位與空白 */
function parseAmount(raw: string): number {
  return toCents(raw.replace(/,/g, '').trim());
}

/** Sheets 一律收字串；布林寫成 TRUE/FALSE 才看得懂，也才能被公式判讀 */
function bool(v: boolean): string {
  return v ? 'TRUE' : 'FALSE';
}

function parseBool(v: string | undefined): boolean {
  return String(v ?? '').trim().toUpperCase() === 'TRUE';
}

/**
 * 一筆紀錄寫成一列。金額寫小數兩位的字串而不是數字：
 * Sheets 會把 `12.50` 顯示成 `12.5`，對帳的時候少一位小數很難看。
 */
export function txnToRow(t: Txn): string[] {
  return [
    t.date,
    t.mainName,
    t.subName,
    amount(t.amountCents),
    t.currency,
    amount(t.actualCadCents),
    t.by,
    t.note,
    t.id,
    t.updatedAt,
    t.mainId,
    t.subId,
    bool(t.deleted),
    t.createdAt,
  ];
}

/**
 * 一列讀回一筆紀錄。沒有 id 的列一律跳過——那是人在 Sheet 上手動加的列，
 * 沒有 id 就無法可靠地更新或刪除（§14.4），硬收進來只會製造出一筆改不動的帳。
 */
export function rowToTxn(row: readonly string[]): Txn | null {
  const id = (row[8] ?? '').trim();
  if (!id) return null;

  const date = (row[0] ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const cur = (row[4] ?? '').trim().toUpperCase() as Currency;
  const currency = CURRENCIES.has(cur) ? cur : 'CAD';
  const amountCents = parseAmount(row[3] ?? '');
  // 實扣沒填時退回原幣金額，跟 CAD 的規則一致，總比算成 0 好
  const actualRaw = (row[5] ?? '').trim();
  const actualCadCents = actualRaw ? parseAmount(actualRaw) : amountCents;

  return {
    id,
    date,
    mainName: row[1] ?? '',
    subName: row[2] ?? '',
    amountCents,
    currency,
    actualCadCents,
    by: ((row[6] ?? '').trim() === '妻' ? '妻' : '我') as Person,
    note: row[7] ?? '',
    updatedAt: row[9] ?? '',
    mainId: row[10] ?? '',
    subId: row[11] ?? '',
    deleted: parseBool(row[12]),
    createdAt: row[13] || (row[9] ?? ''),
  };
}

/** 配置頁是一個子分類一列，所以一個主分類會展開成多列 */
export function categoryToRows(c: Category): string[][] {
  return c.subs.map((s) => [
    c.id,
    c.name,
    s.id,
    s.name,
    c.icon,
    c.budgetCents === null ? '' : amount(c.budgetCents),
    String(c.order),
    bool(c.active),
    c.kind,
    String(c.colorSet),
  ]);
}

/**
 * 把配置頁的列合回分類。同一個主分類 ID 的列合成一筆，子分類照出現順序排。
 *
 * 主分類的欄位以第一列為準：同一個分類的每一列本來就該一致，真的不一致時
 * 取第一列比「後面蓋前面」好，至少結果跟 Sheet 由上而下的閱讀順序一致。
 */
export function rowsToCategories(rows: readonly (readonly string[])[]): Category[] {
  const byId = new Map<string, Category>();

  for (const row of rows) {
    const id = (row[0] ?? '').trim();
    if (!id) continue;

    const sub: SubCategory | null = (row[2] ?? '').trim()
      ? { id: (row[2] ?? '').trim(), name: row[3] ?? '' }
      : null;

    const existing = byId.get(id);
    if (existing) {
      if (sub) existing.subs.push(sub);
      continue;
    }

    const budgetRaw = (row[5] ?? '').trim();
    byId.set(id, {
      id,
      kind: (row[8] ?? '').trim() === 'income' ? 'income' : 'expense',
      name: row[1] ?? '',
      icon: (row[4] ?? '') as IconKey,
      budgetCents: budgetRaw ? parseAmount(budgetRaw) : null,
      subs: sub ? [sub] : [],
      colorSet: Number(row[9] ?? 0) || 0,
      order: Number(row[6] ?? 0) || 0,
      active: parseBool(row[7]),
    });
  }

  return [...byId.values()];
}
