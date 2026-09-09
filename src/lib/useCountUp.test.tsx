import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useCountUp } from './useCountUp';

function stubMatchMedia(reduce: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduce && q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe('useCountUp', () => {
  beforeEach(() => stubMatchMedia(false));

  it('從 0 起跑，第一次 render 不會直接顯示目標值', () => {
    const { result } = renderHook(() => useCountUp(50_000, 900));
    expect(result.current).toBe(0);
  });

  it('最終會停在目標值上', async () => {
    const { result } = renderHook(() => useCountUp(50_000, 30));
    await waitFor(() => expect(result.current).toBe(50_000));
  });

  it('目標值改變後會走到新的目標', async () => {
    const { result, rerender } = renderHook(({ v }) => useCountUp(v, 30), {
      initialProps: { v: 1_000 },
    });
    await waitFor(() => expect(result.current).toBe(1_000));
    rerender({ v: 4_000 });
    await waitFor(() => expect(result.current).toBe(4_000));
  });

  it('目標值為 0 時不會卡在動畫裡', async () => {
    const { result } = renderHook(() => useCountUp(0, 30));
    await waitFor(() => expect(result.current).toBe(0));
  });

  describe('reduced-motion', () => {
    beforeEach(() => stubMatchMedia(true));

    it('第一次 render 就是目標值，不經過 0', () => {
      const { result } = renderHook(() => useCountUp(50_000, 900));
      expect(result.current).toBe(50_000);
    });
  });
});
