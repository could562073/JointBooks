import { describe, it, expect, vi } from 'vitest';
import { NeedsConnectError, type TokenProvider } from '../auth/gis';
import { defaultCategories } from '../domain/categories';
import type { SheetsClient } from '../sheets/client';
import { ENV_RANGE } from '../sheets/ledgerSheet';
import { categoryToRows } from '../sheets/rows';
import { connectErrorText, createCloud, ensureLedger, type EnsureLedgerDeps } from './cloud';

function fakeLedgerClient(
  found: { id: string; ownedByMe: boolean }[] = [],
  remote: { env?: string; rows?: string[][] } = {}
) {
  return {
    createSpreadsheet: vi.fn(async () => 'NEW-SID'),
    update: vi.fn(async () => ({})),
    findLedgers: vi.fn(async (_title: string) => found),
    get: vi.fn(async (_s: string, range: string) =>
      range === ENV_RANGE ? (remote.env ? [[remote.env]] : []) : (remote.rows ?? [])),
  } as unknown as SheetsClient & { findLedgers: ReturnType<typeof vi.fn> };
}

function deps(over: Partial<EnsureLedgerDeps> = {}) {
  return {
    joinedSid: async () => null,
    setJoinedSid: vi.fn(async (_sid: string) => {}),
    categories: async () => [],
    replaceCategories: vi.fn(async () => {}),
    year: 2026,
    env: 'dev' as const,
    ...over,
  };
}

describe('ensureLedger', () => {
  it('這台已經記著帳本就沿用，連雲端都不用找', async () => {
    const client = fakeLedgerClient();
    expect(await ensureLedger(client, deps({ joinedSid: async () => 'EXISTING', env: 'prod' }))).toBe('EXISTING');
    expect(client.findLedgers).not.toHaveBeenCalled();
    expect(client.createSpreadsheet).not.toHaveBeenCalled();
  });

  it('換了手機：找到自己之前用這個 App 建的帳本就接回去、換成那本的分類，不再建一本', async () => {
    let n = 0;
    const old = defaultCategories(() => `old-${n++}`);
    const client = fakeLedgerClient([{ id: 'MINE', ownedByMe: true }], { env: 'dev', rows: old.flatMap(categoryToRows) });
    const d = deps();
    expect(await ensureLedger(client, d)).toBe('MINE');
    // 連改名前的名稱一起找
    expect(client.findLedgers).toHaveBeenCalledWith(['饅頭記帳（開發）', '饅頭共享記帳（開發）', '加拿大共用記帳（開發）', '加拿大共用記帳']);
    expect(client.createSpreadsheet).not.toHaveBeenCalled();
    expect(d.setJoinedSid).toHaveBeenCalledWith('MINE');
    expect(d.replaceCategories).toHaveBeenCalled();
  });

  it('找到的同名帳本屬於另一個環境就跳過，接回下一本符合的', async () => {
    const client = {
      createSpreadsheet: vi.fn(async () => 'NEW-SID'),
      update: vi.fn(async () => ({})),
      findLedgers: vi.fn(async () => [{ id: 'PROD-ONE', ownedByMe: true }, { id: 'DEV-ONE', ownedByMe: true }]),
      get: vi.fn(async (sid: string, range: string) =>
        (range === ENV_RANGE ? [[sid === 'PROD-ONE' ? 'prod' : 'dev']] : [])),
    } as unknown as SheetsClient;
    const d = deps();
    expect(await ensureLedger(client, d)).toBe('DEV-ONE');
    expect(client.createSpreadsheet).not.toHaveBeenCalled();
    expect(d.setJoinedSid).toHaveBeenCalledWith('DEV-ONE');
  });

  it('只找到別人分享給我的帳本：不自動加入（使用者選了自己建），照樣建一本自己的', async () => {
    const client = fakeLedgerClient([{ id: 'THEIRS', ownedByMe: false }]);
    const d = deps();
    expect(await ensureLedger(client, d)).toBe('NEW-SID');
    expect(d.setJoinedSid).toHaveBeenCalledWith('NEW-SID');
  });

  it('什麼都沒找到：建一本、寫入分類，並記下它的 id', async () => {
    let n = 0;
    const cats = defaultCategories(() => `c-${n++}`);
    const client = fakeLedgerClient();
    const d = deps({ categories: async () => cats });
    expect(await ensureLedger(client, d)).toBe('NEW-SID');
    expect(client.createSpreadsheet).toHaveBeenCalledTimes(1);
    expect(client.createSpreadsheet).toHaveBeenCalledWith('饅頭記帳（開發）', expect.anything());
    expect(d.setJoinedSid).toHaveBeenCalledWith('NEW-SID');
  });
});

describe('createCloud', () => {
  it('試算表客戶端向 token 提供者要 token；還沒連線時直接丟 NeedsConnectError，不打網路', async () => {
    const tokens = { token: vi.fn(async () => { throw new NeedsConnectError(); }) } as unknown as TokenProvider;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const cloud = createCloud('cid', 'dev', tokens);
    await expect(cloud.client.get('S', 'A1')).rejects.toBeInstanceOf(NeedsConnectError);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('connectErrorText', () => {
  it('把 Google 的錯誤代碼翻成白話', () => {
    expect(connectErrorText(new Error('popup_failed_to_open'))).toContain('彈出視窗');
    expect(connectErrorText(new Error('scopes_not_granted'))).toContain('勾選所有權限');
    expect(connectErrorText(new Error('no_refresh_token'))).toContain('與第三方應用程式和服務的連結');
    expect(connectErrorText(new Error('weird'))).toBe('連線失敗：weird');
  });
});
