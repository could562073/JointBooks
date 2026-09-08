import { describe, it, expect, vi } from 'vitest';
import { newId } from './uuid';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('newId（Minor 10）', () => {
  it('crypto.randomUUID 可用時直接採用', () => {
    expect(newId()).toMatch(UUID_RE);
  });

  it('crypto.randomUUID 在非安全情境（非 HTTPS）拋錯時改用備援，不向上拋出', () => {
    const spy = vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new DOMException('crypto.randomUUID requires a secure context', 'NotSupportedError');
    });
    try {
      expect(newId()).toMatch(UUID_RE);
    } finally {
      spy.mockRestore();
    }
  });

  it('每次呼叫都不重複', () => {
    const ids = new Set(Array.from({ length: 200 }, () => newId()));
    expect(ids.size).toBe(200);
  });
});
