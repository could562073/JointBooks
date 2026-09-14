import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginPage } from './LoginPage';

describe('登入頁的兩條路：建立自己的帳本／加入別人的帳本', () => {
  it('建立帳本要先確認；確認畫面提醒對方建好的話改用邀請連結，確認後才叫 Google 視窗', () => {
    const onSignIn = vi.fn();
    render(<LoginPage onSignIn={onSignIn} onJoinLink={() => {}} />);
    expect(screen.getByTestId('login-google')).toHaveTextContent('建立我的帳本');

    fireEvent.click(screen.getByTestId('login-google'));
    expect(onSignIn).not.toHaveBeenCalled();
    expect(screen.getByTestId('login-create-confirm')).toHaveTextContent('邀請連結加入');

    fireEvent.click(screen.getByTestId('login-create-go'));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('確認時改選「我有邀請連結」：打開貼連結的欄位，不建立帳本', () => {
    const onSignIn = vi.fn();
    render(<LoginPage onSignIn={onSignIn} onJoinLink={() => {}} />);
    fireEvent.click(screen.getByTestId('login-google'));
    fireEvent.click(screen.getByTestId('login-create-has-link'));
    expect(screen.getByTestId('login-join-form')).toBeInTheDocument();
    expect(screen.queryByTestId('login-create-confirm')).not.toBeInTheDocument();
    expect(onSignIn).not.toHaveBeenCalled();
  });

  it('取消就回到原本的兩顆按鈕', () => {
    render(<LoginPage onSignIn={() => {}} onJoinLink={() => {}} />);
    fireEvent.click(screen.getByTestId('login-google'));
    fireEvent.click(screen.getByTestId('login-create-cancel'));
    expect(screen.getByTestId('login-google')).toBeInTheDocument();
    expect(screen.getByTestId('login-join-toggle')).toHaveTextContent('加入別人的帳本');
  });
});
