import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FieldRow } from './FieldRow';

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

const BASE = {
  label: '日期',
  value: '2026年9月6日',
  onToggle: () => {},
  testId: 'date-row',
  children: <div data-testid="inner">內容</div>,
};

describe('FieldRow', () => {
  it('收起時顯示小標與目前值，內容不渲染', () => {
    render(<FieldRow {...BASE} open={false} />);
    expect(screen.getByTestId('date-row')).toHaveTextContent('日期');
    expect(screen.getByTestId('date-row')).toHaveTextContent('2026年9月6日');
    expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
  });

  it('展開時渲染內容', () => {
    render(<FieldRow {...BASE} open />);
    expect(screen.getByTestId('inner')).toBeInTheDocument();
    expect(screen.getByTestId('date-row-panel')).toBeInTheDocument();
  });

  it('點摘要列回報切換', () => {
    const onToggle = vi.fn();
    render(<FieldRow {...BASE} open={false} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('date-row'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('aria-expanded 跟著狀態', () => {
    const { rerender } = render(<FieldRow {...BASE} open={false} />);
    expect(screen.getByTestId('date-row')).toHaveAttribute('aria-expanded', 'false');
    rerender(<FieldRow {...BASE} open />);
    expect(screen.getByTestId('date-row')).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('FieldRow 的 ▾（MOTION #38）', () => {
  it('展開時轉 180°，收起時轉回來', () => {
    const { rerender } = render(<FieldRow {...BASE} open={false} />);
    expect(screen.getByTestId('date-row-chevron')).toHaveStyle({ transform: 'none' });
    rerender(<FieldRow {...BASE} open />);
    expect(screen.getByTestId('date-row-chevron')).toHaveStyle({ transform: 'rotate(180deg)' });
  });

  it('reduced-motion 時不做旋轉動畫', () => {
    stubMotion(true);
    render(<FieldRow {...BASE} open={false} />);
    expect(screen.getByTestId('date-row-chevron')).toHaveStyle({ transition: 'none' });
  });

  it('reduced-motion 時展開面板不掛進場動畫', () => {
    stubMotion(true);
    render(<FieldRow {...BASE} open />);
    expect(screen.getByTestId('date-row-panel').className).toBe('');
  });
});
