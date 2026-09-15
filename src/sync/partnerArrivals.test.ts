import { describe, expect, it } from 'vitest';
import { defaultCategories } from '../domain/categories';
import type { Txn } from '../domain/types';
import { createArrivalWatcher, partnerToastText } from './partnerArrivals';

let n = 0;
const CATS = defaultCategories(() => `c-${n++}`);
const MARKET = CATS.find((c) => c.name === '超市')!;
const RENT = CATS.find((c) => c.name === '租屋')!;

function txn(over: Partial<Txn>): Txn {
  return {
    id: `t-${n++}`, date: '2026-09-14', mainId: MARKET.id, subId: MARKET.subs[0]!.id,
    mainName: '舊名', subName: '舊子分類', amountCents: 4218, currency: 'CAD', actualCadCents: 4218,
    by: '妻', note: '', createdAt: '2026-09-14T10:00:00Z', updatedAt: '2026-09-14T10:00:00Z', deleted: false,
    ...over,
  } as Txn;
}

describe('對方剛記的帳', () => {
  it('打開 App 時本機已經有的紀錄不算，之後同步拉到的對方新紀錄才算', () => {
    const old = txn({});
    const w = createArrivalWatcher([old.id]);
    expect(w.next([old], '我')).toEqual([]);

    const fresh = txn({});
    expect(w.next([old, fresh], '我')).toEqual([fresh]);
    // 同一筆不會通知第二次
    expect(w.next([old, fresh], '我')).toEqual([]);
  });

  it('本機一筆都沒有（第一次登入、剛加入）：第一次拉回來的整本歷史不通知', () => {
    const w = createArrivalWatcher([]);
    expect(w.next([txn({}), txn({}), txn({})], '我')).toEqual([]);
    const fresh = txn({});
    expect(w.next([fresh], '我')).toEqual([fresh]);
  });

  it('自己記的（包括自己另一支手機記的）與已刪除的不通知', () => {
    const w = createArrivalWatcher(['seed']);
    const mine = txn({ by: '我' });
    const gone = txn({ deleted: true });
    const theirs = txn({ by: '妻' });
    expect(w.next([mine, gone, theirs], '我')).toEqual([theirs]);
  });

  it('受邀那一方的手機：建立帳本的人記的才算對方', () => {
    const w = createArrivalWatcher(['seed']);
    const owner = txn({ by: '我' });
    expect(w.next([owner, txn({ by: '妻' })], '妻')).toEqual([owner]);
  });
});

describe('通知文字', () => {
  it('一筆：誰、分類（照目前的名稱）、實扣金額', () => {
    const t = txn({ subId: MARKET.subs[0]!.id, actualCadCents: 4218 });
    expect(partnerToastText([t], '雪雪大人', CATS)).toBe(`雪雪大人記了一筆 超市 · ${MARKET.subs[0]!.name} $42.18`);
  });

  it('子分類跟主分類同名時只寫一次', () => {
    const t = txn({ mainId: RENT.id, subId: RENT.subs[0]!.id, actualCadCents: 100_000 });
    expect(partnerToastText([t], '我', CATS)).toBe('我記了一筆 租屋 $1,000.00');
  });

  it('好幾筆一起到：只說幾筆', () => {
    expect(partnerToastText([txn({}), txn({}), txn({})], '雪雪大人', CATS)).toBe('雪雪大人記了 3 筆');
  });
});
