import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db, resetDb } from '../db/schema';
import { parseCallback } from './pkce';
import {
  __resetLiveToken, accessToken, completeSignIn, hasSession, signOut, startSignIn,
} from './session';

const CFG = { clientId: 'CID', redirectUri: 'https://app.example/auth/callback' };

beforeEach(async () => {
  await resetDb();
  __resetLiveToken();
});

function tokenFetch(body: unknown, status = 200) {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)) as unknown as typeof fetch;
}

describe('startSignIn', () => {
  it('把 verifier 與 state 存進 IndexedDB，不是 localStorage', async () => {
    // redirect 會整個重新載入頁面，記憶體留不住；localStorage 同源腳本都讀得到
    let url = '';
    await startSignIn(CFG, (u) => { url = u; });

    expect(await db.meta.get('auth.verifier')).toBeDefined();
    expect(await db.meta.get('auth.state')).toBeDefined();
    expect(url).toContain('code_challenge_method=S256');
  });

  it('送出的 state 與存起來的一致', async () => {
    let url = '';
    await startSignIn(CFG, (u) => { url = u; });
    const sent = new URL(url).searchParams.get('state');
    expect(sent).toBe((await db.meta.get('auth.state'))!.value);
  });

  it('每次登入都換一組新的 verifier', async () => {
    await startSignIn(CFG, () => {});
    const first = (await db.meta.get('auth.verifier'))!.value;
    await startSignIn(CFG, () => {});
    expect((await db.meta.get('auth.verifier'))!.value).not.toBe(first);
  });
});

describe('completeSignIn', () => {
  async function begin() {
    let url = '';
    await startSignIn(CFG, (u) => { url = u; });
    return new URL(url).searchParams.get('state')!;
  }

  it('成功後存下 refresh token', async () => {
    const state = await begin();
    const f = tokenFetch({ access_token: 'AT', expires_in: 3600, refresh_token: 'RT' });

    await expect(completeSignIn(CFG, `?code=C&state=${state}`, { fetch: f }))
      .resolves.toEqual({ kind: 'signed-in' });
    expect((await db.meta.get('auth.refreshToken'))!.value).toBe('RT');
  });

  it('用完就把 verifier 與 state 刪掉', async () => {
    const state = await begin();
    const f = tokenFetch({ access_token: 'AT', expires_in: 3600, refresh_token: 'RT' });
    await completeSignIn(CFG, `?code=C&state=${state}`, { fetch: f });

    expect(await db.meta.get('auth.verifier')).toBeUndefined();
    expect(await db.meta.get('auth.state')).toBeUndefined();
  });

  it('state 不符時拒絕，也不會拿去換 token（CSRF）', async () => {
    await begin();
    const f = tokenFetch({ access_token: 'AT', expires_in: 3600 });

    await expect(completeSignIn(CFG, '?code=C&state=WRONG', { fetch: f }))
      .resolves.toEqual({ kind: 'error', error: 'state_mismatch' });
    expect(f).not.toHaveBeenCalled();
  });

  it('使用者按拒絕時回報那個錯誤', async () => {
    await begin();
    await expect(completeSignIn(CFG, '?error=access_denied'))
      .resolves.toEqual({ kind: 'error', error: 'access_denied' });
  });

  it('換 token 失敗時不會標成已登入', async () => {
    const state = await begin();
    const f = tokenFetch({}, 400);
    const r = await completeSignIn(CFG, `?code=C&state=${state}`, { fetch: f });
    expect(r.kind).toBe('error');
    expect(await hasSession()).toBe(false);
  });
});

describe('accessToken', () => {
  async function signedIn() {
    let url = '';
    await startSignIn(CFG, (u) => { url = u; });
    const state = new URL(url).searchParams.get('state')!;
    await completeSignIn(CFG, `?code=C&state=${state}`, {
      fetch: tokenFetch({ access_token: 'AT', expires_in: 3600, refresh_token: 'RT' }),
    });
  }

  it('還沒過期就直接用記憶體裡那顆，不打網路', async () => {
    await signedIn();
    const f = tokenFetch({ access_token: 'NEW', expires_in: 3600 });
    await expect(accessToken(CFG, { fetch: f })).resolves.toBe('AT');
    expect(f).not.toHaveBeenCalled();
  });

  it('快過期時自動續期', async () => {
    await signedIn();
    const f = tokenFetch({ access_token: 'AT2', expires_in: 3600 });
    // 往後跳一小時，讓原本的 token 落入續期窗
    await expect(accessToken(CFG, { fetch: f, now: Date.now() + 3_600_000 }))
      .resolves.toBe('AT2');
  });

  it('續期回應沒有新的 refresh token 時保留舊的', async () => {
    await signedIn();
    await accessToken(CFG, {
      fetch: tokenFetch({ access_token: 'AT2', expires_in: 3600 }),
      now: Date.now() + 3_600_000,
    });
    expect((await db.meta.get('auth.refreshToken'))!.value).toBe('RT');
  });

  it('沒有 session 時丟出來，讓呼叫端導回登入頁', async () => {
    await expect(accessToken(CFG)).rejects.toThrow('not_signed_in');
  });
});

describe('signOut', () => {
  it('清掉 refresh token', async () => {
    await db.meta.put({ key: 'auth.refreshToken', value: 'RT' });
    expect(await hasSession()).toBe(true);
    await signOut();
    expect(await hasSession()).toBe(false);
  });
});

describe('parseCallback 與 session 的一致性', () => {
  it('session 用的就是同一個解析器，不會有第二套 state 檢查', () => {
    expect(parseCallback('?code=c&state=s', 's')).toMatchObject({ kind: 'code' });
  });
});
