import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_MEMBERS, type Members } from '../domain/members';
import type { SheetsClient } from '../sheets/client';
import { REV_RANGE } from '../sheets/ledgerSheet';
import { MEMBERS_RANGE, MEMBERS_READ_RANGE, membersToRows } from '../sheets/memberRows';
import { createSyncController } from './controller';
import type { MembersSync } from './members';

const CUSTOM: Members = { 我: { name: 'Rex', color: 'blue' }, 妻: { name: '小雪', color: 'mint' } };

/** 試算表只模擬版本戳記與成員那兩列；紀錄頁一直是空的 */
function setup(opts: { remote?: Members; rev?: string; local?: Members; dirty?: boolean } = {}) {
  const sheet = {
    rev: opts.rev ?? '',
    members: opts.remote ? membersToRows(opts.remote).slice(1) : ([] as string[][]),
  };
  const get = vi.fn(async (_s: string, range: string) => {
    if (range === REV_RANGE) return sheet.rev ? [[sheet.rev]] : [];
    if (range === MEMBERS_READ_RANGE) return sheet.members.map((r) => [...r]);
    return [];
  });
  const update = vi.fn(async (_s: string, range: string, rows: string[][]) => {
    if (range === REV_RANGE) sheet.rev = rows[0]![0]!;
    if (range === MEMBERS_RANGE) sheet.members = rows.slice(1);
  });
  const client = {
    get, update, append: vi.fn(async () => ({ updates: { updatedRange: 'x' } })),
  } as unknown as SheetsClient;

  const store = { local: opts.local ?? DEFAULT_MEMBERS, dirty: opts.dirty ?? false };
  const members: MembersSync = {
    dirty: async () => store.dirty,
    local: async () => store.local,
    markPushed: async () => { store.dirty = false; },
    save: async (m) => { store.local = m; },
  };

  let clock = 1_000;
  const ctl = createSyncController({
    client,
    tokens: { isConnected: () => true },
    spreadsheetId: () => 'S',
    localTxns: async () => [],
    saveTxns: async () => {},
    members,
    onPulled: vi.fn(), onState: () => {}, onSynced: vi.fn(),
    isOnline: () => true,
    isVisible: () => true,
    now: () => (clock += 1),
  });
  const memberReads = () => get.mock.calls.filter((c) => c[1] === MEMBERS_READ_RANGE).length;
  return { ctl, sheet, store, update, memberReads };
}

describe('同步控制器：成員名稱與饅頭顏色', () => {
  it('本機改了：推到配置頁 N–P、改版本戳記通知對方、清掉待推標記', async () => {
    const t = setup({ local: CUSTOM, dirty: true });
    await t.ctl.syncNow();
    expect(t.update).toHaveBeenCalledWith('S', MEMBERS_RANGE, membersToRows(CUSTOM));
    expect(t.sheet.rev).not.toBe('');
    expect(t.store.dirty).toBe(false);
  });

  it('對方改過（雲端有資料、版本戳記變了）：拉回來存到本機', async () => {
    const t = setup({ remote: CUSTOM, rev: '5' });
    await t.ctl.syncNow();
    expect(t.store.local).toEqual(CUSTOM);
  });

  it('雲端還沒有人設定過：保留本機的', async () => {
    const t = setup({ local: CUSTOM });
    await t.ctl.syncNow();
    expect(t.store.local).toEqual(CUSTOM);
  });

  it('版本戳記沒變就不再讀成員那兩列（省配額）', async () => {
    const t = setup({ remote: CUSTOM, rev: '5' });
    await t.ctl.syncNow();
    const reads = t.memberReads();
    await t.ctl.syncNow();
    expect(t.memberReads()).toBe(reads);
  });

  it('本機有待推的修改時，不拿雲端的蓋過（最後寫入的贏）', async () => {
    const t = setup({ remote: DEFAULT_MEMBERS, rev: '5', local: CUSTOM, dirty: true });
    await t.ctl.syncNow();
    expect(t.store.local).toEqual(CUSTOM);
    expect(t.sheet.members).toEqual(membersToRows(CUSTOM).slice(1));
  });
});
