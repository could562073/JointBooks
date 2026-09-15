import { describe, expect, it, vi } from 'vitest';
import { handle, type Env } from './index';

const ENV: Env = {
  GOOGLE_CLIENT_ID: 'cid.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'sekret',
  ALLOWED_ORIGINS: 'https://could562073.github.io, http://localhost:5173',
};

const ORIGIN = 'https://could562073.github.io';

/** 假的 Google token 端點：依序回傳排好的回應，並記下每次送出去的表單 */
function fakeGoogle(replies: { status: number; body: unknown }[]) {
  const sent: Record<string, string>[] = [];
  const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    sent.push(Object.fromEntries(new URLSearchParams(String(init?.body ?? ''))));
    const r = replies[sent.length - 1] ?? replies[replies.length - 1]!;
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, sent };
}

function post(path: string, body: unknown, origin: string | null = ORIGIN): Request {
  return new Request(`https://auth.example.workers.dev${path}`, {
    method: 'POST',
    ...(origin ? { headers: { Origin: origin, 'Content-Type': 'application/json' } } : {}),
    body: JSON.stringify(body),
  });
}

describe('用授權碼換 token', () => {
  it('成功時只回傳 App 要的欄位，密碼不外流', async () => {
    const g = fakeGoogle([{ status: 200, body: { access_token: 'at', expires_in: 3599, refresh_token: 'rt', scope: 'a b', id_token: 'should-not-leak' } }]);
    const res = await handle(post('/auth/exchange', { code: 'the-code' }), ENV, g.fetchImpl);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ access_token: 'at', expires_in: 3599, refresh_token: 'rt', scope: 'a b' });
    expect(g.sent[0]).toMatchObject({
      code: 'the-code', grant_type: 'authorization_code',
      client_id: ENV.GOOGLE_CLIENT_ID, client_secret: ENV.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'postmessage',
    });
  });

  it('Google 說重新導向網址不符：改用頁面來源再試一次', async () => {
    const g = fakeGoogle([
      { status: 400, body: { error: 'redirect_uri_mismatch' } },
      { status: 200, body: { access_token: 'at', expires_in: 3599, refresh_token: 'rt', scope: 'a' } },
    ]);
    const res = await handle(post('/auth/exchange', { code: 'c' }), ENV, g.fetchImpl);

    expect(res.status).toBe(200);
    expect(g.sent.map((s) => s.redirect_uri)).toEqual(['postmessage', ORIGIN]);
  });

  it('其他錯誤（授權碼過期）不重試，照實回報', async () => {
    const g = fakeGoogle([{ status: 400, body: { error: 'invalid_grant', error_description: 'Bad Request' } }]);
    const res = await handle(post('/auth/exchange', { code: 'old' }), ENV, g.fetchImpl);

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' });
    expect(g.sent).toHaveLength(1);
  });

  it('Google 沒給 refresh token 時就不編一個出來', async () => {
    const g = fakeGoogle([{ status: 200, body: { access_token: 'at', expires_in: 3599, scope: 'a' } }]);
    const res = await handle(post('/auth/exchange', { code: 'c' }), ENV, g.fetchImpl);
    expect(await res.json()).toEqual({ access_token: 'at', expires_in: 3599, scope: 'a' });
  });
});

describe('用 refresh token 續期', () => {
  it('送出 refresh_token 授權類型，回傳新的通行證', async () => {
    const g = fakeGoogle([{ status: 200, body: { access_token: 'at2', expires_in: 3599, scope: 'a' } }]);
    const res = await handle(post('/auth/refresh', { refresh_token: 'rt' }), ENV, g.fetchImpl);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ access_token: 'at2', expires_in: 3599, scope: 'a' });
    expect(g.sent[0]).toMatchObject({ refresh_token: 'rt', grant_type: 'refresh_token' });
  });

  it('refresh token 被撤銷：照實回報，App 才知道要重新登入', async () => {
    const g = fakeGoogle([{ status: 400, body: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } }]);
    const res = await handle(post('/auth/refresh', { refresh_token: 'dead' }), ENV, g.fetchImpl);
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: 'invalid_grant' });
  });
});

describe('誰可以呼叫', () => {
  it('不是自己 App 的網址一律擋掉（這支端點握有密碼）', async () => {
    const g = fakeGoogle([{ status: 200, body: { access_token: 'at' } }]);
    const res = await handle(post('/auth/exchange', { code: 'c' }, 'https://evil.example'), ENV, g.fetchImpl);

    expect(res.status).toBe(403);
    expect(g.sent).toHaveLength(0);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('null');
  });

  it('允許的來源會回在 CORS 標頭上，瀏覽器才收得到回應', async () => {
    const g = fakeGoogle([{ status: 200, body: { access_token: 'at', expires_in: 1, scope: '' } }]);
    const res = await handle(post('/auth/exchange', { code: 'c' }, 'http://localhost:5173'), ENV, g.fetchImpl);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
  });

  it('預檢請求直接回 204，不打 Google', async () => {
    const g = fakeGoogle([]);
    const req = new Request('https://auth.example.workers.dev/auth/exchange', { method: 'OPTIONS', headers: { Origin: ORIGIN } });
    const res = await handle(req, ENV, g.fetchImpl);
    expect(res.status).toBe(204);
    expect(g.sent).toHaveLength(0);
  });

  it('缺少必填欄位或網址打錯：400／404，不打 Google', async () => {
    const g = fakeGoogle([]);
    expect((await handle(post('/auth/exchange', {}), ENV, g.fetchImpl)).status).toBe(400);
    expect((await handle(post('/auth/refresh', {}), ENV, g.fetchImpl)).status).toBe(400);
    expect((await handle(post('/nope', { code: 'c' }), ENV, g.fetchImpl)).status).toBe(404);
    expect(g.sent).toHaveLength(0);
  });
});
