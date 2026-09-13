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
  // 先把 load 跑完再開始測。不等的話，上一個測試 App 還在飛的 load() 會跟
  // 這裡的 resetDb() 搶同一個 IndexedDB 連線，後續寫入要排在 versionchange
  // 後面，第一個 waitFor 就會超時——症狀是「單獨跑會過、整檔跑會掛」。
  await useLedger.getState().load();
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
    expect(screen.getByTestId('stats-screen')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('tab-daily'));
    expect(screen.getByTestId('daily-screen')).toBeInTheDocument();
  });

  it('懸浮 ＋ 只在日常頁出現', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('fab')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('tab-settings'));
    expect(screen.getByTestId('settings-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('fab')).not.toBeInTheDocument();
  });

  // MOTION #8：往後自右進、往前自左進
  it('換頁會重掛內容並帶上方向類別', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('page-daily')).toBeInTheDocument());
    const forward = screen.getByTestId('page-daily').className;

    fireEvent.click(screen.getByTestId('tab-settings'));
    const toSettings = screen.getByTestId('page-settings').className;
    expect(toSettings).toBe(forward);        // 往後，跟初始方向同一個類別

    fireEvent.click(screen.getByTestId('tab-daily'));
    expect(screen.getByTestId('page-daily').className).not.toBe(toSettings);
  });
});

describe('App 的記一筆面板', () => {
  async function openDaily() {
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());
  }

  function typeAmount(keys: string) {
    for (const k of keys) fireEvent.click(screen.getByTestId(`key-${k}`));
  }

  it('點懸浮 ＋ 開新增模式', async () => {
    await openDaily();
    expect(screen.queryByTestId('entry-sheet')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fab'));
    expect(screen.getByTestId('entry-mode')).toHaveTextContent('記一筆');
  });

  it('存一筆之後出現在當天的明細裡', async () => {
    await openDaily();
    expect(screen.getByTestId('txn-empty')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('12.50');
    fireEvent.click(screen.getByTestId('key-save'));

    await waitFor(() => expect(screen.getByTestId('txn-list')).toBeInTheDocument());
    expect(screen.getByTestId('txn-list')).toHaveTextContent('-12.50');
    expect(screen.queryByTestId('entry-sheet')).not.toBeInTheDocument();
  });

  it('點明細那一筆進編輯模式，帶入原值', async () => {
    await openDaily();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('12.50');
    fireEvent.click(screen.getByTestId('key-save'));
    await waitFor(() => expect(screen.getByTestId('txn-list')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('txn-list').querySelector('button')!);
    expect(screen.getByTestId('entry-mode')).toHaveTextContent('編輯這筆');
    expect(screen.getByTestId('field-amount')).toHaveTextContent('12.50');
  });

  it('編輯後金額跟著更新，不會多出一筆', async () => {
    await openDaily();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('12.50');
    fireEvent.click(screen.getByTestId('key-save'));
    await waitFor(() => expect(screen.getByTestId('txn-list')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('txn-list').querySelector('button')!);
    fireEvent.click(screen.getByTestId('key-back'));
    fireEvent.click(screen.getByTestId('key-back'));
    fireEvent.click(screen.getByTestId('key-back'));   // 12.50 → 12
    fireEvent.click(screen.getByTestId('key-save'));

    await waitFor(() => expect(screen.getByTestId('txn-list')).toHaveTextContent('-12.00'));
    expect(screen.getByTestId('txn-list').children).toHaveLength(1);
  });

  it('刪除後那一筆從明細消失', async () => {
    await openDaily();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('12.50');
    fireEvent.click(screen.getByTestId('key-save'));
    await waitFor(() => expect(screen.getByTestId('txn-list')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('txn-list').querySelector('button')!);
    fireEvent.click(screen.getByTestId('entry-delete'));
    fireEvent.click(screen.getByTestId('delete-confirm-confirm'));

    await waitFor(() => expect(screen.getByTestId('txn-empty')).toBeInTheDocument());
  });

  it('新增的日期預設是月曆上的選中日', async () => {
    await openDaily();
    fireEvent.click(screen.getByRole('button', { name: /^18$/ }));
    fireEvent.click(screen.getByTestId('fab'));
    expect(screen.getByTestId('date-row')).toHaveTextContent('18日');
  });

  it('就地新增的主分類存進 store 並立即選中', async () => {
    await openDaily();
    fireEvent.click(screen.getByTestId('fab'));
    fireEvent.click(screen.getByTestId('category-row'));
    fireEvent.click(screen.getByTestId('add-main'));
    fireEvent.change(screen.getByTestId('category-input'), { target: { value: '寵物' } });
    fireEvent.keyDown(screen.getByTestId('category-input'), { key: 'Enter' });

    await waitFor(() => expect(screen.getByTestId('category-row')).toHaveTextContent('寵物'));
  });
});
