import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { buildInviteUrl } from '../invite/inviteLink';
import { setJoinedSid } from '../sync/ledgerId';
import { setupLedger, teardownLedger } from './harness';

const nav = vi.hoisted(() => ({ back: false, replace: vi.fn() }));
vi.mock('../lib/navigation', () => ({
  arrivedByHistory: () => nav.back,
  replaceLocation: (url: string) => nav.replace(url),
}));

const SID = '1aB9kQ_fake_spreadsheet_id';

beforeEach(setupLedger);
afterEach(() => {
  teardownLedger();
  nav.back = false;
  nav.replace.mockReset();
  window.history.replaceState({}, '', '/');
});

async function openInvite(): Promise<void> {
  window.history.replaceState({}, '', await buildInviteUrl('', SID));
  render(<App />);
}

describe('iPhone 右滑（上一頁）回到接受邀請頁（使用者回報右滑跳回邀請頁）', () => {
  it('這台已經在帳本裡：不再顯示邀請頁，直接換回主程式', async () => {
    await setJoinedSid(SID);
    nav.back = true;
    await openInvite();
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith('/'));
    expect(screen.queryByTestId('join-page')).not.toBeInTheDocument();
  });

  it('點邀請連結打開的（不是上一頁）：照常顯示「你已在這本帳裡」', async () => {
    await setJoinedSid(SID);
    await openInvite();
    await waitFor(() => expect(screen.getByTestId('join-page')).toHaveAttribute('data-state', 'already'));
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('還沒加入任何帳本的手機按上一頁回來：照常顯示邀請', async () => {
    nav.back = true;
    await openInvite();
    await waitFor(() => expect(screen.getByTestId('join-page')).toHaveAttribute('data-state', 'invite'));
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
