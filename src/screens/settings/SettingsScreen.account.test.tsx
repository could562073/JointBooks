import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetDb } from '../../db/schema';
import { useLedger } from '../../store/useLedger';
import { SettingsScreen } from './SettingsScreen';

const initialState = useLedger.getState();

beforeEach(async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
  await resetDb();
  useLedger.setState(initialState, true);
  await useLedger.getState().load();
});
afterEach(() => vi.unstubAllGlobals());

const BASE = { onInvite: () => {}, syncState: 'local' as const, lastSyncAt: null, onRetrySync: () => {} };
const account = (over = {}) => ({ email: null, onSignIn: vi.fn(), onSignOut: vi.fn(async () => {}), ...over });

describe('配置頁的帳號區', () => {
  it('沒設定 Google（開發的純本機模式）就沒有這一區', () => {
    render(<SettingsScreen {...BASE} />);
    expect(screen.queryByTestId('account-section')).not.toBeInTheDocument();
  });

  it('本機模式：寫未登入，按登入 Google 回報', () => {
    const a = account();
    render(<SettingsScreen {...BASE} account={a} />);
    expect(screen.getByTestId('account-section')).toHaveTextContent('帳只存在這台手機');
    fireEvent.click(screen.getByTestId('account-sign-in'));
    expect(a.onSignIn).toHaveBeenCalledTimes(1);
  });

  it('連線中：登入按鈕停用並寫連線中', () => {
    render(<SettingsScreen {...BASE} account={account({ busy: true })} />);
    expect(screen.getByTestId('account-sign-in')).toBeDisabled();
    expect(screen.getByTestId('account-sign-in')).toHaveTextContent('連線中…');
  });

  it('已登入：顯示信箱；登出要先確認，取消就回來', () => {
    const a = account({ email: 'a@gmail.com' });
    render(<SettingsScreen {...BASE} syncState="synced" account={a} />);
    expect(screen.getByTestId('account-email')).toHaveTextContent('a@gmail.com');
    fireEvent.click(screen.getByTestId('account-sign-out'));
    expect(screen.getByTestId('account-sign-out-confirm')).toHaveTextContent('帳會留在這台手機');
    fireEvent.click(screen.getByTestId('account-sign-out-cancel'));
    expect(screen.queryByTestId('account-sign-out-confirm')).not.toBeInTheDocument();
    expect(a.onSignOut).not.toHaveBeenCalled();
  });

  it('確定登出就回報', async () => {
    const a = account({ email: 'a@gmail.com' });
    render(<SettingsScreen {...BASE} syncState="synced" account={a} />);
    fireEvent.click(screen.getByTestId('account-sign-out'));
    fireEvent.click(screen.getByTestId('account-sign-out-go'));
    await waitFor(() => expect(a.onSignOut).toHaveBeenCalledTimes(1));
  });

  it('本機模式的「邀請成員」提示要先登入', () => {
    render(<SettingsScreen {...BASE} account={account()} />);
    expect(screen.getByTestId('invite-member')).toHaveTextContent('先登入');
  });

  it('顯示登入錯誤', () => {
    render(<SettingsScreen {...BASE} account={account({ error: '連不到 Google，請確認網路後再試一次。' })} />);
    expect(screen.getByTestId('account-error')).toHaveTextContent('連不到 Google');
  });
});
