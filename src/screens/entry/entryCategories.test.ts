import { describe, it, expect } from 'vitest';
import { defaultCategories } from '../../domain/categories';
import type { Category } from '../../domain/types';
import { createMain, createSub } from './entryCategories';

let n = 0;
const CATS: Category[] = defaultCategories(() => `id-${n++}`);
const EXPENSE = CATS.filter((c) => c.kind === 'expense');

describe('createMain', () => {
  it('建立新主分類並回傳 id', () => {
    const r = createMain(CATS, 'expense', '寵物', () => 'new-1')!;
    expect(r.id).toBe('new-1');
    expect(r.category).toMatchObject({ kind: 'expense', name: '寵物', active: true });
  });

  it('修剪前後空白', () => {
    expect(createMain(CATS, 'expense', '  寵物  ', () => 'x')!.category.name).toBe('寵物');
  });

  it('名稱空白時不建立', () => {
    expect(createMain(CATS, 'expense', '   ')).toBeNull();
  });

  it('同 kind 已有同名分類時回傳既有那顆，不重複建立', () => {
    const first = EXPENSE[0]!;
    const r = createMain(CATS, 'expense', first.name)!;
    expect(r.id).toBe(first.id);
    expect(r.category).toBe(first);
  });

  it('不同 kind 的同名分類不算重複', () => {
    const r = createMain(CATS, 'income', EXPENSE[0]!.name, () => 'new-2')!;
    expect(r.id).toBe('new-2');
    expect(r.category.kind).toBe('income');
  });

  it('收入分類沒有預算', () => {
    expect(createMain(CATS, 'income', '副業', () => 'x')!.category.budgetCents).toBeNull();
  });

  it('新分類插在清單最上方（order 比現有的都小）', () => {
    const r = createMain(CATS, 'expense', '寵物', () => 'x')!;
    expect(r.category.order).toBeLessThan(Math.min(...CATS.map((c) => c.order)));
  });
});

describe('createSub', () => {
  it('在指定主分類下建立子分類並回傳 id', () => {
    const main = EXPENSE[0]!;
    const r = createSub(CATS, main.id, '押金', () => 'sub-1')!;
    expect(r.id).toBe('sub-1');
    expect(r.category.subs.map((s) => s.name)).toContain('押金');
  });

  it('原本的子分類都還在', () => {
    const main = EXPENSE.find((c) => c.subs.length > 1)!;
    const r = createSub(CATS, main.id, '新的', () => 'sub-2')!;
    for (const s of main.subs) expect(r.category.subs.map((x) => x.id)).toContain(s.id);
  });

  it('重名時回傳既有那顆的 id，不重複建立', () => {
    const main = EXPENSE[0]!;
    const existing = main.subs[0]!;
    const r = createSub(CATS, main.id, existing.name)!;
    expect(r.id).toBe(existing.id);
    expect(r.category.subs).toHaveLength(main.subs.length);
  });

  it('名稱空白或主分類不存在時不建立', () => {
    expect(createSub(CATS, EXPENSE[0]!.id, '  ')).toBeNull();
    expect(createSub(CATS, 'gone', '押金')).toBeNull();
  });
});
