import { describe, it, expect, vi } from 'vitest';
import { createSheetsClient, SheetsError } from './client';

/** 依序回傳預先排好的回應 */
function fakeFetch(responses: { status: number; body?: unknown }[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  let i = 0;
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const r = responses[Math.min(i++, responses.length - 1)]!;
    return {
      ok: r.status >= 200 && r.status < 300,
      status: r.status,
      json: async () => r.body ?? {},
      text: async () => JSON.stringify(r.body ?? {}),
    } as Response;
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

function client(responses: { status: number; body?: unknown }[]) {
  const f = fakeFetch(responses);
  const sleep = vi.fn(async () => {});
  return {
    api: createSheetsClient({ token: async () => 'TK', fetch: f.fn, sleep }),
    calls: f.calls,
    sleep,
  };
}

describe('SheetsClient 的請求', () => {
  it('帶上 Bearer token', async () => {
    const c = client([{ status: 200, body: { values: [] } }]);
    await c.api.get('SID', 'A1:N');
    expect((c.calls[0]!.init.headers as Record<string, string>).Authorization).toBe('Bearer TK');
  });

  it('append 用 RAW + INSERT_ROWS（§14.5）', async () => {
    const c = client([{ status: 200, body: { updates: { updatedRange: 'x' } } }]);
    await c.api.append('SID', '紀錄!A:N', [['a']]);
    expect(c.calls[0]!.url).toContain('valueInputOption=RAW');
    expect(c.calls[0]!.url).toContain('insertDataOption=INSERT_ROWS');
    expect(c.calls[0]!.url).toContain(':append');
  });

  it('get 沒有資料時回空陣列，不是 undefined', async () => {
    const c = client([{ status: 200, body: {} }]);
    await expect(c.api.get('SID', 'A1:N')).resolves.toEqual([]);
  });

  it('分享用 writer + user（§8.1-7）', async () => {
    const c = client([{ status: 200, body: {} }]);
    await c.api.shareWith('SID', 'her@example.com');
    const body = JSON.parse(String(c.calls[0]!.init.body));
    expect(body).toEqual({ role: 'writer', type: 'user', emailAddress: 'her@example.com' });
  });
});

describe('SheetsClient 的重試（§14.5）', () => {
  it('429 會重試並在成功後回傳結果', async () => {
    const c = client([
      { status: 429 },
      { status: 200, body: { values: [['ok']] } },
    ]);
    await expect(c.api.get('SID', 'A1:N')).resolves.toEqual([['ok']]);
    expect(c.calls).toHaveLength(2);
    expect(c.sleep).toHaveBeenCalledTimes(1);
  });

  it('5xx 會重試', async () => {
    const c = client([{ status: 503 }, { status: 500 }, { status: 200, body: { values: [] } }]);
    await c.api.get('SID', 'A1:N');
    expect(c.calls).toHaveLength(3);
  });

  it('最多 5 次，超過就丟出來', async () => {
    const c = client([{ status: 500 }]);
    await expect(c.api.get('SID', 'A1:N')).rejects.toBeInstanceOf(SheetsError);
    // 第一次 + 5 次重試
    expect(c.calls).toHaveLength(6);
  });

  it('401 不重試——那要走 token 續期，不是重打', async () => {
    const c = client([{ status: 401 }]);
    await expect(c.api.get('SID', 'A1:N')).rejects.toMatchObject({ status: 401 });
    expect(c.calls).toHaveLength(1);
    expect(c.sleep).not.toHaveBeenCalled();
  });

  it('403 不重試，免得把配額燒光', async () => {
    const c = client([{ status: 403 }]);
    await expect(c.api.get('SID', 'A1:N')).rejects.toMatchObject({ status: 403 });
    expect(c.calls).toHaveLength(1);
  });

  it('每次重試都重新取 token，續期過的才不會再被擋', async () => {
    const tokens = ['old', 'new'];
    let i = 0;
    const f = fakeFetch([{ status: 429 }, { status: 200, body: { values: [] } }]);
    const api = createSheetsClient({
      token: async () => tokens[Math.min(i++, 1)]!,
      fetch: f.fn,
      sleep: async () => {},
    });
    await api.get('SID', 'A1:N');
    expect((f.calls[1]!.init.headers as Record<string, string>).Authorization).toBe('Bearer new');
  });
});

describe('createSpreadsheet', () => {
  it('帶上四張工作表的標題並回傳 id（§14.3）', async () => {
    const c = client([{ status: 200, body: { spreadsheetId: 'SID-1' } }]);
    const id = await c.api.createSpreadsheet('饅頭記帳', ['紀錄', '配置', '年報表', '圖表']);

    expect(id).toBe('SID-1');
    const body = JSON.parse(String(c.calls[0]!.init.body));
    expect(body.properties.title).toBe('饅頭記帳');
    expect(body.sheets.map((s: { properties: { title: string } }) => s.properties.title))
      .toEqual(['紀錄', '配置', '年報表', '圖表']);
  });
});
