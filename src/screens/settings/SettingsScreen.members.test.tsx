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
  // 這些測試要看得到受邀者那一列：假設已經分享給對方（沒邀請時那一列不會長出來）
  invitee: 'wife@gmail.com',
};

describe('帳本成員：名稱與饅頭顏色', () => {
  it('顯示名稱，不寫死「老婆」：預設「我」與「雪雪大人」，並標出哪一位是這台裝置', () => {
    render(<SettingsScreen {...BASE} />);
    expect(screen.getByTestId('member-me')).toHaveTextContent('我');
    expect(screen.getByTestId('member-me')).toHaveTextContent('這台裝置');
    expect(screen.getByTestId('member-partner')).toHaveTextContent('雪雪大人');
    expect(screen.getByTestId('member-partner')).not.toHaveTextContent('這台裝置');
  });

  it('成員卡片下方說明一本帳本最多兩位成員', () => {
    render(<SettingsScreen {...BASE} />);
    expect(screen.getByTestId('member-limit-note')).toHaveTextContent('最多兩位成員');
  });

  it('點成員展開編輯；改名後存起來並要求同步到雲端', async () => {
    const onMembersChanged = vi.fn();
    render(<SettingsScreen {...BASE} onMembersChanged={onMembersChanged} />);
    fireEvent.click(screen.getByTestId('member-partner-toggle'));
    const input = screen.getByTestId('member-partner-name');
    fireEvent.change(input, { target: { value: '小雪' } });
    fireEvent.blur(input);

    await waitFor(() => expect(s().members.妻.name).toBe('小雪'));
    await waitFor(() => expect(onMembersChanged).toHaveBeenCalled());
    expect(screen.getByTestId('member-partner')).toHaveTextContent('小雪');
  });

  it('換饅頭顏色', async () => {
    render(<SettingsScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('member-me-toggle'));
    fireEvent.click(screen.getByTestId('member-me-color-mint'));
    await waitFor(() => expect(s().members.我.color).toBe('mint'));
    expect(screen.getByTestId('member-me-color-mint')).toHaveAttribute('aria-checked', 'true');
  });

  it('名稱清空不會存成空白，欄位回到原本的名稱', () => {
    render(<SettingsScreen {...BASE} />);
    fireEvent.click(screen.getByTestId('member-partner-toggle'));
    const input = screen.getByTestId('member-partner-name');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('雪雪大人');
    expect(s().members.妻.name).toBe('雪雪大人');
  });

  it('加入的人的手機：「這台裝置」標在雪雪大人那一列，那列寫線上', () => {
    useLedger.setState({ self: '妻' });
    render(<SettingsScreen {...BASE} />);
    expect(screen.getByTestId('member-partner')).toHaveTextContent('這台裝置');
    expect(screen.getByTestId('member-partner')).toHaveTextContent('線上');
    expect(screen.getByTestId('member-me')).not.toHaveTextContent('這台裝置');
  });
});
