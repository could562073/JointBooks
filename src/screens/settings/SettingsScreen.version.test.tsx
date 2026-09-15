import { render, screen } from '@testing-library/react';
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

describe('配置頁底下的版本', () => {
  it('顯示目前跑的版本：兩支手機對一下，才知道是不是都換成新版了', () => {
    render(<SettingsScreen onInvite={() => {}} syncState="synced" lastSyncAt={null} onRetrySync={() => {}} />);
    expect(screen.getByTestId('app-version')).toHaveTextContent(/^版本 \S+/);
  });
});
