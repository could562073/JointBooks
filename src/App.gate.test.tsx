import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Gate } from './App';
import { NeedsConnectError, type TokenProvider } from './auth/gis';
import { resetDb } from './db/schema';
import { ledgerRepo } from './repo/ledgerRepo';
import type { SheetsClient } from './sheets/client';
import { useLedger } from './store/useLedger';
import { LAST_LEDGER_KEY, LOCAL_MODE_KEY, lastAccount, rememberAccount } from './sync/accountState';
import type { Cloud } from './sync/cloud';
import { joinedSid, setJoinedSid } from './sync/ledgerId';

const initialState = useLedger.getState();
const A = { id: 'PA', email: 'a@gmail.com' };

function fakeTokens(): TokenProvider & { connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> } {
  let on = false;
  const listeners = new Set<(c: boolean) => void>();
  const emit = () => listeners.forEach((l) => l(on));
  return {
    preload: vi.fn(async () => {}),
    connect: vi.fn(async () => { on = true; emit(); }),
    renewSilently: vi.fn(async () => false),
    expiresInMs: () => (on ? 3_600_000 : 0),
    token: vi.fn(async () => { if (!on) throw new NeedsConnectError(); return 'TK'; }),
    isConnected: () => on,
    disconnect: vi.fn(async () => { on = false; emit(); }),
    subscribe: (l) => { listeners.add(l); return () => { listeners.delete(l); }; },
  };
}

/** 什麼都回空的假 Sheets：同步控制器跑起來也不會壞 */
function fakeClient(): SheetsClient {
  return {
    aboutUser: vi.fn(async () => A),
    findLedgers: vi.fn(async () => []),
    get: vi.fn(async () => []),
    append: vi.fn(async () => ({ updates: { updatedRange: '紀錄!A2:N2' } })),
    update: vi.fn(async () => ({})),
    clear: vi.fn(async () => ({})),
    createSpreadsheet: vi.fn(async () => 'NEW-SID'),
    shareWith: vi.fn(async () => ({})),
    listPermissions: vi.fn(async () => []),
    removePermission: vi.fn(async () => {}),
  } as unknown as SheetsClient;
}

const cloud = (): Cloud & { tokens: ReturnType<typeof fakeTokens> } =>
  ({ tokens: fakeTokens(), client: fakeClient(), env: 'dev' });

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

describe('Gate：開 App 時去哪、登入與登出', () => {
  it('沒記過任何東西：開始畫面；按「先不登入」進 App，狀態寫只存在這台手機', async () => {
    render(<Gate cloud={cloud()} />);
    fireEvent.click(await screen.findByTestId('login-local'));
    await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByTestId('sync-text')).toHaveTextContent('只存在這台手機'));
    expect(await ledgerRepo.getMeta(LOCAL_MODE_KEY)).toBe(true);
  });

  it('本機模式在配置頁登入：第一次登入開新帳本，配置頁顯示信箱', async () => {
    await ledgerRepo.setMeta(LOCAL_MODE_KEY, true);
    render(<Gate cloud={cloud()} />);
    await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('tab-settings'));
    fireEvent.click(screen.getByTestId('account-sign-in'));

    await waitFor(() => expect(screen.getByTestId('account-email')).toHaveTextContent('a@gmail.com'));
    expect(await joinedSid()).toBe('NEW-SID');
    expect(await lastAccount()).toEqual(A);
  });

  it('已登入按登出：確認後回到本機模式，記住這本帳，斷開 Google', async () => {
    await setJoinedSid('S1');
    await rememberAccount(A);
    const c = cloud();
    render(<Gate cloud={c} />);
    await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('tab-settings'));
    expect(screen.getByTestId('account-email')).toHaveTextContent('a@gmail.com');

    fireEvent.click(screen.getByTestId('account-sign-out'));
    fireEvent.click(screen.getByTestId('account-sign-out-go'));

    await waitFor(() => expect(screen.getByTestId('account-email')).toHaveTextContent('未登入'));
    expect(await joinedSid()).toBeNull();
    expect(await ledgerRepo.getMeta(LAST_LEDGER_KEY)).toEqual({ sid: 'S1', self: '我' });
    expect(c.tokens.disconnect).toHaveBeenCalled();
  });
});
