import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { SyncStatus } from './SyncStatus';

afterEach(() => vi.unstubAllGlobals());

function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
}

describe('SyncStatus', () => {
  it('已同步時顯示相對時間', () => {
    stubMotion(false);
    render(<SyncStatus state="synced" lastSyncAt={Date.now()} />);
    expect(screen.getByTestId('sync-text')).toHaveTextContent('已同步 · 剛剛');
  });

  it('離線與失敗各有自己的點色', () => {
    stubMotion(false);
    const { rerender } = render(<SyncStatus state="offline" lastSyncAt={null} />);
    expect(screen.getByTestId('sync-dot')).toHaveAttribute('data-state', 'offline');
    rerender(<SyncStatus state="error" lastSyncAt={null} />);
    expect(screen.getByTestId('sync-dot')).toHaveAttribute('data-state', 'error');
  });

  it('一般狀態是 status 而不是按鈕——點下去沒有意義的東西不該做成按鈕', () => {
    stubMotion(false);
    render(<SyncStatus state="synced" lastSyncAt={Date.now()} onRetry={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('失敗時可以點著重試', () => {
    stubMotion(false);
    const onRetry = vi.fn();
    render(<SyncStatus state="error" lastSyncAt={null} onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId('sync-status'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('SyncStatus 的圓環（MOTION #26）', () => {
  it('同步中掛上 spin', () => {
    stubMotion(false);
    render(<SyncStatus state="syncing" lastSyncAt={null} />);
    expect(screen.getByTestId('sync-dot').className.split(' ')).toHaveLength(2);
  });

  it('其他狀態不轉', () => {
    stubMotion(false);
    render(<SyncStatus state="synced" lastSyncAt={Date.now()} />);
    expect(screen.getByTestId('sync-dot').className.split(' ')).toHaveLength(1);
  });

  it('reduced-motion 時不轉', () => {
    stubMotion(true);
    render(<SyncStatus state="syncing" lastSyncAt={null} />);
    expect(screen.getByTestId('sync-dot').className.split(' ')).toHaveLength(1);
  });
});

describe('SyncStatus 的本機模式', () => {
  it('點一下就是登入', () => {
    stubMotion(false);
    const onRetry = vi.fn();
    render(<SyncStatus state="local" lastSyncAt={null} onRetry={onRetry} />);
    fireEvent.click(screen.getByTestId('sync-status'));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sync-text')).toHaveTextContent('只存在這台手機');
  });
});
