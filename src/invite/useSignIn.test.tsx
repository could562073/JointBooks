import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Cloud } from '../sync/cloud';
import { useSignIn } from './useSignIn';

/** 假的雲端：connect 永遠不 resolve，模擬還卡在 Google 視窗還沒回來 */
function fakeCloud(): { cloud: Cloud; connect: ReturnType<typeof vi.fn> } {
  const connect = vi.fn(() => new Promise<void>(() => {}));
  const cloud = {
    tokens: {
      connect,
      disconnect: vi.fn(async () => {}),
      isConnected: () => false,
    } as unknown as Cloud['tokens'],
    client: {} as Cloud['client'],
    env: 'dev',
  } as Cloud;
  return { cloud, connect };
}

describe('useSignIn：連點兩下不能同時跑兩次', () => {
  it('start 連點兩次：connect 只叫一次，而且讓使用者選帳號', () => {
    const { cloud, connect } = fakeCloud();
    const { result } = renderHook(() => useSignIn(cloud, vi.fn()));

    act(() => {
      result.current.start();
      result.current.start();
    });

    expect(connect).toHaveBeenCalledTimes(1);
    // 一開始就帶 select_account：舊帳號同意過的話 Google 可能不再發 refresh token，
    // 讓使用者選帳號才會走到同意畫面（I5）
    expect(connect).toHaveBeenCalledWith('select_account');
  });
});
