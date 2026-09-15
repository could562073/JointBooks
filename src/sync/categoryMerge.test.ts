import { describe, expect, it } from 'vitest';
import { defaultCategories } from '../domain/categories';
import type { Category } from '../domain/types';
import { mergeCategories, sameCategories, sameContent } from './categoryMerge';

let n = 0;
const BASE = defaultCategories(() => `c-${n++}`);
const RENT = BASE[0]!;
const FOOD = BASE[2]!;

const edit = (c: Category, patch: Partial<Category>, at: number): Category => ({ ...c, ...patch, updatedAt: at });
const swap = (cs: readonly Category[], next: Category) => cs.map((c) => (c.id === next.id ? next : c));
const find = (cs: readonly Category[], id: string) => cs.find((c) => c.id === id)!;

describe('分類逐一合併', () => {
  it('另一支手機手上是舊的整份分類：蓋不掉對方較新的修改（使用者回報）', () => {
    const theirs = swap(BASE, edit(RENT, { budgetCents: 250_000 }, 100));
    const r = mergeCategories(BASE, theirs);
    expect(find(r.merged, RENT.id).budgetCents).toBe(250_000);
    expect(r.pushNeeded).toBe(false);
    expect(r.saveNeeded).toBe(true);
  });

  it('兩邊各改不同的分類：兩個修改都留下，兩邊都要更新', () => {
    const mine = swap(BASE, edit(FOOD, { icon: 'coffee' as Category['icon'] }, 200));
    const theirs = swap(BASE, edit(RENT, { budgetCents: 250_000 }, 100));
    const r = mergeCategories(mine, theirs);
    expect(find(r.merged, FOOD.id).icon).toBe('coffee');
    expect(find(r.merged, RENT.id).budgetCents).toBe(250_000);
    expect(r.pushNeeded).toBe(true);
    expect(r.saveNeeded).toBe(true);
  });

  it('同一個分類兩邊都改：修改時間較新的贏', () => {
    const mine = swap(BASE, edit(RENT, { name: '房租' }, 300));
    const theirs = swap(BASE, edit(RENT, { name: '住' }, 100));
    expect(find(mergeCategories(mine, theirs).merged, RENT.id).name).toBe('房租');
    expect(find(mergeCategories(theirs, mine).merged, RENT.id).name).toBe('房租');
  });

  it('子分類增刪跟著整個分類的修改時間走', () => {
    const theirs = swap(BASE, edit(FOOD, { subs: [...FOOD.subs, { id: 'new-sub', name: '宵夜' }] }, 100));
    const r = mergeCategories(BASE, theirs);
    expect(find(r.merged, FOOD.id).subs.map((s) => s.name)).toContain('宵夜');
  });

  it('兩邊都沒有修改時間（舊分類）又不一樣：以雲端為準；指定以本機為準時才留本機', () => {
    const mine = swap(BASE, { ...RENT, name: '本機改的' });
    expect(find(mergeCategories(mine, BASE).merged, RENT.id).name).toBe(RENT.name);
    const preferLocal = mergeCategories(mine, BASE, true);
    expect(find(preferLocal.merged, RENT.id).name).toBe('本機改的');
    expect(preferLocal.pushNeeded).toBe(true);
  });

  it('只有本機有的分類（剛新增、還沒推）留下並推上去', () => {
    const added: Category = { ...edit(FOOD, { name: '寵物' }, 50), id: 'pet', order: 99 };
    const r = mergeCategories([...BASE, added], BASE);
    expect(r.merged.map((c) => c.id)).toContain('pet');
    expect(r.pushNeeded).toBe(true);
    expect(r.saveNeeded).toBe(false);
  });

  it('只有雲端有的分類（對方新增的）加進本機', () => {
    const added: Category = { ...edit(FOOD, { name: '寵物' }, 50), id: 'pet', order: 99 };
    const r = mergeCategories(BASE, [...BASE, added]);
    expect(r.merged.map((c) => c.id)).toContain('pet');
    expect(r.pushNeeded).toBe(false);
    expect(r.saveNeeded).toBe(true);
  });

  it('雲端的分類區是空的：保留本機，寫回雲端補上', () => {
    const r = mergeCategories(BASE, []);
    expect(r.merged).toHaveLength(BASE.length);
    expect(r.pushNeeded).toBe(true);
    expect(r.saveNeeded).toBe(false);
  });

  it('兩邊一樣就什麼都不用做', () => {
    const r = mergeCategories(BASE, [...BASE].reverse());
    expect(r.pushNeeded).toBe(false);
    expect(r.saveNeeded).toBe(false);
  });
});

describe('內容比對', () => {
  it('sameContent 不看修改時間：按了 ✓ 但沒改到東西不算修改', () => {
    expect(sameContent(RENT, { ...RENT, updatedAt: 999 })).toBe(true);
    expect(sameContent(RENT, { ...RENT, budgetCents: 1 })).toBe(false);
  });

  it('sameCategories 看修改時間、不看清單順序', () => {
    expect(sameCategories(BASE, [...BASE].reverse())).toBe(true);
    expect(sameCategories(BASE, swap(BASE, { ...RENT, updatedAt: 1 }))).toBe(false);
  });
});
