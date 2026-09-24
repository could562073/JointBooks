import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useLedger } from '../store/useLedger';
import {
  addEntry, listedRows, openApp, settledTxns, setupLedger, teardownLedger, typeAmount,
} from './harness';

beforeEach(setupLedger);
afterEach(teardownLedger);

describe('§15.1-5 記一筆：金額 → 分類 → 儲存', () => {
  it('新紀錄出現在明細，當日總額與結餘同步變動', async () => {
    await openApp();
    const before = screen.getByTestId('card-net').textContent;

    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('42.50');
    // 換一個不是預設的主分類，確認選擇真的有被帶進去
    const second = useLedger.getState().categories.filter((c) => c.kind === 'expense')[1]!;
    fireEvent.click(screen.getByTestId(`main-${second.id}`));
    fireEvent.click(screen.getByTestId(`sub-${second.subs[0]!.id}`));
    fireEvent.click(screen.getByTestId('key-save'));

    await settledTxns(1);
    expect(listedRows()[0]).toContain('-$42.50');
    expect(listedRows()[0]).toContain(second.name);
    // 總額是 count-up 的（MOTION #31／#11），reduced-motion 下一步到位，但那
    // 一步是在 effect 裡做的——store 更新之後還要等一次 effect flush 才看得到
    await waitFor(() => expect(screen.getByTestId('day-total')).toHaveTextContent('42.50'));
    // 合計卡只到元（原型如此），當日總額才帶角分
    expect(screen.getByTestId('card-expense')).toHaveTextContent('$43');
    expect(screen.getByTestId('card-net').textContent).not.toBe(before);
  });
});

describe('§15.1-6 金額為 0 時不寫入', () => {
  it('沒打任何數字就按儲存，明細仍是空的', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    fireEvent.click(screen.getByTestId('key-save'));
    // 儲存鍵在金額 0 時本來就不該生效，面板不關、也不落帳
    expect(screen.getByTestId('entry-sheet')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('entry-close'));
    await waitFor(() => expect(screen.queryByTestId('entry-sheet')).not.toBeInTheDocument());
    expect(screen.getByTestId('txn-empty')).toBeInTheDocument();
    expect(useLedger.getState().txns).toHaveLength(0);
  });

  it('打了 0.00 一樣不寫入', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('0.00');
    fireEvent.click(screen.getByTestId('key-save'));
    expect(screen.getByTestId('entry-sheet')).toBeInTheDocument();
    expect(useLedger.getState().txns).toHaveLength(0);
  });
});

describe('§15.1-7 小數最多兩位、總長 9 字', () => {
  it('第三位小數打不進去', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('1.234');
    expect(screen.getByTestId('field-amount')).toHaveTextContent('1.23');
  });

  it('小數點只吃第一個', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('1.2.3');
    expect(screen.getByTestId('field-amount')).toHaveTextContent('1.23');
  });

  it('整串超過 9 字就不再吃', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('1234567890');
    const shown = screen.getByTestId('field-amount').textContent ?? '';
    expect(shown).toContain('123456789');
    expect(shown).not.toContain('1234567890');
  });
});

describe('§15.1-8 金額填稅前，存進去的是含稅合計', () => {
  it('打稅前與稅費，明細列顯示的是合計', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('16.75');
    fireEvent.click(screen.getByTestId('field-tax'));
    typeAmount('1.00');
    fireEvent.click(screen.getByTestId('key-save'));

    await settledTxns(1);
    expect(listedRows()[0]!).toContain('17.75');
  });
});

describe('§15.1-9 點明細進編輯模式', () => {
  it('標題、原值、原日期、勾號與垃圾桶都對', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('88.80');
    fireEvent.change(screen.getByTestId('entry-note'), { target: { value: 'Costco 週採買' } });
    fireEvent.click(screen.getByTestId('key-save'));
    await settledTxns(1);

    fireEvent.click(screen.getByTestId('txn-list').querySelector('button')!);

    expect(screen.getByTestId('entry-mode')).toHaveTextContent('編輯這筆');
    expect(screen.getByTestId('field-amount')).toHaveTextContent('88.80');
    expect(screen.getByTestId('entry-note')).toHaveValue('Costco 週採買');
    expect(screen.getByTestId('date-row')).toHaveTextContent('2026-09-10');
    expect(screen.getByTestId('entry-delete')).toBeInTheDocument();
    // 儲存鍵是一個白色大勾號的 svg，沒有文字（§5）
    expect(screen.getByTestId('key-save')).toHaveAccessibleName('儲存');
    expect(screen.getByTestId('key-save').querySelector('path')).toBeInTheDocument();
  });

  it('新增模式沒有垃圾桶鍵', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    expect(screen.queryByTestId('entry-delete')).not.toBeInTheDocument();
  });
});

describe('§15.1-10 面板內就地新增主／子分類', () => {
  it('新主分類立即出現且被選中', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    fireEvent.click(screen.getByTestId('add-main'));
    fireEvent.change(screen.getByTestId('category-input'), { target: { value: '寵物' } });
    fireEvent.keyDown(screen.getByTestId('category-input'), { key: 'Enter' });

    await waitFor(() =>
      expect(within(screen.getByTestId('main-chips')).getByText('寵物').closest('button'))
        .toHaveAttribute('aria-pressed', 'true'));
    expect(useLedger.getState().categories.some((c) => c.name === '寵物')).toBe(true);
  });

  it('新子分類立即出現且被選中', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    fireEvent.click(screen.getByTestId('add-sub'));
    fireEvent.change(screen.getByTestId('category-input'), { target: { value: '貓砂' } });
    fireEvent.keyDown(screen.getByTestId('category-input'), { key: 'Enter' });

    await waitFor(() =>
      expect(within(screen.getByTestId('sub-chips')).getByText('貓砂').closest('button'))
        .toHaveAttribute('aria-pressed', 'true'));
  });
});

describe('§15.1-10b 改日期後紀錄落在該日期', () => {
  it('在 10 號開面板、改成 18 號儲存，帳記在 18 號', async () => {
    await openApp();
    fireEvent.click(screen.getByTestId('fab'));
    typeAmount('9');
    fireEvent.click(screen.getByTestId('date-row'));
    fireEvent.click(screen.getByTestId('mini-day-18'));
    fireEvent.click(screen.getByTestId('key-save'));
    await settledTxns(1);

    // 月曆仍停在 10 號，那天什麼都沒有
    expect(screen.getByTestId('day-header')).toHaveTextContent('10日');
    expect(screen.getByTestId('txn-empty')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('cell-18'));
    expect(listedRows()[0]).toContain('-$9.00');
  });
});

describe('§15.1-5 附帶：多筆同一天', () => {
  it('三筆都在，當日總額是加總', async () => {
    await openApp();
    await addEntry('10');
    await addEntry('20');
    await addEntry('30');
    expect(listedRows()).toHaveLength(3);
    await waitFor(() => expect(screen.getByTestId('day-total')).toHaveTextContent('60'));
  });
});
