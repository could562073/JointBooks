import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../db/schema';
import type { Category, Person } from '../domain/types';
import { ledgerRepo } from '../repo/ledgerRepo';
import { SheetsError, type SheetsClient } from '../sheets/client';
import { CATEGORIES_RANGE, ENV_RANGE } from '../sheets/ledgerSheet';
import { categoryToRows } from '../sheets/rows';
import { resolveAsk, type AskPlan } from './account';
import { lastAccount } from './accountState';
import { CATEGORIES_DIRTY_KEY } from './categoriesSync';
import { joinedSid, SELF_KEY } from './ledgerId';
import { MEMBERS_DIRTY_KEY } from './members';

const A = { id: 'PA', email: 'a@gmail.com' };
const plan = (over: Partial<AskPlan> = {}): AskPlan => ({
  kind: 'ask', from: null, to: A.email, target: 'OWN', self: '我', count: 1, canMerge: true, account: A, ...over,
});

function client(remote: Category[], forbidden = false) {
  return {
    get: vi.fn(async (_sid: string, range: string) => {
      if (forbidden) throw new SheetsError(403, '');
      if (range === ENV_RANGE) return [['dev']];
      if (range === CATEGORIES_RANGE) return remote.flatMap(categoryToRows);
      return [];
    }),
    createSpreadsheet: vi.fn(async () => 'NEW'),
    update: vi.fn(async () => ({})),
  } as unknown as SheetsClient;
}
const deps = (c: SheetsClient) => ({ client: c, tokens: { disconnect: vi.fn(async () => {}) }, env: 'dev' as const, now: () => 5_000 });

/** 雲端那本：一個「外食」，id 跟手機上的不同 */
const REMOTE: Category[] = [{
  id: 'R-FOOD', kind: 'expense', name: '外食', icon: 'bus', budgetCents: null,
  subs: [{ id: 'R-LUNCH', name: '午餐' }], colorSet: 0, order: 0, active: true, updatedAt: 1,
}];

async function seedLocal(by: Person) {
  await ledgerRepo.replaceCategories([{ ...REMOTE[0]!, id: 'L-FOOD', subs: [{ id: 'L-LUNCH', name: '午餐' }] }]);
  await ledgerRepo.addTxn({
    date: '2026-09-18', mainId: 'L-FOOD', subId: 'L-LUNCH',
    amountCents: 100, currency: 'CAD', actualCadCents: 100, by, note: '',
  });
}

beforeEach(async () => { await resetDb(); });

describe('resolveAsk', () => {
  it('取消：斷開 Google，什麼都不寫', async () => {
    await seedLocal('我');
    const d = deps(client(REMOTE));
    expect(await resolveAsk(plan(), 'cancel', d)).toEqual({ kind: 'cancelled' });
    expect(d.tokens.disconnect).toHaveBeenCalled();
    expect(await joinedSid()).toBeNull();
    expect(await lastAccount()).toBeNull();
  });

  it('合併進既有帳本：帳改指向雲端分類、算成自己的身分；分類要推、成員名稱以雲端為準', async () => {
    await seedLocal('我');
    await ledgerRepo.setMeta(MEMBERS_DIRTY_KEY, true);
    expect(await resolveAsk(plan(), 'merge', deps(client(REMOTE)))).toEqual({ kind: 'linked', sid: 'OWN' });
    const [t] = await ledgerRepo.listTxns();
    expect(t).toMatchObject({ mainId: 'R-FOOD', subId: 'R-LUNCH', by: '我' });
    expect((await ledgerRepo.listCategories()).map((c) => c.id)).toEqual(['R-FOOD']);
    expect(await ledgerRepo.getMeta(CATEGORIES_DIRTY_KEY)).toBe(true);
    expect(await ledgerRepo.getMeta(MEMBERS_DIRTY_KEY)).toBe(false);
    expect(await joinedSid()).toBe('OWN');
  });

  it('訪客加入邀請選合併：手機上的帳都算加入者（妻）', async () => {
    await seedLocal('我');
    await resolveAsk(plan({ target: 'INV', self: '妻' }), 'merge', deps(client(REMOTE)));
    expect((await ledgerRepo.listTxns())[0]!.by).toBe('妻');
    expect(await ledgerRepo.getMeta(SELF_KEY)).toBe('妻');
  });

  it('改用雲端：清掉手機上的帳、換成雲端的分類', async () => {
    await seedLocal('我');
    await resolveAsk(plan(), 'cloud', deps(client(REMOTE)));
    expect(await ledgerRepo.listTxns()).toHaveLength(0);
    expect((await ledgerRepo.listCategories()).map((c) => c.id)).toEqual(['R-FOOD']);
    expect(await joinedSid()).toBe('OWN');
  });

  it('目標是 null：合併就用手機上的帳開新帳本；改用雲端就開一本空的', async () => {
    await seedLocal('我');
    expect(await resolveAsk(plan({ target: null }), 'merge', deps(client([])))).toEqual({ kind: 'linked', sid: 'NEW' });
    expect(await ledgerRepo.listTxns()).toHaveLength(1);

    await resetDb();
    await seedLocal('我');
    await resolveAsk(plan({ target: null }), 'cloud', deps(client([])));
    expect(await ledgerRepo.listTxns()).toHaveLength(0);
  });

  it('讀不到目標帳本：丟出給人看的錯誤，手機資料不動', async () => {
    await seedLocal('我');
    await expect(resolveAsk(plan(), 'cloud', deps(client(REMOTE, true)))).rejects.toThrow('還讀不到這本帳');
    expect(await ledgerRepo.listTxns()).toHaveLength(1);
    expect(await joinedSid()).toBeNull();
  });

  it('不能合併的方案選了合併：擋下來', async () => {
    await seedLocal('我');
    await expect(resolveAsk(plan({ canMerge: false }), 'merge', deps(client(REMOTE)))).rejects.toThrow('不能合併');
  });
});
