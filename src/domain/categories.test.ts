import { describe, it, expect } from 'vitest';
import {
  defaultCategories, makeCategory, nextColorSet, nextOrder, renameCategory, setIcon, setBudget,
  addSub, removeSub, softDelete, selectable, resolveNames,
} from './categories';
import type { Txn } from './types';

let n = 0;
const ids = () => `id-${++n}`;
const fresh = () => { n = 0; return defaultCategories(ids); };

describe('預設分類（§3）', () => {
  it('六個支出分類 + 一個收入分類', () => {
    const cats = fresh();
    expect(cats.filter((c) => c.kind === 'expense')).toHaveLength(6);
    expect(cats.filter((c) => c.kind === 'income')).toHaveLength(1);
  });

  it('支出分類的圖示、預算、子分類逐條符合 §3 表格', () => {
    const by = Object.fromEntries(fresh().map((c) => [c.name, c]));

    expect(by['租屋']!).toMatchObject({ icon: 'house', budgetCents: 210_000 });
    expect(by['租屋']!.subs.map((s) => s.name)).toEqual(['租屋']);

    expect(by['保險']!).toMatchObject({ icon: 'shield', budgetCents: 26_000 });
    expect(by['保險']!.subs.map((s) => s.name)).toEqual(['保險']);

    expect(by['外食']!).toMatchObject({ icon: 'cup', budgetCents: 45_000 });
    expect(by['外食']!.subs.map((s) => s.name)).toEqual(['飲料', '外帶', '內用']);

    expect(by['超市']!).toMatchObject({ icon: 'basket', budgetCents: 80_000 });
    expect(by['超市']!.subs.map((s) => s.name))
      .toEqual(['食材', '水果', '雜貨', '消耗品', '化妝品', '零食', '熟食', '稅']);

    expect(by['娛樂']!).toMatchObject({ icon: 'ticket', budgetCents: 20_000 });
    expect(by['娛樂']!.subs.map((s) => s.name)).toEqual(['門票', '電影票']);

    expect(by['交通']!).toMatchObject({ icon: 'bus', budgetCents: 18_000 });
    expect(by['交通']!.subs.map((s) => s.name)).toEqual(['儲值', '單程票']);
  });

  it('收入分類：icon coin、無預算、四個子分類（增補檔 B-2、§5）', () => {
    const inc = fresh().find((c) => c.kind === 'income')!;
    expect(inc.name).toBe('收入');
    expect(inc.icon).toBe('coin');
    expect(inc.budgetCents).toBeNull();
    expect(inc.subs.map((s) => s.name)).toEqual(['薪資', '退稅', '獎金', '其他']);
  });

  it('每個分類與子分類都有 id，且全域唯一', () => {
    const cats = fresh();
    const all = [...cats.map((c) => c.id), ...cats.flatMap((c) => c.subs.map((s) => s.id))];
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('makeCategory（§11-5）', () => {
  it('新分類：bag、$150、一個同名子分類', () => {
    const cats = fresh();
    const c = makeCategory({
      kind: 'expense', name: '水電',
      colorSet: nextColorSet(cats), order: nextOrder(cats), newId: ids,
    });
    expect(c.icon).toBe('bag');
    expect(c.budgetCents).toBe(15_000);
    expect(c.subs).toHaveLength(1);
    expect(c.subs[0]!.name).toBe('水電');
    expect(c.active).toBe(true);
  });

  it('收入分類沒有預算', () => {
    const cats = fresh();
    const c = makeCategory({
      kind: 'income', name: '副業',
      colorSet: nextColorSet(cats), order: nextOrder(cats), newId: ids,
    });
    expect(c.budgetCents).toBeNull();
  });

  it('I7：配色是單調計數器（含已假刪的分類），軟刪一個分類後新分類不會撞色', () => {
    let cats = fresh();
    cats = cats.map((c) => (c.name === '娛樂' ? softDelete(c) : c));
    const c = makeCategory({
      kind: 'expense', name: '水電',
      colorSet: nextColorSet(cats), order: nextOrder(cats), newId: ids,
    });
    expect(cats.some((x) => x.colorSet === c.colorSet)).toBe(false);
  });

  it('I7：新分類的 order 比既有最小值還小，插入清單最上方（§7-2、§15.1-12）', () => {
    const cats = fresh();
    const c = makeCategory({
      kind: 'expense', name: '水電',
      colorSet: nextColorSet(cats), order: nextOrder(cats), newId: ids,
    });
    const sorted = [...cats, c].sort((a, b) => a.order - b.order);
    expect(sorted[0]!.id).toBe(c.id);
  });
});

describe('分類編輯', () => {
  const base = () => fresh().find((c) => c.name === '外食')!;

  it('改名不動 id（增補檔 C-1：改名要連動既有紀錄）', () => {
    const c = base();
    const r = renameCategory(c, '餐飲');
    expect(r.name).toBe('餐飲');
    expect(r.id).toBe(c.id);
  });

  it('改名去頭尾空白；空白名稱視為取消', () => {
    const c = base();
    expect(renameCategory(c, '  餐飲  ').name).toBe('餐飲');
    expect(renameCategory(c, '   ').name).toBe('外食');
  });

  it('換圖示與改預算', () => {
    expect(setIcon(base(), 'drink').icon).toBe('drink');
    expect(setBudget(base(), 50_000).budgetCents).toBe(50_000);
  });

  it('§11-6：子分類至少留一個', () => {
    const cats = fresh();
    let c = makeCategory({
      kind: 'expense', name: '水電',
      colorSet: nextColorSet(cats), order: nextOrder(cats), newId: ids,
    });
    expect(c.subs).toHaveLength(1);
    c = removeSub(c, c.subs[0]!.id);
    expect(c.subs).toHaveLength(1);   // 拒絕刪成空
  });

  it('新增子分類；重名則忽略', () => {
    let c = base();
    c = addSub(c, '宵夜', ids);
    expect(c.subs.map((s) => s.name)).toContain('宵夜');
    const before = c.subs.length;
    c = addSub(c, '宵夜', ids);
    expect(c.subs).toHaveLength(before);
  });

  it('假刪只翻 active，不動 id 與子分類', () => {
    const c = base();
    const d = softDelete(c);
    expect(d.active).toBe(false);
    expect(d.id).toBe(c.id);
    expect(d.subs).toEqual(c.subs);
  });
});

describe('selectable 與 resolveNames', () => {
  it('記帳選單只列該 kind 且 active 的分類（§9、§15.1-14）', () => {
    const cats = fresh().map((c) => (c.name === '娛樂' ? softDelete(c) : c));
    const names = selectable(cats, 'expense').map((c) => c.name);
    expect(names).not.toContain('娛樂');
    expect(names).toContain('外食');
    expect(selectable(cats, 'income').map((c) => c.name)).toEqual(['收入']);
  });

  it('顯示名稱以 id 解析，改名後歷史紀錄自動連動', () => {
    let cats = fresh();
    const food = cats.find((c) => c.name === '外食')!;
    const t: Txn = {
      id: 't1', date: '2026-09-05', mainId: food.id, subId: food.subs[0]!.id,
      mainName: '外食', subName: '飲料', amountCents: 520, currency: 'CAD',
      actualCadCents: 520, by: '我', note: '咖啡',
      createdAt: '2026-09-05T08:40:00.000Z', updatedAt: '2026-09-05T08:40:00.000Z', deleted: false,
    };
    cats = cats.map((c) => (c.id === food.id ? renameCategory(c, '餐飲') : c));
    expect(resolveNames(cats, t)).toEqual({ main: '餐飲', sub: '飲料' });
  });

  it('假刪的分類仍解析得到名稱（統計要看得到）', () => {
    let cats = fresh();
    const food = cats.find((c) => c.name === '外食')!;
    const t: Txn = {
      id: 't1', date: '2026-09-05', mainId: food.id, subId: food.subs[0]!.id,
      mainName: '外食', subName: '飲料', amountCents: 520, currency: 'CAD',
      actualCadCents: 520, by: '我', note: '',
      createdAt: '2026-09-05T08:40:00.000Z', updatedAt: '2026-09-05T08:40:00.000Z', deleted: false,
    };
    cats = cats.map((c) => (c.id === food.id ? softDelete(c) : c));
    expect(resolveNames(cats, t).main).toBe('外食');
  });

  it('id 查不到時退回名稱快照（有人在 Sheets 手動填了亂 id）', () => {
    const t: Txn = {
      id: 't1', date: '2026-09-05', mainId: 'gone', subId: 'gone',
      mainName: '舊分類', subName: '舊子分類', amountCents: 100, currency: 'CAD',
      actualCadCents: 100, by: '我', note: '',
      createdAt: '2026-09-05T08:40:00.000Z', updatedAt: '2026-09-05T08:40:00.000Z', deleted: false,
    };
    expect(resolveNames(fresh(), t)).toEqual({ main: '舊分類', sub: '舊子分類' });
  });
});
