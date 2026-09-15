import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DUR } from '../lib/motion';
import { LaunchScreen } from './LaunchScreen';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
}

describe('啟動畫面（原型 v2）', () => {
  it('打開時顯示兩顆饅頭與字標，下方沒有讀取條（使用者要求拿掉）', () => {
    stubMotion(false);
    render(<LaunchScreen />);
    const s = screen.getByTestId('launch-screen');
    expect(s).toHaveTextContent('饅頭記帳');
    expect(s).toHaveTextContent('our little money book');
    expect(s.querySelectorAll('[data-bun]')).toHaveLength(2);
    expect(s.querySelector('[role="progressbar"], [data-testid="launch-progress"]')).toBeNull();
  });

  it('時間軸跟原型一樣：2.15 秒開始淡出，淡出 0.46 秒', () => {
    expect(DUR.bootHold).toBe(2150);
    expect(DUR.bootOut).toBe(460);
  });

  it('停留後開始淡出，淡出播完自己卸載', () => {
    stubMotion(false);
    vi.useFakeTimers();
    render(<LaunchScreen />);

    act(() => { vi.advanceTimersByTime(DUR.bootHold - 1); });
    expect(screen.getByTestId('launch-screen')).not.toHaveAttribute('data-leaving');
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.getByTestId('launch-screen')).toHaveAttribute('data-leaving');
    act(() => { vi.advanceTimersByTime(DUR.bootOut); });
    expect(screen.queryByTestId('launch-screen')).not.toBeInTheDocument();
  });

  it('減少動態效果：不播彈起，淡出只有 120ms', () => {
    stubMotion(true);
    vi.useFakeTimers();
    render(<LaunchScreen />);
    expect(screen.getByTestId('launch-screen')).toHaveAttribute('data-reduced');

    act(() => { vi.advanceTimersByTime(DUR.bootHold + DUR.reduced); });
    expect(screen.queryByTestId('launch-screen')).not.toBeInTheDocument();
  });

  it('提早卸載不會留下計時器', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const { unmount } = render(<LaunchScreen />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
