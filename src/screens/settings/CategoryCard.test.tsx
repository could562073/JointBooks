import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defaultCategories } from '../../domain/categories';
import type { Category } from '../../domain/types';
import { CategoryCard } from './CategoryCard';

let n = 0;
const CATS: Category[] = defaultCategories(() => `id-${n++}`);
const ONE_SUB = CATS.find((c) => c.kind === 'expense' && c.subs.length === 1)!;
const MULTI = CATS.find((c) => c.subs.length > 1)!;

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

const BASE = { onChange: () => {}, onDelete: () => {} };

describe('CategoryCard 的圖示選擇器（MOTION #18）', () => {
  it('預設不展開', () => {
    render(<CategoryCard {...BASE} category={MULTI} />);
    expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();
  });

  it('點圖示展開 15 顆', () => {
    render(<CategoryCard {...BASE} category={MULTI} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-icon`));
    expect(screen.getByTestId('icon-picker').children).toHaveLength(15);
  });

  it('目前的圖示標成選中', () => {
    render(<CategoryCard {...BASE} category={MULTI} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-icon`));
    expect(screen.getByTestId(`icon-${MULTI.icon}`)).toHaveAttribute('aria-pressed', 'true');
  });

  it('選完回報新圖示並收合', () => {
    const onChange = vi.fn();
    render(<CategoryCard {...BASE} category={MULTI} onChange={onChange} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-icon`));
    fireEvent.click(screen.getByTestId('icon-pill'));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ icon: 'pill' }));
    expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();
  });
});

describe('CategoryCard 的就地編輯（MOTION #19）', () => {
  it('點分類名變輸入欄，✓ 存', () => {
    const onChange = vi.fn();
    render(<CategoryCard {...BASE} category={MULTI} onChange={onChange} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-name`));
    fireEvent.change(screen.getByTestId(`cat-${MULTI.id}-name-input`), { target: { value: '飲食' } });
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-name-ok`));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ name: '飲食' }));
  });

  it('✕ 取消不改', () => {
    const onChange = vi.fn();
    render(<CategoryCard {...BASE} category={MULTI} onChange={onChange} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-name`));
    fireEvent.change(screen.getByTestId(`cat-${MULTI.id}-name-input`), { target: { value: '飲食' } });
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-name-cancel`));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('空白視為取消，不會存成沒有名字的分類', () => {
    const onChange = vi.fn();
    render(<CategoryCard {...BASE} category={MULTI} onChange={onChange} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-name`));
    fireEvent.change(screen.getByTestId(`cat-${MULTI.id}-name-input`), { target: { value: '   ' } });
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-name-ok`));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('點金額 pill 改預算，存的是整數分', () => {
    const onChange = vi.fn();
    render(<CategoryCard {...BASE} category={MULTI} onChange={onChange} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-budget`));
    fireEvent.change(screen.getByTestId(`cat-${MULTI.id}-budget-input`), { target: { value: '520.5' } });
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-budget-ok`));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ budgetCents: 52_050 }));
  });

  it('剛新增的分類名稱欄自動進入編輯（MOTION #17）', () => {
    render(<CategoryCard {...BASE} category={MULTI} autoEditName />);
    expect(screen.getByTestId(`cat-${MULTI.id}-name-input`)).toBeInTheDocument();
  });

  it('新增時不自動展開圖示選擇器（§7.2 明列）', () => {
    render(<CategoryCard {...BASE} category={MULTI} autoEditName />);
    expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();
  });
});

describe('CategoryCard 的子分類', () => {
  it('點 chip 刪掉那個子分類', () => {
    const onChange = vi.fn();
    render(<CategoryCard {...BASE} category={MULTI} onChange={onChange} />);
    fireEvent.click(screen.getByTestId(`sub-${MULTI.subs[0]!.id}`));

    const next = onChange.mock.calls[0]![0] as Category;
    expect(next.subs.map((s) => s.id)).not.toContain(MULTI.subs[0]!.id);
  });

  it('只剩一個子分類時不給刪（§11-6）', () => {
    render(<CategoryCard {...BASE} category={ONE_SUB} />);
    expect(screen.getByTestId(`sub-${ONE_SUB.subs[0]!.id}`)).toBeDisabled();
  });

  it('「＋ 子分類」點一下就能打字，不用點兩次', () => {
    render(<CategoryCard {...BASE} category={MULTI} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-addsub`));
    expect(screen.getByTestId(`cat-${MULTI.id}-newsub-input`)).toBeInTheDocument();
  });

  it('新增子分類', () => {
    const onChange = vi.fn();
    render(<CategoryCard {...BASE} category={MULTI} onChange={onChange} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-addsub`));
    fireEvent.change(screen.getByTestId(`cat-${MULTI.id}-newsub-input`), { target: { value: '宵夜' } });
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-newsub-ok`));

    const next = onChange.mock.calls[0]![0] as Category;
    expect(next.subs.map((s) => s.name)).toContain('宵夜');
  });

  it('重名的子分類不會被加進去', () => {
    const onChange = vi.fn();
    render(<CategoryCard {...BASE} category={MULTI} onChange={onChange} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-addsub`));
    fireEvent.change(screen.getByTestId(`cat-${MULTI.id}-newsub-input`), {
      target: { value: MULTI.subs[0]!.name },
    });
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-newsub-ok`));

    const next = onChange.mock.calls[0]![0] as Category;
    expect(next.subs).toHaveLength(MULTI.subs.length);
  });
});

describe('CategoryCard 的刪除鍵', () => {
  it('按刪除鍵把整個分類回報出去，交給外層跳確認窗', () => {
    const onDelete = vi.fn();
    render(<CategoryCard {...BASE} category={MULTI} onDelete={onDelete} />);
    fireEvent.click(screen.getByTestId(`cat-${MULTI.id}-delete`));
    expect(onDelete).toHaveBeenCalledWith(MULTI);
  });

  it('卡片沒滑開時刪除鍵不在 tab 順序裡', () => {
    render(<CategoryCard {...BASE} category={MULTI} />);
    expect(screen.getByTestId(`cat-${MULTI.id}-delete`)).toHaveAttribute('tabindex', '-1');
  });
});
