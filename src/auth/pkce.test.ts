import { describe, it, expect } from 'vitest';
import {
  AUTH_ENDPOINT, base64url, buildAuthUrl, challengeOf, parseCallback,
  randomState, randomVerifier, SCOPES, VERIFIER_LEN,
} from './pkce';

describe('base64url', () => {
  it('不留 padding，也不留 + 與 /', () => {
    // 0xFB 0xFF 在標準 base64 會產生 + 與 /
    const s = base64url(new Uint8Array([0xfb, 0xff, 0xfe]));
    expect(s).not.toMatch(/[+/=]/);
  });

  it('空陣列給空字串', () => {
    expect(base64url(new Uint8Array([]))).toBe('');
  });

  it('全 0xFF 的輸入也只產出 base64url 字元', () => {
    const s = base64url(new Uint8Array(32).fill(0xff));
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('randomVerifier', () => {
  it('長度落在 RFC 7636 的 43–128 之間', () => {
    const v = randomVerifier();
    expect(v.length).toBe(VERIFIER_LEN);
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
  });

  it('只用 unreserved 字元', () => {
    expect(randomVerifier()).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('每次都不一樣', () => {
    const seen = new Set(Array.from({ length: 50 }, () => randomVerifier()));
    expect(seen.size).toBe(50);
  });
});

describe('randomState', () => {
  it('每次都不一樣且是 base64url', () => {
    const a = randomState();
    const b = randomState();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('challengeOf', () => {
  it('RFC 7636 附錄 B 的官方測試向量', async () => {
    // verifier 與期望的 challenge 直接取自 RFC
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    await expect(challengeOf(verifier))
      .resolves.toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('同一個 verifier 永遠算出同一個 challenge', async () => {
    const v = randomVerifier();
    expect(await challengeOf(v)).toBe(await challengeOf(v));
  });

  it('不同 verifier 算出不同 challenge', async () => {
    expect(await challengeOf('aaa')).not.toBe(await challengeOf('aab'));
  });

  it('結果是 base64url，不含 + / =', async () => {
    expect(await challengeOf(randomVerifier())).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('SCOPES', () => {
  it('只要 drive.file，不要整個雲端硬碟', () => {
    expect(SCOPES).toContain('https://www.googleapis.com/auth/drive.file');
    expect(SCOPES.join(' ')).not.toMatch(/auth\/drive(\s|$)/);
    expect(SCOPES.join(' ')).not.toContain('drive.readonly');
  });
});

describe('buildAuthUrl', () => {
  const ARGS = {
    clientId: 'cid.apps.googleusercontent.com',
    redirectUri: 'https://app.example/auth/callback',
    challenge: 'CHAL',
    state: 'STATE',
    scopes: SCOPES,
  };

  it('指向 Google 的授權端點', () => {
    expect(buildAuthUrl(ARGS).startsWith(`${AUTH_ENDPOINT}?`)).toBe(true);
  });

  it('帶齊 PKCE 參數，method 是 S256', () => {
    const q = new URL(buildAuthUrl(ARGS)).searchParams;
    expect(q.get('response_type')).toBe('code');
    expect(q.get('code_challenge')).toBe('CHAL');
    expect(q.get('code_challenge_method')).toBe('S256');
    expect(q.get('state')).toBe('STATE');
  });

  it('要 offline + consent，否則拿不到 refresh token', () => {
    const q = new URL(buildAuthUrl(ARGS)).searchParams;
    expect(q.get('access_type')).toBe('offline');
    expect(q.get('prompt')).toBe('consent');
  });

  it('redirect_uri 原樣帶過去', () => {
    const q = new URL(buildAuthUrl(ARGS)).searchParams;
    expect(q.get('redirect_uri')).toBe(ARGS.redirectUri);
  });
});

describe('parseCallback', () => {
  it('正常回呼取出 code', () => {
    expect(parseCallback('?code=abc&state=S', 'S')).toEqual({ kind: 'code', code: 'abc', state: 'S' });
  });

  it('前面有沒有 ? 都能解析', () => {
    expect(parseCallback('code=abc&state=S', 'S')).toMatchObject({ kind: 'code' });
  });

  it('使用者按拒絕時回報錯誤', () => {
    expect(parseCallback('?error=access_denied', 'S')).toEqual({ kind: 'error', error: 'access_denied' });
  });

  it('state 不符一律當錯誤（CSRF）', () => {
    expect(parseCallback('?code=abc&state=X', 'S')).toEqual({ kind: 'error', error: 'state_mismatch' });
  });

  it('本地沒有存 state 時也當錯誤，不能放行', () => {
    expect(parseCallback('?code=abc&state=S', null)).toEqual({ kind: 'error', error: 'state_mismatch' });
  });

  it('完全沒有參數時是 none，不是錯誤', () => {
    expect(parseCallback('', 'S')).toEqual({ kind: 'none' });
    expect(parseCallback('?foo=1', 'S')).toEqual({ kind: 'none' });
  });
});
