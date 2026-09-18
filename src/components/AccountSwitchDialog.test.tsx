import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AskPlan } from '../sync/account';
import { AccountSwitchDialog } from './AccountSwitchDialog';

const A = { id: 'PA', email: 'a@gmail.com' };
const plan = (over: Partial<AskPlan> = {}): AskPlan => ({
  kind: 'ask', from: 'old@gmail.com', to: A.email, target: 'OWN', self: '我', count: 3, canMerge: true, account: A, ...over,
});

describe('AccountSwitchDialog', () => {
  it('寫出幾筆帳、上次與這次的帳號，三個選擇各自回報', () => {
    const onChoose = vi.fn();
    render(<AccountSwitchDialog plan={plan()} onChoose={onChoose} />);
    const box = screen.getByTestId('account-switch');
    expect(box).toHaveTextContent('這台手機上有 3 筆帳');
    expect(box).toHaveTextContent('old@gmail.com');
    expect(box).toHaveTextContent('a@gmail.com');

    fireEvent.click(screen.getByTestId('account-switch-merge'));
    fireEvent.click(screen.getByTestId('account-switch-cloud'));
    fireEvent.click(screen.getByTestId('account-switch-cancel'));
    expect(onChoose.mock.calls.map((c) => c[0])).toEqual(['merge', 'cloud', 'cancel']);
  });

  it('不能合併時沒有合併按鈕，並說明原因', () => {
    render(<AccountSwitchDialog plan={plan({ canMerge: false })} onChoose={() => {}} />);
    expect(screen.queryByTestId('account-switch-merge')).not.toBeInTheDocument();
    expect(screen.getByTestId('account-switch')).toHaveTextContent('兩個人記的');
  });

  it('這個帳號還沒有帳本：改用雲端的按鈕寫「開一本新的空帳本」', () => {
    render(<AccountSwitchDialog plan={plan({ target: null })} onChoose={() => {}} />);
    expect(screen.getByTestId('account-switch-cloud')).toHaveTextContent('開一本新的空帳本');
  });

  it('加入邀請時說的是對方的帳本', () => {
    render(<AccountSwitchDialog plan={plan({ self: '妻', target: 'INV', from: null })} onChoose={() => {}} />);
    expect(screen.getByTestId('account-switch-merge')).toHaveTextContent('對方的帳本');
  });

  it('處理中按鈕停用；顯示錯誤', () => {
    render(<AccountSwitchDialog plan={plan()} busy error="還讀不到這本帳" onChoose={() => {}} />);
    expect(screen.getByTestId('account-switch-merge')).toBeDisabled();
    expect(screen.getByTestId('account-switch-error')).toHaveTextContent('還讀不到這本帳');
  });
});
