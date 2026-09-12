import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { defaultCategories } from '../../domain/categories';
import type { Category } from '../../domain/types';
import { CategoryPicker } from './CategoryPicker';

let n = 0;
const CATS: Category[] = defaultCategories(() => `id-${n++}`);
const EXPENSE = CATS.filter((c) => c.kind === 'expense');
const INCOME = CATS.filter((c) => c.kind === 'income');

const BASE = {
  categories: CATS,
  kind: 'expense' as const,
  mainId: EXPENSE[0]!.id,
  subId: EXPENSE[0]!.subs[0]!.id,
  onPickMain: () => {},
  onPickSub: () => {},
  onAddMain: () => 'new-main',
  onAddSub: () => 'new-sub',
};

describe('CategoryPicker 的 chip', () => {
  it('主分類只列該 kind 的分類', () => {
    render(<CategoryPicker {...BASE} />);
    for (const c of EXPENSE) expect(screen.getByTestId(`main-${c.id}`)).toBeInTheDocument();
    for (const c of INCOME) expect(screen.queryByTestId(`main-${c.id}`)).not.toBeInTheDocument();
  });

  it('切到收入時只列收入分類（增補檔 B-2）', () => {
    render(
      <CategoryPicker {...BASE} kind="income" mainId={INCOME[0]!.id} subId={INCOME[0]!.subs[0]!.id} />
    );
    expect(screen.getByTestId(`main-${INCOME[0]!.id}`)).toBeInTheDocument();
    expect(screen.queryByTestId(`main-${EXPENSE[0]!.id}`)).not.toBeInTheDocument();
  });

  it('子分類列的是目前主分類底下的', () => {
    render(<CategoryPicker {...BASE} />);
    for (const s of EXPENSE[0]!.subs) expect(screen.getByTestId(`sub-${s.id}`)).toBeInTheDocument();
  });

  it('選中的主分類與子分類都標成 aria-pressed', () => {
    render(<CategoryPicker {...BASE} />);
    expect(screen.getByTestId(`main-${EXPENSE[0]!.id}`)).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId(`sub-${EXPENSE[0]!.subs[0]!.id}`)).toHaveAttribute('aria-pressed', 'true');
  });

  it('點 chip 會回報', () => {
    const onPickMain = vi.fn();
    const onPickSub = vi.fn();
    // 第一個支出分類（租屋）只有一個子分類，用有多個子分類的那個才驗得到「換子分類」
    const multi = EXPENSE.find((c) => c.subs.length > 1)!;
    render(
      <CategoryPicker
        {...BASE} mainId={multi.id} subId={multi.subs[0]!.id}
        onPickMain={onPickMain} onPickSub={onPickSub}
      />
    );
    fireEvent.click(screen.getByTestId(`main-${EXPENSE[1]!.id}`));
    expect(onPickMain).toHaveBeenCalledWith(EXPENSE[1]!.id);
    fireEvent.click(screen.getByTestId(`sub-${multi.subs[1]!.id}`));
    expect(onPickSub).toHaveBeenCalledWith(multi.subs[1]!.id);
  });

  it('主分類被刪掉時子分類區是空的，不會炸掉', () => {
    render(<CategoryPicker {...BASE} mainId="gone" />);
    expect(screen.getByTestId('sub-chips')).toBeInTheDocument();
    expect(screen.getByTestId('add-sub')).toBeInTheDocument();
  });
});

describe('CategoryPicker 的就地新增', () => {
  it('點「＋ 新增」換成輸入欄', () => {
    render(<CategoryPicker {...BASE} />);
    expect(screen.queryByTestId('category-input')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('add-main'));
    expect(screen.getByTestId('category-input')).toBeInTheDocument();
  });

  it('按 Enter 建立並立即選中（§5：就地建立後立即可選）', async () => {
    const onAddMain = vi.fn(() => 'created-id');
    const onPickMain = vi.fn();
    render(<CategoryPicker {...BASE} onAddMain={onAddMain} onPickMain={onPickMain} />);

    fireEvent.click(screen.getByTestId('add-main'));
    fireEvent.change(screen.getByTestId('category-input'), { target: { value: '寵物' } });
    fireEvent.keyDown(screen.getByTestId('category-input'), { key: 'Enter' });

    expect(onAddMain).toHaveBeenCalledWith('寵物');
    await vi.waitFor(() => expect(onPickMain).toHaveBeenCalledWith('created-id'));
  });

  it('子分類同樣可以就地新增', async () => {
    const onAddSub = vi.fn(() => 'created-sub');
    const onPickSub = vi.fn();
    render(<CategoryPicker {...BASE} onAddSub={onAddSub} onPickSub={onPickSub} />);

    fireEvent.click(screen.getByTestId('add-sub'));
    fireEvent.change(screen.getByTestId('category-input'), { target: { value: '飼料' } });
    fireEvent.keyDown(screen.getByTestId('category-input'), { key: 'Enter' });

    expect(onAddSub).toHaveBeenCalledWith('飼料');
    await vi.waitFor(() => expect(onPickSub).toHaveBeenCalledWith('created-sub'));
  });

  it('Esc 放棄，不會建立任何東西', () => {
    const onAddMain = vi.fn();
    render(<CategoryPicker {...BASE} onAddMain={onAddMain} />);
    fireEvent.click(screen.getByTestId('add-main'));
    fireEvent.change(screen.getByTestId('category-input'), { target: { value: '寵物' } });
    fireEvent.keyDown(screen.getByTestId('category-input'), { key: 'Escape' });
    expect(onAddMain).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-main')).toBeInTheDocument();
  });

  it('名稱留空時不建立空分類', () => {
    const onAddMain = vi.fn();
    render(<CategoryPicker {...BASE} onAddMain={onAddMain} />);
    fireEvent.click(screen.getByTestId('add-main'));
    fireEvent.change(screen.getByTestId('category-input'), { target: { value: '   ' } });
    fireEvent.keyDown(screen.getByTestId('category-input'), { key: 'Enter' });
    expect(onAddMain).not.toHaveBeenCalled();
  });
});
