import { describe, it, expect } from 'vitest';
import { base64url } from './base64url';

describe('base64url', () => {
  it('+ 換 -、/ 換 _，去掉 = 補位', () => {
    // 0xfb 0xff → 標準 base64 是 "+/8="
    expect(base64url(new Uint8Array([0xfb, 0xff]))).toBe('-_8');
  });

  it('空的就是空字串', () => {
    expect(base64url(new Uint8Array())).toBe('');
  });

  it('與 RFC 7636 附錄 B 的 challenge 向量一致（沿用原本 pkce 的驗證）', async () => {
    const digest = await crypto.subtle.digest(
      'SHA-256', new TextEncoder().encode('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
    );
    expect(base64url(new Uint8Array(digest))).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});
