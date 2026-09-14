import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../../db/schema';
import { useLedger } from '../../store/useLedger';
import { SettingsScreen } from './SettingsScreen';

const s = () => useLedger.getState();
const initialState = useLedger.getState();

beforeEach(async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
  await resetDb();
  useLedger.setState(initialState, true);
  await s().load();
});
afterEach(() => vi.unstubAllGlobals());

const BASE = {
  onInvite: () => {},
  syncState: 'synced' as const,
  lastSyncAt: null,
  onRetrySync: () => {},
};

describe('分類子頁與上一頁（iPhone 右滑）', () => {
  it('打開分類子頁會佔一格歷史紀錄', () => {
    render(<SettingsScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('open-categories'));
    expect(history.state?.jbSubpage).toBe('categories');
  });

  it('右滑（上一頁）回到配置頁，而且是滑回來的', () => {
    render(<SettingsScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('open-categories'));
    expect(screen.getByTestId('categories-page')).toBeInTheDocument();

    act(() => { window.dispatchEvent(new PopStateEvent('popstate', { state: null })); });
    expect(screen.queryByTestId('categories-page')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-screen')).toHaveAttribute('data-returning');
  });
});

describe('改分類後要求同步', () => {
  it('在分類子頁新增分類：存起來並要求推上雲端', async () => {
    const onCategoriesChanged = vi.fn();
    render(<SettingsScreen {...BASE} onCategoriesChanged={onCategoriesChanged} />);
    fireEvent.click(screen.getByTestId('open-categories'));
    fireEvent.click(screen.getByTestId('categories-add'));
    await waitFor(() => expect(onCategoriesChanged).toHaveBeenCalled());
  });
});
