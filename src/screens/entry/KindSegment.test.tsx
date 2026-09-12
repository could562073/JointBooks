import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { segmentLeft } from '../../components/SegmentedControl';
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
  it('兩等寬', () => {
    expect(segmentLeft(0, 2)).toBe('0.0000%');
    expect(segmentLeft(1, 2)).toBe('50.0000%');
  });

  it('三等寬', () => {
    expect(segmentLeft(1, 3)).toBe('33.3333%');
    expect(segmentLeft(2, 3)).toBe('66.6667%');
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
    expect(screen.getByTestId('kind-slider')).toHaveStyle({ left: '0.0000%' });
    rerender(<KindSegment kind="income" onChange={() => {}} />);
    expect(screen.getByTestId('kind-slider')).toHaveStyle({ left: '50.0000%' });
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
