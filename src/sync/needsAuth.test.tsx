import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NeedsConnectError } from '../auth/gis';
import { SyncStatus } from '../components/SyncStatus';
import type { SheetsClient } from '../sheets/client';
import { nextState } from './state';
import { createSyncEngine } from './syncEngine';
import { syncLabel } from './syncLabels';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('needs-auth 狀態（token 過期要點一下重新連線）', () => {
  it('任何狀態收到 needs-auth 都轉過去；重新連線後 start 會轉成 syncing', () => {
    expect(nextState('synced', { type: 'needs-auth' })).toBe('needs-auth');
    expect(nextState('needs-auth', { type: 'start' })).toBe('syncing');
  });

  it('離線仍然優先：沒網路時就說沒網路，不要叫人去連線', () => {
    expect(nextState('offline', { type: 'needs-auth' })).toBe('offline');
    expect(nextState('needs-auth', { type: 'offline' })).toBe('offline');
  });

  it('文字是「點一下連線 Google」', () => {
    expect(syncLabel('needs-auth', null)).toBe('點一下連線 Google');
  });

  it('狀態點變成可以點的按鈕，點了就觸發重新連線', () => {
    const onRetry = vi.fn();
    render(<SyncStatus state="needs-auth" lastSyncAt={null} onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId('sync-status'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('同步引擎遇到 token 過期', () => {
  function engineWith(get: SheetsClient['get']) {
    const onState = vi.fn();
    const saveTxns = vi.fn(async () => {});
    const client = { get, append: vi.fn(), update: vi.fn() } as unknown as SheetsClient;
    const engine = createSyncEngine({
      client, spreadsheetId: () => 'S', localTxns: async () => [], saveTxns,
      isOnline: () => true, onState,
    });
    return { engine, onState, saveTxns };
  }

  it('轉成 needs-auth 而不是 error，也不動本機資料', async () => {
    const { engine, onState, saveTxns } = engineWith(async () => { throw new NeedsConnectError(); });
    const r = await engine.syncOnce();
    expect(r.state).toBe('needs-auth');
    expect(onState).toHaveBeenLastCalledWith('needs-auth');
    expect(saveTxns).not.toHaveBeenCalled();
  });

  it('其他錯誤照舊是 error', async () => {
    const { engine } = engineWith(async () => { throw new Error('boom'); });
    expect((await engine.syncOnce()).state).toBe('error');
  });
});
