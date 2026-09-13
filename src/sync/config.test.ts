import { describe, it, expect } from 'vitest';
import { isConfigured, readConfig } from './config';

describe('readConfig', () => {
  it('讀得到 client id', () => {
    expect(readConfig({ VITE_GOOGLE_CLIENT_ID: 'cid' }).clientId).toBe('cid');
  });

  it('沒設定時是 null，不是空字串——空字串送出去會變成一個合法但錯的請求', () => {
    expect(readConfig({}).clientId).toBeNull();
    expect(readConfig({ VITE_GOOGLE_CLIENT_ID: '   ' }).clientId).toBeNull();
  });
});

describe('isConfigured', () => {
  it('沒有 client id 就是未設定，App 以本機模式運作', () => {
    expect(isConfigured(readConfig({}))).toBe(false);
    expect(isConfigured(readConfig({ VITE_GOOGLE_CLIENT_ID: 'cid' }))).toBe(true);
  });
});
