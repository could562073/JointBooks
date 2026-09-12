import { act, render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Toast } from './Toast';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
}

describe('Toast', () => {
  it('顯示訊息且是 status', () => {
    stubMotion(false);
    render(<Toast message="老婆記了一筆" onDone={() => {}} />);
    expect(screen.getByRole('status')).toHaveTextContent('老婆記了一筆');
  });

  it('停留 6 秒後開始離場（MOTION #25）', () => {
    stubMotion(false);
    vi.useFakeTimers();
    render(<Toast message="x" onDone={() => {}} />);

    expect(screen.getByTestId('toast')).not.toHaveAttribute('data-leaving');
    act(() => { vi.advanceTimersByTime(6000); });
    expect(screen.getByTestId('toast')).toHaveAttribute('data-leaving');
  });

  it('離場動畫演完才回報結束', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Toast message="x" onDone={onDone} />);

    act(() => { vi.advanceTimersByTime(6000); });
    expect(onDone).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(220); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('提早卸載不會對已消失的元件呼叫 onDone', () => {
    stubMotion(false);
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { unmount } = render(<Toast message="x" onDone={onDone} />);
    unmount();
    act(() => { vi.advanceTimersByTime(10_000); });
    expect(onDone).not.toHaveBeenCalled();
  });

  it('圓點會 pulse，reduced-motion 時不會', () => {
    stubMotion(false);
    const { unmount } = render(<Toast message="x" onDone={() => {}} />);
    expect(screen.getByTestId('toast-dot').className.split(' ')).toHaveLength(2);
    unmount();

    stubMotion(true);
    render(<Toast message="x" onDone={() => {}} />);
    expect(screen.getByTestId('toast-dot').className.split(' ')).toHaveLength(1);
  });

  it('reduced-motion 時不掛進出場動畫', () => {
    stubMotion(true);
    render(<Toast message="x" onDone={() => {}} />);
    expect(screen.getByTestId('toast').className.split(' ')).toHaveLength(1);
  });
});
