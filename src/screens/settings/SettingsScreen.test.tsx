import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

describe('SettingsScreen 的帳本成員', () => {
  it('列出我與老婆', () => {
    render(<SettingsScreen {...BASE} />);
    expect(screen.getByTestId('member-me')).toHaveTextContent('擁有者');
    expect(screen.getByTestId('member-partner')).toHaveTextContent('可編輯');
  });

  it('點邀請成員會回報', () => {
    const onInvite = vi.fn();
    render(<SettingsScreen {...BASE} onInvite={onInvite} />);
    fireEvent.click(screen.getByTestId('invite-member'));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });
});

describe('SettingsScreen 的分類摘要', () => {
  it('顯示「N 個分類 · 月額度 $X」', () => {
    render(<SettingsScreen {...BASE} />);
    const sub = screen.getByTestId('category-summary');
    expect(sub).toHaveTextContent(`${s().categories.length} 個分類`);
    expect(sub).toHaveTextContent('月額度 $');
  });

  it('點摘要列進子頁，按 ‹ 回來', () => {
    render(<SettingsScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('open-categories'));
    expect(screen.getByTestId('categories-page')).toBeInTheDocument();
    expect(screen.queryByTestId('settings-screen')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('categories-back'));
    expect(screen.getByTestId('settings-screen')).toBeInTheDocument();
  });
});

describe('SettingsScreen 的兩個開關（§7.3）', () => {
  it('增補檔 A 已移除月結日與週起始兩列', () => {
    render(<SettingsScreen {...BASE} />);
    expect(screen.queryByText(/月結日/)).not.toBeInTheDocument();
    expect(screen.queryByText(/週起始/)).not.toBeInTheDocument();
  });

  it('兩個開關預設都開著', () => {
    render(<SettingsScreen {...BASE} />);
    expect(screen.getByTestId('toggle-notify')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('toggle-who')).toHaveAttribute('aria-checked', 'true');
  });

  it('點「每筆顯示記帳人」會寫回 store', async () => {
    render(<SettingsScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('toggle-who'));
    await waitFor(() => expect(s().showWhoTags).toBe(false));
    expect(screen.getByTestId('toggle-who')).toHaveAttribute('aria-checked', 'false');
  });

  it('點「對方記帳時通知我」會寫回 store', async () => {
    render(<SettingsScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('toggle-notify'));
    await waitFor(() => expect(s().notifyOnPartnerEntry).toBe(false));
  });

  it('關掉之後重新載入仍然是關的（I9 持久化）', async () => {
    render(<SettingsScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('toggle-who'));
    await waitFor(() => expect(s().showWhoTags).toBe(false));

    useLedger.setState({ showWhoTags: true });
    await s().load();
    expect(s().showWhoTags).toBe(false);
  });
});
