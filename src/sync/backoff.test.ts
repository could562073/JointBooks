import { describe, it, expect } from 'vitest';
import { BASE_DELAY_MS, canRetry, delayFor, isRetryable, MAX_ATTEMPTS, MAX_DELAY_MS } from './backoff';

describe('isRetryable', () => {
  it('429 與 5xx 要重試', () => {
    expect(isRetryable(429)).toBe(true);
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(503)).toBe(true);
  });

  it('其他 4xx 不重試——重試幾次都是同樣結果，只是把配額燒光', () => {
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
    expect(isRetryable(403)).toBe(false);
    expect(isRetryable(404)).toBe(false);
  });

  it('2xx 不重試', () => {
    expect(isRetryable(200)).toBe(false);
    expect(isRetryable(204)).toBe(false);
  });
});

describe('delayFor', () => {
  it('指數成長', () => {
    const noJitter = () => 0;
    expect(delayFor(1, noJitter)).toBe(BASE_DELAY_MS);
    expect(delayFor(2, noJitter)).toBe(BASE_DELAY_MS * 2);
    expect(delayFor(3, noJitter)).toBe(BASE_DELAY_MS * 4);
  });

  it('有上限，不會等到天荒地老', () => {
    expect(delayFor(99, () => 0)).toBe(MAX_DELAY_MS);
    expect(delayFor(99, () => 1)).toBeLessThanOrEqual(MAX_DELAY_MS * 1.25);
  });

  it('加 0–25% 抖動，兩支手機同時回線才不會一直對齊著打', () => {
    const base = delayFor(3, () => 0);
    expect(delayFor(3, () => 1)).toBe(Math.round(base * 1.25));
    expect(delayFor(3, () => 0.5)).toBeGreaterThan(base);
  });

  it('永遠是正數', () => {
    for (let i = 1; i <= 10; i++) expect(delayFor(i)).toBeGreaterThan(0);
  });
});

describe('canRetry', () => {
  it('最多 5 次', () => {
    expect(MAX_ATTEMPTS).toBe(5);
    expect(canRetry(0)).toBe(true);
    expect(canRetry(4)).toBe(true);
    expect(canRetry(5)).toBe(false);
    expect(canRetry(9)).toBe(false);
  });
});
