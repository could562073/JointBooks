import { describe, expect, it } from 'vitest';
import type { Person } from '../domain/types';
import { planJoin, planSignIn, type SignInFacts } from './account';

const A = { id: 'PA', email: 'a@gmail.com' };
const B = { id: 'PB', email: 'b@gmail.com' };
const local = (count: number, ...people: Person[]) => ({ count, people: new Set(people) });
const facts = (over: Partial<SignInFacts> = {}): SignInFacts => ({
  account: A, lastAccount: null, lastLedger: null, ownLedger: null, local: local(0), ...over,
});

describe('planSignIn', () => {
  it('同一個帳號登出後再登入：接回上次那本，身分照舊', () => {
    expect(planSignIn(facts({ lastAccount: A, lastLedger: { sid: 'S', self: '妻' }, local: local(3, '我', '妻') })))
      .toEqual({ kind: 'rejoin', sid: 'S', self: '妻' });
  });

  it('手機上沒帳：有自己的帳本就接上，沒有就開新的', () => {
    expect(planSignIn(facts({ ownLedger: 'OWN' }))).toEqual({ kind: 'attach', sid: 'OWN' });
    expect(planSignIn(facts())).toEqual({ kind: 'create' });
  });

  it('第一次登入、帳號還沒有帳本、手機上是一個人記的帳：開新帳本帶過去，不問', () => {
    expect(planSignIn(facts({ local: local(4, '我') }))).toEqual({ kind: 'create' });
  });

  it('帳號已經有帳本、手機上也有帳：問，目標是那本帳', () => {
    expect(planSignIn(facts({ ownLedger: 'OWN', local: local(2, '我') }))).toEqual({
      kind: 'ask', from: null, to: 'a@gmail.com', target: 'OWN', self: '我', count: 2, canMerge: true, account: A,
    });
  });

  it('換了帳號、新帳號沒有帳本：還是要問，目標是 null（會開新帳本）', () => {
    const p = planSignIn(facts({ account: B, lastAccount: A, local: local(1, '我') }));
    expect(p).toMatchObject({ kind: 'ask', from: 'a@gmail.com', to: 'b@gmail.com', target: null, canMerge: true });
  });

  it('手機上的帳混著兩個人記的：問，而且不能合併', () => {
    const p = planSignIn(facts({ account: B, lastAccount: A, ownLedger: 'OWN', local: local(5, '我', '妻') }));
    expect(p).toMatchObject({ kind: 'ask', canMerge: false });
    // 帳號沒有帳本也一樣：混著兩個人的帳不直接帶進新帳本
    expect(planSignIn(facts({ local: local(5, '我', '妻') }))).toMatchObject({ kind: 'ask', target: null, canMerge: false });
  });
});

describe('planJoin：用邀請連結加入時', () => {
  it('手機上沒帳：直接加入', () => {
    expect(planJoin({ account: A, lastAccount: null, inviteSid: 'INV', local: local(0) })).toEqual({ kind: 'join' });
  });

  it('手機上有帳：問，目標是對方的帳本，身分是「妻」', () => {
    expect(planJoin({ account: A, lastAccount: null, inviteSid: 'INV', local: local(2, '我') })).toEqual({
      kind: 'ask', from: null, to: 'a@gmail.com', target: 'INV', self: '妻', count: 2, canMerge: true, account: A,
    });
  });
});
