import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useLedger } from '../store/useLedger';
import { addEntry, goTab, openApp, setupLedger, teardownLedger } from './harness';

beforeEach(setupLedger);
afterEach(teardownLedger);

/** 進配置頁 → 分類子頁 */
async function openCategories(): Promise<void> {
  await goTab('settings');
  fireEvent.click(screen.getByTestId('open-categories'));
  await waitFor(() => expect(screen.getByTestId('categories-page')).toBeInTheDocument());
}

/**
 * 左滑一張分類卡。門檻在 preset 裡（10px 接管、42px 吸附），所以要走完
 * 按下 → 越過接管門檻 → 越過吸附門檻 → 放開這一整串，少一步就不會展開。
 */
function swipeOpen(cardId: string): void {
  const card = screen.getByTestId(cardId).querySelector('[data-open], [style*="translate3d"]')!;
  fireEvent.pointerDown(card, { pointerId: 1, clientX: 200, clientY: 40 });
  fireEvent.pointerMove(card, { pointerId: 1, clientX: 180, clientY: 40 });
  fireEvent.pointerMove(card, { pointerId: 1, clientX: 140, clientY: 40 });
  fireEvent.pointerUp(card, { pointerId: 1, clientX: 140, clientY: 40 });
}

const expenseCats = () => useLedger.getState().categories.filter((c) => c.kind === 'expense');

describe('§15.1-11 改名、改預算、換圖示後全站同步', () => {
  it('改名之後記帳選單與明細都跟著換', async () => {
    await openApp();
    const target = expenseCats()[0]!;
    await addEntry('25');

    await openCategories();
    fireEvent.click(screen.getByTestId(`cat-${target.id}-name`));
    fireEvent.change(screen.getByTestId(`cat-${target.id}-name-input`), { target: { value: '住' } });
    fireEvent.keyDown(screen.getByTestId(`cat-${target.id}-name-input`), { key: 'Enter' });
    await waitFor(() => expect(useLedger.getState().categories.find((c) => c.id === target.id)!.name).toBe('住'));

    fireEvent.click(screen.getByTestId('categories-back'));
    await goTab('daily');
    expect(screen.getByTestId('txn-list')).toHaveTextContent('住');
  });

  it('改預算之後統計頁的預算條跟著換', async () => {
    await openApp();
    const target = expenseCats()[0]!;

    await openCategories();
    fireEvent.click(screen.getByTestId(`cat-${target.id}-budget`));
    fireEvent.change(screen.getByTestId(`cat-${target.id}-budget-input`), { target: { value: '900' } });
    fireEvent.keyDown(screen.getByTestId(`cat-${target.id}-budget-input`), { key: 'Enter' });
    await waitFor(() =>
      expect(useLedger.getState().categories.find((c) => c.id === target.id)!.budgetCents).toBe(90_000));

    fireEvent.click(screen.getByTestId('categories-back'));
    await goTab('stats');
    expect(screen.getByTestId(`budget-${target.id}-numbers`)).toHaveTextContent('900');
  });

  it('換圖示之後明細與預算條的圖示都換掉', async () => {
    await openApp();
    const target = expenseCats()[0]!;
    expect(target.icon).not.toBe('bolt');
    await addEntry('25');

    await openCategories();
    fireEvent.click(screen.getByTestId(`cat-${target.id}-icon`));
    expect(screen.getByTestId('icon-picker')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('icon-bolt'));
    await waitFor(() =>
      expect(useLedger.getState().categories.find((c) => c.id === target.id)!.icon).toBe('bolt'));

    fireEvent.click(screen.getByTestId('categories-back'));
    await goTab('daily');
    expect(within(screen.getByTestId('txn-list')).getByAltText('bolt')).toBeInTheDocument();

    await goTab('stats');
    expect(within(screen.getByTestId(`budget-${target.id}`)).getByAltText('bolt')).toBeInTheDocument();
  });
});

describe('§15.1-12 新增分類', () => {
  it('出現在最上方、名稱自動進入編輯、圖示選擇器未展開', async () => {
    await openApp();
    await openCategories();
    const firstBefore = screen.getByTestId('categories-list').children[0]!.getAttribute('data-testid');

    fireEvent.click(screen.getByTestId('categories-add'));

    await waitFor(() => {
      const firstAfter = screen.getByTestId('categories-list').children[0]!.getAttribute('data-testid');
      expect(firstAfter).not.toBe(firstBefore);
    });
    const newId = screen.getByTestId('categories-list').children[0]!.getAttribute('data-testid')!.slice(4);

    // 名稱欄已經是輸入態
    expect(screen.getByTestId(`cat-${newId}-name-input`)).toBeInTheDocument();
    // 圖示選擇器**沒有**跟著展開
    expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();
    expect(screen.getByTestId(`cat-${newId}-icon`)).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('§15.1-13 刪除確認窗顯示「已用在 N 筆紀錄」', () => {
  it('左滑露出刪除鍵', async () => {
    await openApp();
    const target = expenseCats()[0]!;
    await openCategories();

    expect(screen.getByTestId(`cat-${target.id}-delete`)).toHaveAttribute('tabindex', '-1');
    swipeOpen(`cat-${target.id}`);
    await waitFor(() =>
      expect(screen.getByTestId(`cat-${target.id}-delete`)).toHaveAttribute('tabindex', '0'));
  });

  it('N 等於實際用到那個分類的筆數', async () => {
    await openApp();
    const target = expenseCats()[0]!;
    const other = expenseCats()[1]!;

    // 兩筆記在 target、一筆記在 other
    await addEntry('10');
    await addEntry('20');
    fireEvent.click(screen.getByTestId('fab'));
    fireEvent.click(screen.getByTestId('key-3'));
    fireEvent.click(screen.getByTestId(`main-${other.id}`));
    fireEvent.click(screen.getByTestId(`sub-${other.subs[0]!.id}`));
    fireEvent.click(screen.getByTestId('key-save'));
    await waitFor(() => expect(useLedger.getState().txns).toHaveLength(3));

    await openCategories();
    fireEvent.click(screen.getByTestId(`cat-${target.id}-delete`));
    expect(screen.getByTestId('cat-delete-confirm-subject')).toHaveTextContent('已用在 2 筆紀錄');

    fireEvent.click(screen.getByTestId('cat-delete-confirm-cancel'));
    fireEvent.click(screen.getByTestId(`cat-${other.id}-delete`));
    expect(screen.getByTestId('cat-delete-confirm-subject')).toHaveTextContent('已用在 1 筆紀錄');
  });

  it('沒用過的分類顯示 0 筆', async () => {
    await openApp();
    const target = expenseCats()[2]!;
    await openCategories();
    fireEvent.click(screen.getByTestId(`cat-${target.id}-delete`));
    expect(screen.getByTestId('cat-delete-confirm-subject')).toHaveTextContent('已用在 0 筆紀錄');
  });
});

describe('§15.1-14 刪除分類後歷史紀錄與統計金額完全不變', () => {
  it('分類消失於記帳選單，但帳與總額一分不差', async () => {
    await openApp();
    const target = expenseCats()[0]!;
    await addEntry('10');
    await addEntry('20');

    // 先等 count-up 落定再取基準值，否則取到的是動畫中途的數字
    await waitFor(() => expect(screen.getByTestId('card-expense')).toHaveTextContent('$30'));
    const expenseBefore = screen.getByTestId('card-expense').textContent;
    const netBefore = screen.getByTestId('card-net').textContent;
    const rowsBefore = screen.getByTestId('txn-list').textContent;

    await openCategories();
    fireEvent.click(screen.getByTestId(`cat-${target.id}-delete`));
    fireEvent.click(screen.getByTestId('cat-delete-confirm-confirm'));
    // 假刪：列還在 categories 裡（才能解析歷史紀錄的分類名），但 active 轉 false
    await waitFor(() =>
      expect(useLedger.getState().categories.find((c) => c.id === target.id)!.active).toBe(false));

    fireEvent.click(screen.getByTestId('categories-back'));
    await goTab('daily');

    // 帳還在，金額與分類名稱都沒被動過
    expect(useLedger.getState().txns).toHaveLength(2);
    expect(screen.getByTestId('txn-list').textContent).toBe(rowsBefore);
    await waitFor(() => {
      expect(screen.getByTestId('card-expense').textContent).toBe(expenseBefore);
      expect(screen.getByTestId('card-net').textContent).toBe(netBefore);
    });

    // 但記帳選單裡選不到了
    fireEvent.click(screen.getByTestId('fab'));
    expect(screen.queryByTestId(`main-${target.id}`)).not.toBeInTheDocument();
  });
});

describe('§15.1-15 子分類只剩一個時不可刪除', () => {
  it('剩一個時 chip 被停用，兩個以上才刪得掉', async () => {
    await openApp();
    const many = expenseCats().find((c) => c.subs.length > 1)!;
    const one = expenseCats().find((c) => c.subs.length === 1);
    await openCategories();

    expect(screen.getByTestId(`sub-${many.subs[0]!.id}`)).not.toBeDisabled();

    if (one) {
      expect(screen.getByTestId(`sub-${one.subs[0]!.id}`)).toBeDisabled();
    } else {
      // 種子資料沒有單一子分類的分類時，自己刪到剩一個再驗
      for (const s of many.subs.slice(1)) {
        fireEvent.click(screen.getByTestId(`sub-${s.id}`));
        await waitFor(() => expect(screen.queryByTestId(`sub-${s.id}`)).not.toBeInTheDocument());
      }
      expect(screen.getByTestId(`sub-${many.subs[0]!.id}`)).toBeDisabled();
    }
  });
});
