import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { useRowRemoval } from './useRowRemoval';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
}

describe('useRowRemoval', () => {
  it('先標記收合，260ms 後才真的刪', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const onRemove = vi.fn();
    const { result } = renderHook(() => useRowRemoval(onRemove));

    act(() => result.current.remove('a'));
    expect(result.current.collapsing.has('a')).toBe(true);
    expect(onRemove).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(260); });
    expect(onRemove).toHaveBeenCalledWith('a');
    expect(result.current.collapsing.has('a')).toBe(false);
  });

  it('同一列連按兩次只刪一次', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const onRemove = vi.fn();
    const { result } = renderHook(() => useRowRemoval(onRemove));

    act(() => { result.current.remove('a'); result.current.remove('a'); });
    act(() => { vi.advanceTimersByTime(600); });
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('不同列各自計時，互不影響', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const onRemove = vi.fn();
    const { result } = renderHook(() => useRowRemoval(onRemove));

    act(() => result.current.remove('a'));
    act(() => { vi.advanceTimersByTime(100); });
    act(() => result.current.remove('b'));
    expect(result.current.collapsing.has('a')).toBe(true);
    expect(result.current.collapsing.has('b')).toBe(true);

    act(() => { vi.advanceTimersByTime(600); });
    expect(onRemove.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
  });

  it('reduced-motion 時直接刪，不等動畫', () => {
    stubMotion(true);
    const onRemove = vi.fn();
    const { result } = renderHook(() => useRowRemoval(onRemove));

    act(() => result.current.remove('a'));
    expect(onRemove).toHaveBeenCalledWith('a');
    expect(result.current.collapsing.size).toBe(0);
  });

  it('收合途中卸載不會對已消失的元件呼叫 onRemove', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const onRemove = vi.fn();
    const { result, unmount } = renderHook(() => useRowRemoval(onRemove));

    act(() => result.current.remove('a'));
    unmount();
    act(() => { vi.advanceTimersByTime(600); });
    expect(onRemove).not.toHaveBeenCalled();
  });
});
