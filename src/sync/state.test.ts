import { describe, it, expect } from 'vitest';
import { isBusy, nextState, type SyncState } from './state';

describe('nextState', () => {
  it('idle → syncing → synced', () => {
    expect(nextState('idle', { type: 'start' })).toBe('syncing');
    expect(nextState('syncing', { type: 'done' })).toBe('synced');
  });

  it('失敗轉 error', () => {
    expect(nextState('syncing', { type: 'fail' })).toBe('error');
  });

  it('error 之後還能再同步一次', () => {
    expect(nextState('error', { type: 'start' })).toBe('syncing');
  });

  it('任何狀態收到 offline 都轉 offline', () => {
    const all: SyncState[] = ['idle', 'syncing', 'synced', 'offline', 'error'];
    for (const s of all) expect(nextState(s, { type: 'offline' })).toBe('offline');
  });

  it('離線時按同步不會轉成 syncing——狀態點不該閃一下紅色', () => {
    expect(nextState('offline', { type: 'start' })).toBe('offline');
    expect(nextState('offline', { type: 'fail' })).toBe('offline');
  });

  it('回線先回到 idle，要不要同步由呼叫端決定', () => {
    expect(nextState('offline', { type: 'online' })).toBe('idle');
  });

  it('已經在線上時收到 online 不動作', () => {
    expect(nextState('synced', { type: 'online' })).toBe('synced');
    expect(nextState('syncing', { type: 'online' })).toBe('syncing');
  });
});

describe('isBusy', () => {
  it('只有 syncing 要播 spin（MOTION #26）', () => {
    expect(isBusy('syncing')).toBe(true);
    for (const s of ['idle', 'synced', 'offline', 'error'] as SyncState[]) {
      expect(isBusy(s)).toBe(false);
    }
  });
});
