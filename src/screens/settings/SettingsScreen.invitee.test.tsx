import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('邀請過後的帳本成員', () => {
  it('還沒邀請：有「邀請成員」，受邀者那一列還沒長出來', () => {
    render(<SettingsScreen {...BASE} />);
    expect(screen.getByTestId('invite-member')).toBeInTheDocument();
    expect(screen.getByTestId('member-me')).toBeInTheDocument();
    expect(screen.queryByTestId('member-partner')).not.toBeInTheDocument();
  });

  it('受邀那一方的手機：本來就在帳本裡，兩列都在', () => {
    useLedger.setState({ self: '妻' });
    render(<SettingsScreen {...BASE} />);
    expect(screen.getByTestId('member-me')).toBeInTheDocument();
    expect(screen.getByTestId('member-partner')).toHaveTextContent('這台裝置');
  });

  it('已經分享給某個帳號：「邀請成員」消失，受邀那一列顯示對方的帳號', () => {
    render(<SettingsScreen {...BASE} invitee="wife@gmail.com" />);
    expect(screen.queryByTestId('invite-member')).not.toBeInTheDocument();
    expect(screen.getByTestId('member-partner')).toHaveTextContent('wife@gmail.com');
  });

  it('受邀那一方的手機上沒有「邀請成員」', () => {
    useLedger.setState({ self: '妻' });
    render(<SettingsScreen {...BASE} />);
    expect(screen.queryByTestId('invite-member')).not.toBeInTheDocument();
  });

  it('建立帳本的人點受邀那一列：可以重新傳邀請連結', () => {
    const onInvite = vi.fn();
    render(<SettingsScreen {...BASE} onInvite={onInvite} invitee="wife@gmail.com" onRemoveInvitee={async () => {}} />);
    fireEvent.click(screen.getByTestId('member-partner-toggle'));
    fireEvent.click(screen.getByTestId('member-partner-resend'));
    expect(onInvite).toHaveBeenCalledTimes(1);
  });

  it('移除這位成員要先確認，確認後才移除', () => {
    const onRemoveInvitee = vi.fn(async () => {});
    render(<SettingsScreen {...BASE} invitee="wife@gmail.com" onRemoveInvitee={onRemoveInvitee} />);
    fireEvent.click(screen.getByTestId('member-partner-toggle'));
    fireEvent.click(screen.getByTestId('member-partner-remove'));
    expect(onRemoveInvitee).not.toHaveBeenCalled();
    expect(screen.getByTestId('member-partner-remove-confirm')).toHaveTextContent('wife@gmail.com 就讀不到這本帳');

    fireEvent.click(screen.getByTestId('member-partner-remove-go'));
    expect(onRemoveInvitee).toHaveBeenCalledTimes(1);
  });

  it('移除失敗時說明原因，按鈕可以再按', async () => {
    const onRemoveInvitee = vi.fn(async () => { throw new Error('403'); });
    render(<SettingsScreen {...BASE} invitee="wife@gmail.com" onRemoveInvitee={onRemoveInvitee} />);
    fireEvent.click(screen.getByTestId('member-partner-toggle'));
    fireEvent.click(screen.getByTestId('member-partner-remove'));
    fireEvent.click(screen.getByTestId('member-partner-remove-go'));
    await waitFor(() => expect(screen.getByTestId('member-partner-remove-error')).toHaveTextContent('移除失敗'));
    expect(screen.getByTestId('member-partner-remove-go')).not.toBeDisabled();
  });

  it('受邀那一方的手機上沒有移除或重新傳連結的選項', () => {
    useLedger.setState({ self: '妻' });
    render(<SettingsScreen {...BASE} invitee="wife@gmail.com" onRemoveInvitee={async () => {}} />);
    fireEvent.click(screen.getByTestId('member-me-toggle'));
    expect(screen.queryByTestId('member-me-manage')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('member-partner-toggle'));
    expect(screen.queryByTestId('member-partner-manage')).not.toBeInTheDocument();
  });
});
