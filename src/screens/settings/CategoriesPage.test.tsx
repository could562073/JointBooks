import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultCategories } from '../../domain/categories';
import type { Category, Txn } from '../../domain/types';
import { CategoriesPage, usageCount } from './CategoriesPage';

let n = 0;
const CATS: Category[] = defaultCategories(() => `id-${n++}`);
const EXPENSE = CATS.filter((c) => c.kind === 'expense');
const INCOME = CATS.filter((c) => c.kind === 'income');

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

function txn(over: Partial<Txn> = {}): Txn {
  return {
    id: `t${Math.random()}`, date: '2026-09-06',
    mainId: EXPENSE[0]!.id, subId: EXPENSE[0]!.subs[0]!.id,
    mainName: '租屋', subName: '租屋',
    amountCents: 1_000, currency: 'CAD', actualCadCents: 1_000,
    by: '我', note: '',
    createdAt: '2026-09-06T10:00:00.000Z', updatedAt: '2026-09-06T10:00:00.000Z',
    deleted: false,
    ...over,
  };
}

const BASE = {
  categories: CATS, txns: [] as Txn[],
  onSave: () => {}, onDelete: () => {}, onBack: () => {},
};

describe('usageCount', () => {
  it('數該分類用在幾筆紀錄上', () => {
    expect(usageCount([txn(), txn()], EXPENSE[0]!.id)).toBe(2);
  });

  it('已刪除的紀錄不算', () => {
    expect(usageCount([txn(), txn({ deleted: true })], EXPENSE[0]!.id)).toBe(1);
  });

  it('沒用過是 0', () => {
    expect(usageCount([txn()], EXPENSE[2]!.id)).toBe(0);
  });
});

describe('CategoriesPage 的版面', () => {
  it('標題列與提示行固定，只有清單捲動', () => {
    render(<CategoriesPage {...BASE} />);
    const page = screen.getByTestId('categories-page');
    const scroll = screen.getByTestId('categories-scroll');
    expect(page).toContainElement(scroll);
    expect(scroll).not.toBe(page);
    expect(scroll).toContainElement(screen.getByTestId('categories-list'));
  });

  it('按 ‹ 返回', () => {
    const onBack = vi.fn();
    render(<CategoriesPage {...BASE} onBack={onBack} />);
    fireEvent.click(screen.getByTestId('categories-back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('CategoriesPage 的支出／收入分段（增補檔 B-1）', () => {
  it('預設支出，只列支出分類', () => {
    render(<CategoriesPage {...BASE} />);
    expect(screen.getByTestId(`cat-${EXPENSE[0]!.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`cat-${INCOME[0]!.id}`)).not.toBeInTheDocument();
  });

  it('切到收入只列收入分類', () => {
    render(<CategoriesPage {...BASE} />);
    fireEvent.click(screen.getByTestId('catkind-income'));
    expect(screen.getByTestId(`cat-${INCOME[0]!.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`cat-${EXPENSE[0]!.id}`)).not.toBeInTheDocument();
  });

  it('切換時清單整區重掛，滑入動畫才會重播', () => {
    render(<CategoriesPage {...BASE} />);
    const before = screen.getByTestId('categories-list');
    fireEvent.click(screen.getByTestId('catkind-income'));
    expect(screen.getByTestId('categories-list')).not.toBe(before);
  });

  it('收入分類不顯示金額 pill（增補檔 B-2）', () => {
    render(<CategoriesPage {...BASE} />);
    expect(screen.getByTestId(`cat-${EXPENSE[0]!.id}-budget`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('catkind-income'));
    expect(screen.queryByTestId(`cat-${INCOME[0]!.id}-budget`)).not.toBeInTheDocument();
  });
});

describe('CategoriesPage 的新增分類（MOTION #17）', () => {
  it('新卡插入清單最上方，order 比現有的都小', () => {
    const onSave = vi.fn();
    render(<CategoriesPage {...BASE} onSave={onSave} />);
    fireEvent.click(screen.getByTestId('categories-add'));

    const created = onSave.mock.calls[0]![0] as Category;
    expect(created.order).toBeLessThan(Math.min(...CATS.map((c) => c.order)));
  });

  it('kind 跟隨當前分段（增補檔 B-1）', () => {
    const onSave = vi.fn();
    render(<CategoriesPage {...BASE} onSave={onSave} />);
    fireEvent.click(screen.getByTestId('catkind-income'));
    fireEvent.click(screen.getByTestId('categories-add'));
    expect((onSave.mock.calls[0]![0] as Category).kind).toBe('income');
  });

  it('預設圖示 bag、預算 $150、一個「其他」子分類（§11-5）', () => {
    const onSave = vi.fn();
    render(<CategoriesPage {...BASE} onSave={onSave} />);
    fireEvent.click(screen.getByTestId('categories-add'));

    const created = onSave.mock.calls[0]![0] as Category;
    expect(created.icon).toBe('bag');
    expect(created.budgetCents).toBe(15_000);
    expect(created.subs).toHaveLength(1);
  });
});

describe('CategoriesPage 的刪除（MOTION #16）', () => {
  it('按刪除鍵先跳確認窗，顯示已用在幾筆紀錄', () => {
    const onDelete = vi.fn();
    render(
      <CategoriesPage {...BASE} txns={[txn(), txn()]} onDelete={onDelete} />
    );
    fireEvent.click(screen.getByTestId(`cat-${EXPENSE[0]!.id}-delete`));

    expect(screen.getByTestId('cat-delete-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('cat-delete-confirm-subject')).toHaveTextContent('已用在 2 筆紀錄');
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('說明明示已記的帳不會被改動（§7.2）', () => {
    render(<CategoriesPage {...BASE} />);
    fireEvent.click(screen.getByTestId(`cat-${EXPENSE[0]!.id}-delete`));
    expect(screen.getByTestId('cat-delete-confirm'))
      .toHaveTextContent('刪除後已記的帳不會被改動也不會消失');
  });

  it('取消不刪', () => {
    const onDelete = vi.fn();
    render(<CategoriesPage {...BASE} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId(`cat-${EXPENSE[0]!.id}-delete`));
    fireEvent.click(screen.getByTestId('cat-delete-confirm-cancel'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByTestId('cat-delete-confirm')).not.toBeInTheDocument();
  });

  it('確認才真的刪', () => {
    const onDelete = vi.fn();
    render(<CategoriesPage {...BASE} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId(`cat-${EXPENSE[0]!.id}-delete`));
    fireEvent.click(screen.getByTestId('cat-delete-confirm-confirm'));
    expect(onDelete).toHaveBeenCalledWith(EXPENSE[0]!.id);
  });
});
