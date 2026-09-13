import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage 的連線狀態', () => {
  it('連線中：按鈕停用並顯示「連線中…」，避免連按叫出好幾個 Google 視窗', () => {
    render(<LoginPage onSignIn={() => {}} busy />);
    expect(screen.getByTestId('login-google')).toBeDisabled();
    expect(screen.getByTestId('login-google')).toHaveTextContent('連線中…');
  });

  it('顯示錯誤訊息', () => {
    render(<LoginPage onSignIn={() => {}} error="彈出視窗被擋住了" />);
    expect(screen.getByTestId('login-error')).toHaveTextContent('彈出視窗被擋住了');
  });

  it('權限說明寫的是試算表，跟實際要求的範圍一致', () => {
    render(<LoginPage onSignIn={() => {}} />);
    expect(screen.getByTestId('login-scope')).toHaveTextContent('Google 試算表');
  });
});

describe('LoginPage 的「貼上邀請連結」', () => {
  it('沒接上加入功能時不顯示', () => {
    render(<LoginPage onSignIn={() => {}} />);
    expect(screen.queryByTestId('login-join-toggle')).not.toBeInTheDocument();
  });

  it('展開後貼上連結送出，交出去的是去掉空白的連結', () => {
    const onJoinLink = vi.fn();
    render(<LoginPage onSignIn={() => {}} onJoinLink={onJoinLink} />);
    fireEvent.click(screen.getByTestId('login-join-toggle'));
    fireEvent.change(screen.getByTestId('login-join-input'), {
      target: { value: '  https://x.example/join?sid=S&t=1.a ' },
    });
    fireEvent.submit(screen.getByTestId('login-join-form'));
    expect(onJoinLink).toHaveBeenCalledWith('https://x.example/join?sid=S&t=1.a');
  });

  it('空白送出不動作', () => {
    const onJoinLink = vi.fn();
    render(<LoginPage onSignIn={() => {}} onJoinLink={onJoinLink} />);
    fireEvent.click(screen.getByTestId('login-join-toggle'));
    fireEvent.submit(screen.getByTestId('login-join-form'));
    expect(onJoinLink).not.toHaveBeenCalled();
  });
});
