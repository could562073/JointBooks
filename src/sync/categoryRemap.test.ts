import { describe, expect, it } from 'vitest';
import type { Category, Txn } from '../domain/types';
import { remapToLedger } from './categoryRemap';

const cat = (id: string, name: string, subs: [string, string][], over: Partial<Category> = {}): Category => ({
  id, kind: 'expense', name, icon: 'bus', budgetCents: null,
  subs: subs.map(([sid, sname]) => ({ id: sid, name: sname })),
  colorSet: 0, order: 0, active: true, updatedAt: 1, ...over,
});
const txn = (id: string, mainId: string, subId: string): Txn => ({
  id, date: '2026-09-18', mainId, subId, mainName: '', subName: '',
  amountCents: 100, currency: 'CAD', actualCadCents: 100, by: '我', note: '',
  createdAt: '2026-09-18T00:00:00.000Z', updatedAt: '2026-09-18T00:00:00.000Z', deleted: false,
});
const NOW = 999;

describe('remapToLedger', () => {
  it('同名的主分類與子分類改指向雲端的 id，雲端分類不變', () => {
    const local = [cat('L1', '外食', [['l1a', '午餐']])];
    const remote = [cat('R1', '外食', [['r1a', '午餐']], { order: 3 })];
    const r = remapToLedger(local, remote, [txn('t1', 'L1', 'l1a')], NOW);
    expect(r.txns[0]).toMatchObject({ mainId: 'R1', subId: 'r1a' });
    expect(r.categories).toEqual(remote);
  });

  it('收支類型不同就不算同一個', () => {
    const local = [cat('L1', '獎金', [['l1a', '獎金']], { kind: 'income' })];
    const remote = [cat('R1', '獎金', [['r1a', '獎金']])];
    const r = remapToLedger(local, remote, [txn('t1', 'L1', 'l1a')], NOW);
    expect(r.txns[0]).toMatchObject({ mainId: 'L1', subId: 'l1a' });
    expect(r.categories.map((c) => c.id)).toEqual(['R1', 'L1']);
  });

  it('雲端沒有的主分類：有帳在用才帶過去，排在後面、帶修改時間；沒在用的不帶', () => {
    const local = [cat('L1', '寵物', [['l1a', '飼料']]), cat('L2', '健身', [['l2a', '月費']])];
    const remote = [cat('R1', '外食', [['r1a', '午餐']], { order: 4 })];
    const r = remapToLedger(local, remote, [txn('t1', 'L1', 'l1a')], NOW);
    expect(r.categories.map((c) => c.id)).toEqual(['R1', 'L1']);
    expect(r.categories[1]).toMatchObject({ order: 5, updatedAt: NOW });
  });

  it('對到的主分類底下，雲端沒有、又有帳在用的子分類加進去，那個分類的修改時間跟著更新', () => {
    const local = [cat('L1', '外食', [['l1a', '午餐'], ['l1b', '宵夜'], ['l1c', '早餐']])];
    const remote = [cat('R1', '外食', [['r1a', '午餐']])];
    const r = remapToLedger(local, remote, [txn('t1', 'L1', 'l1b')], NOW);
    expect(r.categories[0]!.subs.map((s) => s.name)).toEqual(['午餐', '宵夜']);
    expect(r.categories[0]!.updatedAt).toBe(NOW);
    expect(r.txns[0]).toMatchObject({ mainId: 'R1', subId: 'l1b' });
  });

  it('雲端同名的分類一個被刪、一個還在用：對到還在用的', () => {
    const local = [cat('L1', '外食', [['l1a', '午餐']])];
    const remote = [cat('OLD', '外食', [['o', '午餐']], { active: false }), cat('R1', '外食', [['r1a', '午餐']])];
    const r = remapToLedger(local, remote, [txn('t1', 'L1', 'l1a')], NOW);
    expect(r.txns[0]!.mainId).toBe('R1');
  });
});
