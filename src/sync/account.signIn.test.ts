import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../db/schema';
import { ledgerRepo } from '../repo/ledgerRepo';
import { SheetsError, type SheetsClient } from '../sheets/client';
import { CATEGORIES_RANGE, ENV_RANGE } from '../sheets/ledgerSheet';
import { categoryToRows } from '../sheets/rows';
import { defaultCategories } from '../domain/categories';
import type { Person } from '../domain/types';
import { signIn } from './account';
import { LAST_LEDGER_KEY, LOCAL_MODE_KEY, lastAccount, rememberAccount } from './accountState';
import { joinedSid, SELF_KEY } from './ledgerId';

const A = { id: 'PA', email: 'a@gmail.com' };

/** 假的 Sheets／Drive：sheets 是「帳本 id → 分類」，forbidden 裡的帳本讀了回 403 */
function fakeClient(o: {
  account?: { id: string; email: string };
  owned?: string[];
  sheets?: Record<string, string[][]>;
  forbidden?: string[];
} = {}) {
  return {
    aboutUser: vi.fn(async () => o.account ?? A),
    findLedgers: vi.fn(async () => (o.owned ?? []).map((id) => ({ id, ownedByMe: true }))),
    get: vi.fn(async (sid: string, range: string) => {
      if (o.forbidden?.includes(sid)) throw new SheetsError(403, '');
      if (range === ENV_RANGE) return [['dev']];
      if (range === CATEGORIES_RANGE) return o.sheets?.[sid] ?? [];
      return [];
    }),
    createSpreadsheet: vi.fn(async () => 'NEW'),
    update: vi.fn(async () => ({})),
  } as unknown as SheetsClient & Record<'aboutUser' | 'findLedgers' | 'get' | 'createSpreadsheet', ReturnType<typeof vi.fn>>;
}

const deps = (client: SheetsClient) => ({ client, tokens: { disconnect: vi.fn(async () => {}) }, env: 'dev' as const });

async function addTxn(by: Person) {
  const [c] = await ledgerRepo.listCategories();
  return ledgerRepo.addTxn({
    date: '2026-09-18', mainId: c!.id, subId: c!.subs[0]!.id,
    amountCents: 100, currency: 'CAD', actualCadCents: 100, by, note: '',
  });
}

beforeEach(async () => {
  await resetDb();
  await ledgerRepo.bootstrap();
  await ledgerRepo.setMeta(LOCAL_MODE_KEY, true);
});

describe('signIn', () => {
  it('第一次登入、帳號還沒有帳本：開新帳本，手機上的帳帶過去，記下帳號、離開本機模式', async () => {
    await addTxn('我');
    const client = fakeClient();
    expect(await signIn(deps(client))).toEqual({ kind: 'linked', sid: 'NEW' });
    expect(client.createSpreadsheet).toHaveBeenCalled();
    expect(await joinedSid()).toBe('NEW');
    expect(await lastAccount()).toEqual(A);
    expect(await ledgerRepo.getMeta(LOCAL_MODE_KEY)).toBe(false);
    expect(await ledgerRepo.getMeta(SELF_KEY)).toBe('我');
  });

  it('同一個帳號登出後再登入：接回上次那本，身分照舊、分類不換', async () => {
    await rememberAccount(A);
    await ledgerRepo.setMeta(LAST_LEDGER_KEY, { sid: 'THEIRS', self: '妻' });
    const before = await ledgerRepo.listCategories();
    const client = fakeClient({ sheets: { THEIRS: defaultCategories(() => `r-${Math.random()}`).flatMap(categoryToRows) } });

    expect(await signIn(deps(client))).toEqual({ kind: 'linked', sid: 'THEIRS' });
    expect(await ledgerRepo.getMeta(SELF_KEY)).toBe('妻');
    expect(await ledgerRepo.getMeta(LAST_LEDGER_KEY)).toBeNull();
    expect(await ledgerRepo.listCategories()).toEqual(before);
  });

  it('接回時對方已經取消共用：改走一般流程（手機上混著兩個人的帳 → 要問、不能合併）', async () => {
    await rememberAccount(A);
    await ledgerRepo.setMeta(LAST_LEDGER_KEY, { sid: 'THEIRS', self: '妻' });
    await addTxn('我');
    await addTxn('妻');
    const r = await signIn(deps(fakeClient({ forbidden: ['THEIRS'] })));
    expect(r).toMatchObject({ kind: 'ask', target: null, canMerge: false });
    expect(await joinedSid()).toBeNull();
  });

  it('手機上沒帳、帳號已經有帳本：接上並換成那本的分類', async () => {
    const remote = defaultCategories(() => `r-${Math.random()}`);
    const client = fakeClient({ owned: ['OWN'], sheets: { OWN: remote.flatMap(categoryToRows) } });
    expect(await signIn(deps(client))).toEqual({ kind: 'linked', sid: 'OWN' });
    expect((await ledgerRepo.listCategories()).map((c) => c.id).sort()).toEqual(remote.map((c) => c.id).sort());
  });

  it('帳號已經有帳本、手機上也有帳：回傳要問的方案，手機資料不動', async () => {
    await addTxn('我');
    const r = await signIn(deps(fakeClient({ owned: ['OWN'] })));
    expect(r).toMatchObject({ kind: 'ask', target: 'OWN', canMerge: true, count: 1 });
    expect(await joinedSid()).toBeNull();
    expect((await ledgerRepo.listTxns())).toHaveLength(1);
  });
});
