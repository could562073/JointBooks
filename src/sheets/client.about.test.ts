import { describe, it, expect, vi } from 'vitest';
import { createSheetsClient } from './client';

function client(body: unknown) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string | URL | Request) => {
    calls.push(String(url));
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) } as Response;
  });
  return { api: createSheetsClient({ token: async () => 'TK', fetch: fetchImpl as unknown as typeof fetch }), calls };
}

describe('aboutUser', () => {
  it('只要帳號的 permissionId 與信箱', async () => {
    const c = client({ user: { permissionId: 'P1', emailAddress: 'a@gmail.com' } });
    expect(await c.api.aboutUser()).toEqual({ id: 'P1', email: 'a@gmail.com' });
    expect(c.calls[0]).toContain('/drive/v3/about?');
    expect(decodeURIComponent(c.calls[0]!)).toContain('fields=user(emailAddress,permissionId)');
  });

  it('沒有 permissionId 就當作讀不到帳號', async () => {
    const c = client({ user: { emailAddress: 'a@gmail.com' } });
    await expect(c.api.aboutUser()).rejects.toThrow('no_account');
  });
});
