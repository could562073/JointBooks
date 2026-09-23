import { describe, it, expect } from 'vitest';
import { defaultCategories } from '../domain/categories';
import type { Category, Txn } from '../domain/types';
import {
  CATEGORY_HEADER, categoryToRows, rowsToCategories, rowToTxn, TXN_HEADER, txnToRow,
} from './rows';

function txn(over: Partial<Txn> = {}): Txn {
  return {
    id: 'tx-1', date: '2026-09-06',
    mainId: 'c-food', subId: 's-1',
    mainName: '外食', subName: '飲料',
    amountCents: 1_250, currency: 'CAD', actualCadCents: 1_250,
    by: '我', note: '公司樓下',
    createdAt: '2026-09-06T15:30:00.000Z',
    updatedAt: '2026-09-06T15:30:00.000Z',
    deleted: false,
    ...over,
  };
}

describe('紀錄頁欄序（增補檔 C-3，外加 O 欄「稅」）', () => {
  it('A–O 共 15 欄', () => {
    expect(TXN_HEADER).toHaveLength(15);
    expect(txnToRow(txn())).toHaveLength(15);
  });

  it('欄位對到正確的位置', () => {
    const r = txnToRow(txn());
    expect(r[0]).toBe('2026-09-06');       // A 日期
    expect(r[1]).toBe('外食');              // B 主分類
    expect(r[4]).toBe('CAD');              // E 幣別
    expect(r[8]).toBe('tx-1');             // I id
    expect(r[10]).toBe('c-food');          // K 主分類ID
    expect(r[12]).toBe('FALSE');           // M deleted
  });

  // 稅接在最後面而不是插在金額旁邊：舊版 App 寫的是 A:N，插在中間會讓它把別的欄位寫錯位
  it('稅是最後一欄', () => {
    expect(TXN_HEADER[14]).toBe('稅');
  });
});

describe('txnToRow', () => {
  it('金額寫成小數兩位的字串，不讓 Sheets 把 12.50 顯示成 12.5', () => {
    const r = txnToRow(txn({ amountCents: 1_250 }));
    expect(r[3]).toBe('12.50');
  });

  // valueInputOption 是 RAW：帶千分位會被存成文字，年報表頁的 SUMIFS 就加不到
  it('大數字不帶千分位，Sheets 才會認成數字', () => {
    expect(txnToRow(txn({ amountCents: 205_000 }))[3]).toBe('2050.00');
  });

  it('但讀回來時容忍人手打的千分位', () => {
    const r = txnToRow(txn());
    r[3] = '2,050.00';
    expect(rowToTxn(r)!.amountCents).toBe(205_000);
  });

  it('deleted 寫成 TRUE/FALSE 而不是 true/false', () => {
    expect(txnToRow(txn({ deleted: true }))[12]).toBe('TRUE');
  });

  it('外幣的原幣與實扣各自寫出去', () => {
    const r = txnToRow(txn({ amountCents: 128_000, currency: 'TWD', actualCadCents: 5_800 }));
    expect(r[3]).toBe('1280.00');
    expect(r[4]).toBe('TWD');
    expect(r[5]).toBe('58.00');
  });

  it('有稅時寫成兩位小數，和其他金額同一個格式', () => {
    expect(txnToRow(txn({ taxCents: 285 }))[14]).toBe('2.85');
  });

  // 空字串而不是 0.00：Sheet 上一眼看得出哪幾筆有稅，也和加這一欄之前的舊列長得一樣
  it('沒填稅時寫空字串', () => {
    expect(txnToRow(txn())[14]).toBe('');
  });

  it('稅是 0 也當成沒填', () => {
    expect(txnToRow(txn({ taxCents: 0 }))[14]).toBe('');
  });
});

describe('rowToTxn', () => {
  it('往返之後每個欄位都對得起來', () => {
    const t = txn({ note: '有,逗號的備註' });
    expect(rowToTxn(txnToRow(t))).toEqual(t);
  });

  it('外幣往返', () => {
    const t = txn({ amountCents: 128_000, currency: 'TWD', actualCadCents: 5_800 });
    expect(rowToTxn(txnToRow(t))).toEqual(t);
  });

  it('沒有 id 的列一律跳過（人在 Sheet 上手加的列）', () => {
    const r = txnToRow(txn());
    r[8] = '';
    expect(rowToTxn(r)).toBeNull();
  });

  it('日期格式不對的列也跳過', () => {
    const r = txnToRow(txn());
    r[0] = '2026/9/6';
    expect(rowToTxn(r)).toBeNull();
  });

  it('幣別欄亂填時退回 CAD，不會產生一個不存在的幣別', () => {
    const r = txnToRow(txn());
    r[4] = 'JPY';
    expect(rowToTxn(r)!.currency).toBe('CAD');
  });

  it('實扣欄空白時退回原幣金額，不會算成 0', () => {
    const r = txnToRow(txn({ amountCents: 1_250 }));
    r[5] = '';
    expect(rowToTxn(r)!.actualCadCents).toBe(1_250);
  });

  it('記帳人欄亂填時退回「我」', () => {
    const r = txnToRow(txn());
    r[6] = 'somebody';
    expect(rowToTxn(r)!.by).toBe('我');
  });

  it('缺 createdAt 的舊列退回 updatedAt，明細排序才不會全擠在一起', () => {
    const r = txnToRow(txn());
    r[13] = '';
    expect(rowToTxn(r)!.createdAt).toBe(r[9]);
  });

  it('列比預期短也不會炸掉', () => {
    expect(rowToTxn(['2026-09-06', '外食'])).toBeNull();
  });

  it('讀得回稅', () => {
    const r = txnToRow(txn({ taxCents: 285 }));
    expect(rowToTxn(r)!.taxCents).toBe(285);
  });

  // 加這一欄之前寫下的列只有 14 格，不能因此冒出一個 taxCents: 0
  it('只有 14 欄的舊列讀回來沒有稅', () => {
    const r = txnToRow(txn()).slice(0, 14);
    expect('taxCents' in rowToTxn(r)!).toBe(false);
  });

  it('稅欄空白的列也沒有稅', () => {
    const r = txnToRow(txn());
    r[14] = '';
    expect('taxCents' in rowToTxn(r)!).toBe(false);
  });
});

describe('配置頁欄序', () => {
  it('A–K 共 11 欄（C-3 的 9 欄 + 配色 + 修改時間）', () => {
    expect(CATEGORY_HEADER).toHaveLength(11);
  });

  it('一個子分類一列', () => {
    const c = defaultCategories(() => 'x').find((x) => x.subs.length > 1)!;
    expect(categoryToRows(c)).toHaveLength(c.subs.length);
  });
});

describe('categoryToRows / rowsToCategories', () => {
  let n = 0;
  const CATS: Category[] = defaultCategories(() => `id-${n++}`);

  it('整份分類表往返之後一模一樣', () => {
    const rows = CATS.flatMap(categoryToRows);
    expect(rowsToCategories(rows)).toEqual(CATS);
  });

  it('配色不會在往返後全部變成同一個', () => {
    const back = rowsToCategories(CATS.flatMap(categoryToRows));
    expect(new Set(back.map((c) => c.colorSet)).size).toBeGreaterThan(1);
  });

  it('收入分類的預算是 null，不是 0', () => {
    const income = CATS.find((c) => c.kind === 'income')!;
    const back = rowsToCategories(categoryToRows(income))[0]!;
    expect(back.budgetCents).toBeNull();
  });

  it('假刪的分類 active 是 false', () => {
    const hidden = { ...CATS[0]!, active: false };
    expect(rowsToCategories(categoryToRows(hidden))[0]!.active).toBe(false);
  });

  it('修改時間往返後不變；舊表沒有這一欄時就不帶', () => {
    const edited = { ...CATS[0]!, updatedAt: 1_789_430_489_834 };
    expect(rowsToCategories(categoryToRows(edited))[0]!.updatedAt).toBe(1_789_430_489_834);
    const legacy = categoryToRows(CATS[0]!).map((r) => r.slice(0, 10));
    expect(rowsToCategories(legacy)[0]).not.toHaveProperty('updatedAt');
  });

  it('子分類照 Sheet 由上而下的順序', () => {
    const multi = CATS.find((c) => c.subs.length > 2)!;
    const back = rowsToCategories(categoryToRows(multi))[0]!;
    expect(back.subs.map((s) => s.name)).toEqual(multi.subs.map((s) => s.name));
  });

  it('沒有主分類 ID 的列跳過', () => {
    const rows = categoryToRows(CATS[0]!);
    rows.push(['', '亂寫的', '', '', '', '', '', '', '', '']);
    expect(rowsToCategories(rows)).toHaveLength(1);
  });

  it('同一個主分類分散在不同列也合得回來', () => {
    const multi = CATS.find((c) => c.subs.length > 1)!;
    const other = CATS.find((c) => c.id !== multi.id)!;
    // 故意把兩個分類的列交錯
    const a = categoryToRows(multi);
    const b = categoryToRows(other);
    const interleaved = [a[0]!, b[0]!, ...a.slice(1), ...b.slice(1)];

    const back = rowsToCategories(interleaved);
    expect(back.find((c) => c.id === multi.id)!.subs).toHaveLength(multi.subs.length);
  });
});
