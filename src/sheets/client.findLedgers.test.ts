import { describe, it, expect, vi } from 'vitest';
import { createSheetsClient } from './client';

function clientReturning(body: unknown) {
  const fetch = vi.fn(async (_url: string) => ({
    ok: true, status: 200, json: async () => body, text: async () => '',
  }));
  const client = createSheetsClient({ token: async () => 't', fetch: fetch as unknown as typeof globalThis.fetch });
  return { client, fetch };
}

describe('findLedgers：找這個 App 之前建過的帳本', () => {
  it('用名稱、試算表類型、沒進垃圾桶去 Drive 找，最近改過的在前', async () => {
    const { client, fetch } = clientReturning({ files: [{ id: 'A', ownedByMe: true }, { id: 'B' }] });
    const found = await client.findLedgers('加拿大共用記帳（開發）');

    expect(found).toEqual([{ id: 'A', ownedByMe: true }, { id: 'B', ownedByMe: false }]);
    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.pathname).toBe('/drive/v3/files');
    expect(url.searchParams.get('q')).toBe(
      "name = '加拿大共用記帳（開發）' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false"
    );
    expect(url.searchParams.get('orderBy')).toBe('modifiedTime desc');
  });

  it('名稱裡的單引號會跳脫，查詢不會壞掉', async () => {
    const { client, fetch } = clientReturning({});
    expect(await client.findLedgers("It's")).toEqual([]);
    expect(new URL(fetch.mock.calls[0]![0]).searchParams.get('q')).toContain("name = 'It\\'s'");
  });
});
