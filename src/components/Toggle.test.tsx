import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Toggle } from './Toggle';

afterEach(() => vi.unstubAllGlobals());

function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: reduced && q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
}

const BASE = { onChange: () => {}, label: '每筆顯示記帳人', testId: 'toggle' };

describe('Toggle', () => {
  it('是 switch 且有無障礙名稱', () => {
    render(<Toggle {...BASE} checked />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAccessibleName('每筆顯示記帳人');
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('關著時 aria-checked 是 false', () => {
    render(<Toggle {...BASE} checked={false} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('點了回報相反的值', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Toggle {...BASE} checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('toggle'));
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<Toggle {...BASE} checked onChange={onChange} />);
    fireEvent.click(screen.getByTestId('toggle'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});

describe('Toggle 的 knob（MOTION #21）', () => {
  it('開關切換時 knob 換位置', () => {
    const { rerender } = render(<Toggle {...BASE} checked={false} />);
    expect(screen.getByTestId('toggle-knob')).toHaveStyle({ left: '3px' });
    rerender(<Toggle {...BASE} checked />);
    expect(screen.getByTestId('toggle-knob')).toHaveStyle({ left: '22px' });
  });

  it('reduced-motion 時不做位移動畫', () => {
    stubMotion(true);
    render(<Toggle {...BASE} checked />);
    expect(screen.getByTestId('toggle-knob')).toHaveStyle({ transition: 'none' });
    expect(screen.getByTestId('toggle')).toHaveStyle({ transition: 'none' });
  });
});
