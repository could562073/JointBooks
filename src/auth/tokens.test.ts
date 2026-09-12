import { describe, it, expect, vi } from 'vitest';
import {
  exchangeCode, expiryFrom, refreshTokens, REFRESH_MARGIN_MS, shouldRefresh, TOKEN_ENDPOINT,
} from './tokens';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; body: string }[] = [];
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: String(init?.body ?? '') });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

describe('shouldRefresh', () => {
  const now = 1_000_000;

  it('還很久就不用續', () => {
    expect(shouldRefresh(now + 60 * 60 * 1000, now)).toBe(false);
  });

  it('剩不到 5 分鐘就要續', () => {
    expect(shouldRefresh(now + REFRESH_MARGIN_MS - 1, now)).toBe(true);
  });

  it('剛好 5 分鐘也要續（避開檢查與送出之間的空窗）', () => {
    expect(shouldRefresh(now + REFRESH_MARGIN_MS, now)).toBe(true);
  });

  it('已經過期當然要續', () => {
    expect(shouldRefresh(now - 1, now)).toBe(true);
  });
});

describe('expiryFrom', () => {
  it('把 expires_in 秒換成絕對時間', () => {
    expect(expiryFrom(3600, 1_000)).toBe(1_000 + 3_600_000);
  });
});

describe('exchangeCode', () => {
  it('打 Google 的 token 端點，帶 verifier 而不是 client_secret', async () => {
    const f = fakeFetch(200, { access_token: 'AT', expires_in: 3600, refresh_token: 'RT' });
    await exchangeCode({
      code: 'C', verifier: 'V', clientId: 'CID', redirectUri: 'R', fetch: f.fn, now: 0,
    });

    expect(f.calls[0]!.url).toBe(TOKEN_ENDPOINT);
    const q = new URLSearchParams(f.calls[0]!.body);
    expect(q.get('code_verifier')).toBe('V');
    expect(q.get('grant_type')).toBe('authorization_code');
    expect(q.get('client_secret')).toBeNull();
  });

  it('回傳 access token、絕對過期時間與 refresh token', async () => {
    const f = fakeFetch(200, { access_token: 'AT', expires_in: 3600, refresh_token: 'RT' });
    await expect(exchangeCode({
      code: 'C', verifier: 'V', clientId: 'CID', redirectUri: 'R', fetch: f.fn, now: 0,
    })).resolves.toEqual({ accessToken: 'AT', expiresAt: 3_600_000, refreshToken: 'RT' });
  });

  it('失敗時丟出錯誤', async () => {
    const f = fakeFetch(400, {});
    await expect(exchangeCode({
      code: 'C', verifier: 'V', clientId: 'CID', redirectUri: 'R', fetch: f.fn,
    })).rejects.toThrow(/400/);
  });
});

describe('refreshTokens', () => {
  it('用 refresh_token grant', async () => {
    const f = fakeFetch(200, { access_token: 'AT2', expires_in: 3600 });
    await refreshTokens({ refreshToken: 'RT', clientId: 'CID', fetch: f.fn, now: 0 });

    const q = new URLSearchParams(f.calls[0]!.body);
    expect(q.get('grant_type')).toBe('refresh_token');
    expect(q.get('refresh_token')).toBe('RT');
  });

  it('回應沒有新的 refresh token 時回 null，由呼叫端保留舊的', async () => {
    // 寫回 null 會讓使用者下次開 App 就得重新登入
    const f = fakeFetch(200, { access_token: 'AT2', expires_in: 3600 });
    const t = await refreshTokens({ refreshToken: 'RT', clientId: 'CID', fetch: f.fn, now: 0 });
    expect(t.refreshToken).toBeNull();
    expect(t.accessToken).toBe('AT2');
  });

  it('有給新的就用新的', async () => {
    const f = fakeFetch(200, { access_token: 'AT2', expires_in: 3600, refresh_token: 'RT2' });
    const t = await refreshTokens({ refreshToken: 'RT', clientId: 'CID', fetch: f.fn, now: 0 });
    expect(t.refreshToken).toBe('RT2');
  });
});
