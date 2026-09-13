import { describe, it, expect, vi } from 'vitest';
import { NeedsConnectError, type TokenProvider } from '../auth/gis';
import { defaultCategories } from '../domain/categories';
import type { SheetsClient } from '../sheets/client';
import { connectErrorText, createCloud, ensureLedger } from './cloud';

function fakeLedgerClient() {
  return {
    createSpreadsheet: vi.fn(async () => 'NEW-SID'),
    update: vi.fn(async () => ({})),
  } as unknown as SheetsClient;
}

describe('ensureLedger', () => {
  it('已經有帳本就沿用，不在硬碟再建一本', async () => {
    const client = fakeLedgerClient();
    const setJoinedSid = vi.fn(async () => {});
    const id = await ensureLedger(client, {
      joinedSid: async () => 'EXISTING', setJoinedSid, categories: async () => [], year: 2026, env: 'prod',
    });
    expect(id).toBe('EXISTING');
    expect(client.createSpreadsheet).not.toHaveBeenCalled();
    expect(setJoinedSid).not.toHaveBeenCalled();
  });

  it('還沒有帳本：建一本、寫入分類，並記下它的 id', async () => {
    const client = fakeLedgerClient();
    const setJoinedSid = vi.fn(async () => {});
    let n = 0;
    const cats = defaultCategories(() => `c-${n++}`);
    const id = await ensureLedger(client, {
      joinedSid: async () => null, setJoinedSid, categories: async () => cats, year: 2026, env: 'dev',
    });
    expect(id).toBe('NEW-SID');
    expect(client.createSpreadsheet).toHaveBeenCalledTimes(1);
    expect(client.createSpreadsheet).toHaveBeenCalledWith('加拿大共用記帳（開發）', expect.anything());
    expect(setJoinedSid).toHaveBeenCalledWith('NEW-SID');
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
    expect(connectErrorText(new Error('weird'))).toBe('連線失敗：weird');
  });
});
