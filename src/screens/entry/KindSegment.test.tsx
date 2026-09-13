import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { segmentLeft, segmentWidth } from '../../components/SegmentedControl';
import { KindSegment } from './KindSegment';

function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  }));
}

beforeEach(() => stubMotion(false));
afterEach(() => vi.unstubAllGlobals());

describe('segmentLeft', () => {
  // 扣掉容器 4px 內距與 4px 按鈕間距（原型 left:4px、width:calc(50% - 6px)）
  it('兩等寬', () => {
    expect(segmentLeft(0, 2)).toBe('calc(0% + 4px)');
    expect(segmentLeft(1, 2)).toBe('calc(50% + 2px)');
    expect(segmentWidth(2)).toBe('calc(50% - 6px)');
  });

  it('三等寬（原型 calc((100% - 16px)/3)，每往右一格再加一個間距）', () => {
    expect(segmentLeft(1, 3)).toBe('calc(33.3333% + 2.66667px)');
    expect(segmentLeft(2, 3)).toBe('calc(66.6667% + 1.33333px)');
    expect(segmentWidth(3)).toBe('calc(33.3333% - 5.33333px)');
  });
});

describe('KindSegment', () => {
  it('兩段：支出、收入', () => {
    render(<KindSegment kind="expense" onChange={() => {}} />);
    expect(screen.getByTestId('kind-expense')).toHaveTextContent('支出');
    expect(screen.getByTestId('kind-income')).toHaveTextContent('收入');
  });

  it('選中的那段標成 aria-pressed', () => {
    render(<KindSegment kind="income" onChange={() => {}} />);
    expect(screen.getByTestId('kind-income')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('kind-expense')).toHaveAttribute('aria-pressed', 'false');
  });

  it('點另一段會回報', () => {
    const onChange = vi.fn();
    render(<KindSegment kind="expense" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('kind-income'));
    expect(onChange).toHaveBeenCalledWith('income');
  });
});

describe('KindSegment 的滑塊（MOTION #36）', () => {
  it('滑塊位移到選中那段，而不是每段自己變底色', () => {
    const { rerender } = render(<KindSegment kind="expense" onChange={() => {}} />);
    expect(screen.getByTestId('kind-slider').style.left).toBe(segmentLeft(0, 2));
    rerender(<KindSegment kind="income" onChange={() => {}} />);
    expect(screen.getByTestId('kind-slider').style.left).toBe(segmentLeft(1, 2));
  });

  it('底色支出紫、收入粉', () => {
    const { rerender } = render(<KindSegment kind="expense" onChange={() => {}} />);
    expect(screen.getByTestId('kind-slider')).toHaveStyle({ background: '#B7A6E5' });
    rerender(<KindSegment kind="income" onChange={() => {}} />);
    expect(screen.getByTestId('kind-slider')).toHaveStyle({ background: '#DDA6D0' });
  });

  it('reduced-motion 時不做位移與變色動畫', () => {
    stubMotion(true);
    render(<KindSegment kind="expense" onChange={() => {}} />);
    expect(screen.getByTestId('kind-slider')).toHaveStyle({ transition: 'none' });
  });
});
