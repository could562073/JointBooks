import { describe, it, expect, vi } from 'vitest';
import { createSheetsClient } from './client';

function clientWith(status: number, body?: unknown) {
  const fetch = vi.fn(async (_url: string, _init?: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('Unexpected end of JSON input');
      return body;
    },
    text: async () => '',
  }));
  const client = createSheetsClient({ token: async () => 't', fetch: fetch as unknown as typeof globalThis.fetch });
  return { client, fetch };
}

describe('試算表的共用設定', () => {
  it('列出共用對象，只要 id、類型、角色、帳號', async () => {
    const perms = [
      { id: 'O', type: 'user', role: 'owner', emailAddress: 'me@gmail.com' },
      { id: 'W', type: 'user', role: 'writer', emailAddress: 'wife@gmail.com' },
    ];
    const { client, fetch } = clientWith(200, { permissions: perms });
    expect(await client.listPermissions('SID')).toEqual(perms);
    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.pathname).toBe('/drive/v3/files/SID/permissions');
    expect(url.searchParams.get('fields')).toBe('permissions(id,type,role,emailAddress)');
  });

  it('拿掉權限用 DELETE；Google 回 204 沒有內容也不會當成錯誤', async () => {
    const { client, fetch } = clientWith(204);
    await expect(client.removePermission('SID', 'W')).resolves.toBeUndefined();
    expect(fetch.mock.calls[0]![0]).toMatch(/\/files\/SID\/permissions\/W$/);
    expect(fetch.mock.calls[0]![1]!.method).toBe('DELETE');
  });
});
