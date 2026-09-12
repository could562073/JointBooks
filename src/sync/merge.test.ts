import { describe, it, expect } from 'vitest';
import type { Txn } from '../domain/types';
import { mergeTxns, needsAppend, pickNewer } from './merge';

function txn(id: string, updatedAt: string, over: Partial<Txn> = {}): Txn {
  return {
    id, date: '2026-09-06',
    mainId: 'c1', subId: 's1', mainName: '外食', subName: '飲料',
    amountCents: 1_000, currency: 'CAD', actualCadCents: 1_000,
    by: '我', note: '',
    createdAt: '2026-09-06T10:00:00.000Z',
    updatedAt,
    deleted: false,
    ...over,
  };
}

describe('pickNewer', () => {
  it('updatedAt 較新者勝', () => {
    const older = txn('a', '2026-09-06T10:00:00.000Z');
    const newer = txn('a', '2026-09-06T11:00:00.000Z');
    expect(pickNewer(older, newer)).toBe(newer);
    expect(pickNewer(newer, older)).toBe(newer);
  });

  it('相等時取遠端，否則兩台手機會各自堅持自己那份永遠收斂不了', () => {
    const l = txn('a', '2026-09-06T10:00:00.000Z', { note: '本地' });
    const r = txn('a', '2026-09-06T10:00:00.000Z', { note: '遠端' });
    expect(pickNewer(l, r).note).toBe('遠端');
  });
});

describe('mergeTxns', () => {
  it('兩邊各自獨有的都保留（append 天然安全）', () => {
    const r = mergeTxns([txn('a', 'T1')], [txn('b', 'T1')]);
    expect(r.merged.map((t) => t.id).sort()).toEqual(['a', 'b']);
  });

  it('同一個 id 取較新的那份', () => {
    const r = mergeTxns(
      [txn('a', '2026-09-06T12:00:00.000Z', { note: '本地較新' })],
      [txn('a', '2026-09-06T10:00:00.000Z', { note: '遠端較舊' })]
    );
    expect(r.merged[0]!.note).toBe('本地較新');
  });

  it('本地較新的要推上去', () => {
    const r = mergeTxns(
      [txn('a', '2026-09-06T12:00:00.000Z')],
      [txn('a', '2026-09-06T10:00:00.000Z')]
    );
    expect(r.toPush.map((t) => t.id)).toEqual(['a']);
  });

  it('遠端較新時不推，避免把新的蓋回去', () => {
    const r = mergeTxns(
      [txn('a', '2026-09-06T10:00:00.000Z')],
      [txn('a', '2026-09-06T12:00:00.000Z')]
    );
    expect(r.toPush).toEqual([]);
  });

  it('時間相同時不推——那是同一筆，推上去只是多打一次 API', () => {
    const r = mergeTxns([txn('a', 'T1')], [txn('a', 'T1')]);
    expect(r.toPush).toEqual([]);
  });

  it('遠端還沒有的本地紀錄要推上去', () => {
    const r = mergeTxns([txn('a', 'T1')], []);
    expect(r.toPush.map((t) => t.id)).toEqual(['a']);
  });

  it('遠端獨有的不推回去', () => {
    const r = mergeTxns([], [txn('b', 'T1')]);
    expect(r.toPush).toEqual([]);
    expect(r.merged.map((t) => t.id)).toEqual(['b']);
  });

  it('軟刪的紀錄照樣參與比較，較新的刪除會蓋掉較舊的編輯', () => {
    const r = mergeTxns(
      [txn('a', '2026-09-06T10:00:00.000Z', { note: '我編輯了' })],
      [txn('a', '2026-09-06T12:00:00.000Z', { deleted: true })]
    );
    expect(r.merged[0]!.deleted).toBe(true);
  });

  it('兩邊都空時結果是空的', () => {
    expect(mergeTxns([], [])).toEqual({ merged: [], toPush: [] });
  });

  it('不會產生重複 id', () => {
    const r = mergeTxns(
      [txn('a', 'T1'), txn('b', 'T1')],
      [txn('a', 'T2'), txn('c', 'T1')]
    );
    expect(new Set(r.merged.map((t) => t.id)).size).toBe(r.merged.length);
  });
});

describe('needsAppend', () => {
  it('遠端還沒有才 append', () => {
    expect(needsAppend('a', new Set())).toBe(true);
  });

  it('遠端已經有就不要再 append——這是重複列的來源', () => {
    // 一次逾時但其實成功的 append，沒有這一步重試時就會變成兩列一樣的帳
    expect(needsAppend('a', new Set(['a']))).toBe(false);
  });
});
