import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import App from './App';
import { resetDb } from './db/schema';
import { useLedger } from './store/useLedger';

const initialState = useLedger.getState();

beforeEach(async () => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
  await resetDb();
  useLedger.setState(initialState, true);
});
afterEach(() => vi.unstubAllGlobals());

describe('App 的外殼', () => {
  it('載入完成後預設停在日常頁', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());
    expect(screen.getByTestId('tab-daily')).toHaveAttribute('aria-current', 'page');
  });

  it('分頁列一直都在，切到別頁日常頁就收起來', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('tab-stats'));
    expect(screen.queryByTestId('daily-screen')).not.toBeInTheDocument();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-daily'));
    expect(screen.getByTestId('daily-screen')).toBeInTheDocument();
  });

  it('懸浮 ＋ 只在日常頁出現', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('fab')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('tab-settings'));
    expect(screen.queryByTestId('fab')).not.toBeInTheDocument();
  });
});
