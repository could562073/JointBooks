import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, vi } from 'vitest';
import App from '../App';
import { resetDb } from '../db/schema';
import { useLedger } from '../store/useLedger';

/**
 * §15 驗收套件的共用起手式。
 *
 * 這一套是 HANDOFF §15.1 的 A 類（原訂用 Playwright 跑兩個斷點）。使用者指定
 * 只做單元測試、瀏覽器層面先跳過，所以「功能行為」那 22 條在這裡以 jsdom +
 * Testing Library 覆蓋，「版面」那 6 條（23–28）量的是 getBoundingClientRect，
 * jsdom 一律回 0，量不出來——那幾條連同 B／C 類一起列進 docs/MANUAL-TESTS.md。
 *
 * 每個測試都從 App 的最外層渲染而不是單獨掛某個畫面：驗收要驗的是「接起來之後
 * 還對不對」，元件自己的行為已經有各自的測試檔了。
 */

/** 固定站在 2026-09-10，月曆格號、期間標籤、跨年換月才有可預期的答案 */
export const AT = { year: 2026, month: 8, day: 10 } as const;

const initialState = useLedger.getState();

/**
 * 一律以 reduced-motion 跑：離場動畫會延遲 260ms 才卸載面板，驗收要看的是
 * 結果而不是中間態，動畫本身另有 MOTION 的測試在顧。
 */
export async function setupLedger(): Promise<void> {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
  await resetDb();
  useLedger.setState(initialState, true);
  // 先把 load 跑完再開始。不等的話上一個測試還在飛的 load() 會跟這裡的
  // resetDb() 搶同一個 IndexedDB 連線，第一個 waitFor 就會超時
  await useLedger.getState().load();
  useLedger.setState({ year: AT.year, month: AT.month, selectedDay: AT.day });
}

export function teardownLedger(): void {
  vi.unstubAllGlobals();
}

/** 渲染 App 並等日常頁就緒 */
export async function openApp(): Promise<void> {
  render(<App />);
  await waitFor(() => expect(screen.getByTestId('daily-screen')).toBeInTheDocument());
}

/** 數字鍵盤是逐鍵點的，字串裡的每個字元對應一個鍵 */
export function typeAmount(keys: string): void {
  for (const k of keys) fireEvent.click(screen.getByTestId(`key-${k}`));
}

/**
 * 開面板 → 打金額 → 存。驗收裡重複最多次的一段。
 *
 * 等的是 store 裡真的多一筆，不是面板關掉：reduced-motion 下面板是同步卸載的，
 * 但寫進 IndexedDB 的 addTxn 還在飛，只等面板會在寫入落地前就返回，接著連記
 * 兩筆時後面的斷言會看到空陣列。
 */
export async function addEntry(amount: string): Promise<void> {
  const before = useLedger.getState().txns.length;
  fireEvent.click(screen.getByTestId('fab'));
  typeAmount(amount);
  fireEvent.click(screen.getByTestId('key-save'));
  await waitFor(() => expect(useLedger.getState().txns).toHaveLength(before + 1));
}

/** 等 store 的紀錄數穩定在指定值，避免斷言跑在 IndexedDB 寫入之前 */
export async function settledTxns(count: number): Promise<void> {
  await waitFor(() => expect(useLedger.getState().txns).toHaveLength(count));
}

export async function goTab(tab: 'daily' | 'stats' | 'settings'): Promise<void> {
  fireEvent.click(screen.getByTestId(`tab-${tab}`));
  await waitFor(() => expect(screen.getByTestId(`${tab}-screen`)).toBeInTheDocument());
}

/**
 * 明細每一列的整串文字。驗收要的是「那一筆在不在、金額對不對」，用 toContain
 * 對整列比就夠，不值得為了測試在正式標記上多掛一個 data-amount。
 */
export function listedRows(): string[] {
  const list = screen.queryByTestId('txn-list');
  if (!list) return [];
  return Array.from(list.querySelectorAll('[data-testid^="txn-"]')).map((n) => n.textContent ?? '');
}
