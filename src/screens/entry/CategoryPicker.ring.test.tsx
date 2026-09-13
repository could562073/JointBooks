import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultCategories, selectable } from '../../domain/categories';
import type { CategoryKind } from '../../domain/types';
import { CategoryPicker } from './CategoryPicker';

let n = 0;
const CATS = defaultCategories(() => `c-${n++}`);

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

function Harness({ kind }: { kind: CategoryKind }) {
  const mains = selectable(CATS, kind);
  const [picked, setPicked] = useState<string | null>(null);
  const mainId = picked && mains.some((c) => c.id === picked) ? picked : mains[0]!.id;
  return (
    <CategoryPicker
      categories={CATS} kind={kind} mainId={mainId} subId=""
      onPickMain={setPicked} onPickSub={() => {}}
      onAddMain={() => ''} onAddSub={() => ''}
    />
  );
}

describe('主分類的選中外圈（滑動）', () => {
  it('只有一塊，跟著選中的主分類走', () => {
    render(<Harness kind="expense" />);
    const [first, second] = selectable(CATS, 'expense');
    expect(screen.getAllByTestId('main-ring')).toHaveLength(1);
    expect(screen.getByTestId('main-ring')).toHaveAttribute('data-for', first!.id);

    fireEvent.click(screen.getByTestId(`main-${second!.id}`));
    expect(screen.getAllByTestId('main-ring')).toHaveLength(1);
    expect(screen.getByTestId('main-ring')).toHaveAttribute('data-for', second!.id);
  });

  it('剛打開時直接到位；換分類才滑過去', () => {
    render(<Harness kind="expense" />);
    expect(screen.getByTestId('main-ring').style.transition).toBe('none');

    const [, second] = selectable(CATS, 'expense');
    fireEvent.click(screen.getByTestId(`main-${second!.id}`));
    expect(screen.getByTestId('main-ring').style.transition).toContain('transform');
  });

  it('換收支時整排 chip 都換了：外圈直接到位，不從舊位置滑過來', () => {
    const { rerender } = render(<Harness kind="expense" />);
    const [, second] = selectable(CATS, 'expense');
    fireEvent.click(screen.getByTestId(`main-${second!.id}`));

    rerender(<Harness kind="income" />);
    expect(screen.getByTestId('main-ring').style.transition).toBe('none');
    expect(screen.getByTestId('main-ring')).toHaveAttribute('data-for', selectable(CATS, 'income')[0]!.id);
  });
});
