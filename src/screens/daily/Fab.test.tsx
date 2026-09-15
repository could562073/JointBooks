import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Fab } from './Fab';

describe('Fab', () => {
  it('點了會回報', () => {
    const onClick = vi.fn();
    render(<Fab onClick={onClick} />);
    fireEvent.click(screen.getByTestId('fab'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('有無障礙名稱', () => {
    render(<Fab onClick={() => {}} />);
    expect(screen.getByLabelText('記一筆')).toBeInTheDocument();
  });

  // MOTION #28：按住縮到 .92，鬆手回彈
  it('按住時縮小，鬆手回原尺寸', () => {
    render(<Fab onClick={() => {}} />);
    const fab = screen.getByTestId('fab');
    expect(fab).toHaveStyle({ transform: 'none' });

    fireEvent.pointerDown(fab);
    expect(fab).toHaveStyle({ transform: 'scale(.92)' });

    fireEvent.pointerUp(fab);
    expect(fab).toHaveStyle({ transform: 'none' });
  });

  it('手指滑出按鈕也要回彈，不會卡在按下的樣子', () => {
    render(<Fab onClick={() => {}} />);
    const fab = screen.getByTestId('fab');
    fireEvent.pointerDown(fab);
    fireEvent.pointerLeave(fab);
    expect(fab).toHaveStyle({ transform: 'none' });
  });

  // 外觀（漸層、inset 高光、髮絲邊、無投射陰影）驗不到：CSS Modules 的樣式
  // 在 jsdom 下不會套用，getComputedStyle 拿回來是空字串。真實瀏覽器由 e2e/daily.spec.ts（D13）量。
});
