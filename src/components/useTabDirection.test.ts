import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useTabDirection } from './useTabDirection';

type Tab = Parameters<typeof useTabDirection>[0];

function start(tab: Tab) {
  return renderHook(({ t }: { t: Tab }) => useTabDirection(t), { initialProps: { t: tab } });
}

describe('useTabDirection（MOTION #8）', () => {
  it('往後自右進（1）、往前自左進（-1）', () => {
    const { result, rerender } = start('daily');
    rerender({ t: 'stats' });
    expect(result.current).toBe(1);
    rerender({ t: 'settings' });
    expect(result.current).toBe(1);
    rerender({ t: 'stats' });
    expect(result.current).toBe(-1);
  });

  it('配置 → 統計之後的重繪沿用自左進，不會被重算成自右進', () => {
    const { result, rerender } = start('settings');
    rerender({ t: 'stats' });
    expect(result.current).toBe(-1);
    // 換頁後的狀態更新（同步、載入）或 StrictMode 的第二次 render
    rerender({ t: 'stats' });
    rerender({ t: 'stats' });
    expect(result.current).toBe(-1);
  });
});
