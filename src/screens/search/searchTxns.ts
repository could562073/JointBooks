import type { Category, CategoryKind, Txn } from '../../domain/types';

/** 搜尋結果的一列：交易本身加上以 id 解析好的分類資訊，畫面不必再查一次 */
export type SearchHit = {
  txn: Txn;
  category: Category | undefined;
  kind: CategoryKind;
  /** 主分類名稱（分類被刪掉時退回交易上的名稱快照） */
  mainName: string;
  /** 子分類（品項）名稱 */
  subName: string;
};

/** 同一個月的結果，月份新的在前 */
export type SearchGroup = {
  /** YYYY-MM */
  key: string;
  year: number;
  /** 1-based，直接拿來顯示 */
  month: number;
  hits: SearchHit[];
  expenseCents: number;
};

export type SearchResult = {
  groups: SearchGroup[];
  count: number;
  expenseCents: number;
};

/** 分類篩選列選了什麼：全部、某個支出主分類，或所有收入 */
export type SearchFilter = 'all' | 'income' | { mainId: string };

/** 比對用：去頭尾空白、忽略大小寫 */
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

function resolve(t: Txn, categories: Category[]): SearchHit {
  const category = categories.find((c) => c.id === t.mainId);
  const sub = category?.subs.find((s) => s.id === t.subId);
  return {
    txn: t,
    category,
    // 分類被整個刪掉時沒辦法知道是收入還支出；收入分類很少，當支出看
    kind: category?.kind ?? 'expense',
    mainName: category?.name ?? t.mainName,
    subName: sub?.name ?? t.subName,
  };
}

/**
 * 一筆紀錄符不符合關鍵字：分類、品項、備註、金額任一個「包含」關鍵字就算。
 * 金額用 toFixed(2) 的字串比，所以打「12.3」找得到 12.30。金額是實扣 CAD（含稅合計），
 * 跟紀錄表上那一欄、跟畫面上顯示的是同一個數字。
 */
export function matches(hit: SearchHit, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const fields = [hit.mainName, hit.subName, hit.txn.note, (hit.txn.actualCadCents / 100).toFixed(2)];
  return fields.some((s) => s.toLowerCase().includes(q));
}

function passes(hit: SearchHit, filter: SearchFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'income') return hit.kind === 'income';
  return hit.txn.mainId === filter.mainId;
}

/** 新的在前：日期遞減，同一天再看建立時間 */
function newestFirst(a: Txn, b: Txn): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return 0;
}

/**
 * 搜尋兩人所有月份的紀錄，關鍵字與篩選同時成立才算。
 * 沒有關鍵字（只有空白也算沒有）而且篩選是「全部」時回傳 null——那是閒置狀態，
 * 畫面只顯示最近搜尋，不把整本帳倒出來。
 */
export function searchTxns(
  txns: Txn[],
  categories: Category[],
  query: string,
  filter: SearchFilter,
): SearchResult | null {
  if (!normalizeQuery(query) && filter === 'all') return null;

  const hits = txns
    .filter((t) => !t.deleted)
    .map((t) => resolve(t, categories))
    .filter((h) => passes(h, filter) && matches(h, query))
    .sort((a, b) => newestFirst(a.txn, b.txn));

  const groups: SearchGroup[] = [];
  let expenseCents = 0;
  for (const h of hits) {
    const key = h.txn.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)), hits: [], expenseCents: 0 };
      groups.push(g);
    }
    g.hits.push(h);
    if (h.kind === 'expense') {
      g.expenseCents += h.txn.actualCadCents;
      expenseCents += h.txn.actualCadCents;
    }
  }
  return { groups, count: hits.length, expenseCents };
}

/** 月份標題：今年的只寫「9 月」，往年的要帶年份才分得出來 */
export function groupLabel(g: Pick<SearchGroup, 'year' | 'month'>, thisYear: number): string {
  return g.year === thisYear ? `${g.month} 月` : `${g.year} 年 ${g.month} 月`;
}

/** 明細列左邊的日期「9/22」 */
export function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

/**
 * 文字裡第一個符合關鍵字的地方要畫黃底（規格：只標第一處）。
 * 回傳 [前, 命中, 後]；沒命中時 hit 是空字串。
 */
export function highlight(text: string, query: string): { before: string; hit: string; after: string } {
  const q = normalizeQuery(query);
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at === -1) return { before: text, hit: '', after: '' };
  return { before: text.slice(0, at), hit: text.slice(at, at + q.length), after: text.slice(at + q.length) };
}
