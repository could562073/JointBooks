import { describe, it, expect } from 'vitest';
import {
  createTokenProvider, EXPIRY_MARGIN_MS, SCOPES, TOKEN_KEY,
  type Oauth2Api, type TokenResponse, type TokenStore,
} from './gis';

const HOUR = 3600;

function fakeApi(response: TokenResponse): Oauth2Api {
  return {
    initTokenClient: (cfg) => ({ requestAccessToken: () => cfg.callback(response) }),
    initCodeClient: () => ({ requestCode: () => {} }),
    hasGrantedAllScopes: () => true,
    revoke: (_t, done) => done(),
  };
}

function memoryStore(): TokenStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => { data.set(k, v); },
    removeItem: (k) => { data.delete(k); },
  };
}

const GRANTED = { access_token: 'tok-1', expires_in: HOUR, scope: SCOPES.join(' ') };

function provider(store: TokenStore | null, t: { now: number }, response: TokenResponse = GRANTED) {
  return createTokenProvider({
    clientId: 'cid', store, now: () => t.now, load: async () => fakeApi(response),
  });
}

describe('token 存在 localStorage（重整不必重新連線）', () => {
  it('連線後存起來；重開 App（新的 provider）直接沿用，不叫 Google 視窗', async () => {
    const store = memoryStore();
    const t = { now: 1_000_000 };
    await provider(store, t).connect();
    expect(store.data.has(TOKEN_KEY)).toBe(true);

    const reopened = provider(store, t);
    expect(reopened.isConnected()).toBe(true);
    await expect(reopened.token()).resolves.toBe('tok-1');
  });

  it('快過期的不沿用，並清掉', () => {
    const store = memoryStore();
    const t = { now: 1_000_000 };
    store.setItem(TOKEN_KEY, JSON.stringify({
      token: 'old', expiresAt: t.now + EXPIRY_MARGIN_MS - 1, scope: SCOPES.join(' '),
    }));
    expect(provider(store, t).isConnected()).toBe(false);
    expect(store.data.has(TOKEN_KEY)).toBe(false);
  });

  it('用著用著過期了：token() 要求重新連線，也清掉存著的那份', async () => {
    const store = memoryStore();
    const t = { now: 1_000_000 };
    const p = provider(store, t);
    await p.connect();
    t.now += HOUR * 1000;
    await expect(p.token()).rejects.toThrow('needs_connect');
    expect(store.data.has(TOKEN_KEY)).toBe(false);
  });

  it('權限不齊的舊 token 不沿用（例如改過權限範圍之後）', () => {
    const store = memoryStore();
    const t = { now: 1_000_000 };
    store.setItem(TOKEN_KEY, JSON.stringify({ token: 'old', expiresAt: t.now + HOUR * 1000, scope: SCOPES[0] }));
    expect(provider(store, t).isConnected()).toBe(false);
  });

  it('內容壞掉不會讓 App 掛掉，當作沒有', () => {
    const store = memoryStore();
    store.setItem(TOKEN_KEY, '{broken');
    expect(provider(store, { now: 1 }).isConnected()).toBe(false);
  });

  it('中斷連線會清掉存著的 token', async () => {
    const store = memoryStore();
    const t = { now: 1_000_000 };
    const p = provider(store, t);
    await p.connect();
    await p.disconnect();
    expect(store.data.has(TOKEN_KEY)).toBe(false);
  });

  it('存不進去（私密模式丟例外）仍然照常連線', async () => {
    const broken: TokenStore = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const p = provider(broken, { now: 1_000_000 });
    await expect(p.connect()).resolves.toBeUndefined();
    expect(p.isConnected()).toBe(true);
  });

  it('沒給 store 時只放記憶體（原本的行為）', async () => {
    const t = { now: 1_000_000 };
    await provider(null, t).connect();
    expect(provider(null, t).isConnected()).toBe(false);
  });
});
