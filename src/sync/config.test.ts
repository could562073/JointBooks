import { describe, it, expect } from 'vitest';
import { isConfigured, readConfig } from './config';

describe('readConfig', () => {
  it('讀得到 client id', () => {
    const c = readConfig({ VITE_GOOGLE_CLIENT_ID: 'cid' }, 'https://app.example');
    expect(c.clientId).toBe('cid');
  });

  it('redirect_uri 接在 origin 後面', () => {
    expect(readConfig({}, 'https://app.example').redirectUri)
      .toBe('https://app.example/auth/callback');
  });

  it('沒設定時是 null，不是空字串——空字串送出去會變成一個合法但錯的請求', () => {
    expect(readConfig({}, 'https://x').clientId).toBeNull();
    expect(readConfig({ VITE_GOOGLE_CLIENT_ID: '   ' }, 'https://x').clientId).toBeNull();
  });
});

describe('isConfigured', () => {
  it('沒有 client id 就是未設定，App 以本機模式運作', () => {
    expect(isConfigured(readConfig({}, 'https://x'))).toBe(false);
    expect(isConfigured(readConfig({ VITE_GOOGLE_CLIENT_ID: 'cid' }, 'https://x'))).toBe(true);
  });
});
