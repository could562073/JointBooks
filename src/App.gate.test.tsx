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

/*
 * 點了配置分頁之後一律先 await 配置頁出現，才去找上面的元素。
 * 換頁帶著 420ms 的滑入轉場，而且 Gate 開場還有幾個非同步的載入在飛；
 * 同步 getByTestId 在 CI 上偶發地會在畫面還停在日常頁時就去找配置頁的元素
 * （2026-09-18 與 2026-09-23 各發生一次，都擋下了部署）。
 * 等的是「配置頁真的畫出來了」這個明確狀態，所以如果哪天換頁真的壞掉，
 * 這裡仍然會紅，只是訊息會直接指向換頁而不是某個找不到的按鈕。
 */
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
    await screen.findByTestId('settings-screen');
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
    await screen.findByTestId('settings-screen');
    expect(screen.getByTestId('account-email')).toHaveTextContent('a@gmail.com');

    fireEvent.click(screen.getByTestId('account-sign-out'));
    fireEvent.click(screen.getByTestId('account-sign-out-go'));

    await waitFor(() => expect(screen.getByTestId('account-email')).toHaveTextContent('未登入'));
    expect(await joinedSid()).toBeNull();
    expect(await ledgerRepo.getMeta(LAST_LEDGER_KEY)).toEqual({ sid: 'S1', self: '我' });
    expect(c.tokens.disconnect).toHaveBeenCalled();
  });

  it('舊安裝升級：接著帳本但還沒記過信箱，配置頁顯示已登入（登出鍵），不是登入 Google', async () => {
    await setJoinedSid('S1');
    render(<Gate cloud={cloud()} />);
    await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('tab-settings'));
    await screen.findByTestId('settings-screen');

    expect(screen.getByTestId('account-sign-out')).toBeInTheDocument();
    expect(screen.queryByTestId('account-sign-in')).not.toBeInTheDocument();
  });
});
