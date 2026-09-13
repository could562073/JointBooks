import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ScrollThumb, THUMB_HIDE_MS, thumbGeometry } from './ScrollThumb';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('thumbGeometry', () => {
  it('內容沒超出就不畫', () => {
    expect(thumbGeometry({ scrollTop: 0, scrollHeight: 500, clientHeight: 500 })).toBeNull();
  });

  it('長度照可見比例；在頂端時貼著軌道起點，捲到底貼齊軌道終點', () => {
    // 軌道 = 512 - 6 - 6 = 500；長度 = 500 × 512 / 1000 = 256
    expect(thumbGeometry({ scrollTop: 0, scrollHeight: 1000, clientHeight: 512 })).toEqual({ size: 256, offset: 6 });
    const end = thumbGeometry({ scrollTop: 488, scrollHeight: 1000, clientHeight: 512 })!;
    expect(end.offset + end.size).toBe(506);
  });

  it('內容很長時不會短到看不見', () => {
    expect(thumbGeometry({ scrollTop: 0, scrollHeight: 100_000, clientHeight: 500 })!.size).toBe(28);
  });

  it('底部讓出被分頁列蓋住的高度', () => {
    const g = thumbGeometry({ scrollTop: 400, scrollHeight: 900, clientHeight: 500 }, 100)!;
    expect(g.offset + g.size).toBe(400);
  });
});

function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div>
      <div ref={ref} data-testid="area" />
      <ScrollThumb target={ref} />
    </div>
  );
}

describe('ScrollThumb', () => {
  it('平常不顯示；捲動時出現，停下來一會兒後收起', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0; });
    vi.stubGlobal('cancelAnimationFrame', () => {});
    render(<Harness />);
    const area = screen.getByTestId('area');
    Object.defineProperties(area, { scrollHeight: { value: 1000 }, clientHeight: { value: 500 } });
    const thumb = screen.getByTestId('scroll-thumb');
    expect(thumb).not.toHaveAttribute('data-visible');

    act(() => { area.scrollTop = 250; area.dispatchEvent(new Event('scroll')); });
    expect(thumb).toHaveAttribute('data-visible');
    expect(thumb.style.height).not.toBe('');

    act(() => { vi.advanceTimersByTime(THUMB_HIDE_MS); });
    expect(thumb).not.toHaveAttribute('data-visible');
  });
});
