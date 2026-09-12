import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

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
  title: '刪除這筆紀錄？',
  description: '刪除後無法復原，對方的手機也會同步移除。',
  confirmLabel: '刪除',
  onConfirm: () => {},
  onCancel: () => {},
};

describe('ConfirmDialog', () => {
  it('顯示標題、說明與兩顆鍵', () => {
    render(<ConfirmDialog {...BASE} />);
    expect(screen.getByTestId('confirm')).toHaveTextContent('刪除這筆紀錄？');
    expect(screen.getByTestId('confirm')).toHaveTextContent('刪除後無法復原，對方的手機也會同步移除。');
    expect(screen.getByTestId('confirm-cancel')).toHaveTextContent('取消');
    expect(screen.getByTestId('confirm-confirm')).toHaveTextContent('刪除');
  });

  it('顯示被刪的是哪一筆（§5：分類·子分類與金額）', () => {
    render(<ConfirmDialog {...BASE} subject={<span>外食 · 飲料　-$12.50</span>} />);
    expect(screen.getByTestId('confirm-subject')).toHaveTextContent('外食 · 飲料');
    expect(screen.getByTestId('confirm-subject')).toHaveTextContent('-$12.50');
  });

  it('沒有 subject 時不渲染那一塊', () => {
    render(<ConfirmDialog {...BASE} />);
    expect(screen.queryByTestId('confirm-subject')).not.toBeInTheDocument();
  });

  it('是 alertdialog 且有無障礙名稱', () => {
    render(<ConfirmDialog {...BASE} />);
    const box = screen.getByRole('alertdialog');
    expect(box).toHaveAttribute('aria-modal', 'true');
    expect(box).toHaveAccessibleName('刪除這筆紀錄？');
  });
});

describe('ConfirmDialog 的兩個出口', () => {
  it('取消回報取消', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...BASE} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('confirm-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('確認回報確認', () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...BASE} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('confirm-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('點遮罩等同取消', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...BASE} onCancel={onCancel} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('confirm-scrim'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('點窗內不會誤觸取消', () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...BASE} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('confirm'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe('ConfirmDialog 的進場（MOTION #37）', () => {
  it('reduced-motion 時不掛進場動畫', () => {
    stubMotion(true);
    render(<ConfirmDialog {...BASE} />);
    // 只剩基底類別，沒有動畫類別
    expect(screen.getByTestId('confirm').className.split(' ')).toHaveLength(1);
    expect(screen.getByTestId('confirm-scrim').className.split(' ')).toHaveLength(1);
  });

  it('一般情況下掛上進場動畫', () => {
    render(<ConfirmDialog {...BASE} />);
    expect(screen.getByTestId('confirm').className.split(' ')).toHaveLength(2);
  });
});
