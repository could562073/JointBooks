import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useReducedMotion } from './useReducedMotion';

function Probe() {
  return <span data-testid="v">{String(useReducedMotion())}</span>;
}

/** 可觸發變更的 matchMedia 替身 */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  let matches = initial;
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return matches && query.includes('reduce'); },
    media: query,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => { listeners.add(cb); },
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => { listeners.delete(cb); },
  }));
  return {
    change(next: boolean) {
      matches = next;
      for (const cb of listeners) cb({ matches: next } as MediaQueryListEvent);
    },
    get listenerCount() { return listeners.size; },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('useReducedMotion', () => {
  it('反映初始值', () => {
    stubMatchMedia(true);
    render(<Probe />);
    expect(screen.getByTestId('v').textContent).toBe('true');
  });

  it('使用者中途改系統設定時會重新 render', () => {
    const mm = stubMatchMedia(false);
    render(<Probe />);
    expect(screen.getByTestId('v').textContent).toBe('false');

    act(() => { mm.change(true); });
    expect(screen.getByTestId('v').textContent).toBe('true');
  });

  it('卸載時解除訂閱，不留下監聽器', () => {
    const mm = stubMatchMedia(false);
    const { unmount } = render(<Probe />);
    expect(mm.listenerCount).toBe(1);
    unmount();
    expect(mm.listenerCount).toBe(0);
  });

  it('沒有 matchMedia 的環境回 false 而不是拋錯', () => {
    vi.stubGlobal('matchMedia', undefined);
    render(<Probe />);
    expect(screen.getByTestId('v').textContent).toBe('false');
  });
});
