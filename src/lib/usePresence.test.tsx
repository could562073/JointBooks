import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { usePresence } from './usePresence';

afterEach(() => vi.useRealTimers());

const hook = (open: boolean, reduced = false) =>
  renderHook(({ o, r }) => usePresence(o, 240, r), { initialProps: { o: open, r: reduced } });

describe('usePresence', () => {
  it('一開始沒開就不掛', () => {
    const { result } = hook(false);
    expect(result.current).toEqual({ mounted: false, exiting: false });
  });

  it('打開的那一格就掛上，而且不是離場狀態', () => {
    const { result, rerender } = hook(false);
    rerender({ o: true, r: false });
    expect(result.current).toEqual({ mounted: true, exiting: false });
  });

  it('關起來時先進入離場，時間到才卸載', () => {
    vi.useFakeTimers();
    const { result, rerender } = hook(true);
    rerender({ o: false, r: false });
    expect(result.current).toEqual({ mounted: true, exiting: true });

    act(() => { vi.advanceTimersByTime(239); });
    expect(result.current.mounted).toBe(true);

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toEqual({ mounted: false, exiting: false });
  });

  it('離場途中又打開：取消卸載，回到打開狀態', () => {
    vi.useFakeTimers();
    const { result, rerender } = hook(true);
    rerender({ o: false, r: false });
    act(() => { vi.advanceTimersByTime(100); });
    rerender({ o: true, r: false });
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toEqual({ mounted: true, exiting: false });
  });

  it('reduced-motion 時關起來當下就卸載，不留離場', () => {
    const { result, rerender } = hook(true, true);
    rerender({ o: false, r: true });
    expect(result.current).toEqual({ mounted: false, exiting: false });
  });

  it('卸載時把還沒到的計時器清掉', () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const { rerender, unmount } = hook(true);
    rerender({ o: false, r: false });
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
