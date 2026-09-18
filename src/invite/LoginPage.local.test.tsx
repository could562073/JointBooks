import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage 的「先不登入，直接使用」', () => {
  it('有接上時顯示，按了回報', () => {
    const onUseLocally = vi.fn();
    render(<LoginPage onSignIn={() => {}} onUseLocally={onUseLocally} />);
    fireEvent.click(screen.getByTestId('login-local'));
    expect(onUseLocally).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('login-local-hint')).toHaveTextContent('帳只存在這台手機');
  });

  it('沒接上時不顯示', () => {
    render(<LoginPage onSignIn={() => {}} />);
    expect(screen.queryByTestId('login-local')).not.toBeInTheDocument();
  });

  it('正在確認建立帳本時收起來，連線中停用', () => {
    const { rerender } = render(<LoginPage onSignIn={() => {}} onUseLocally={() => {}} />);
    fireEvent.click(screen.getByTestId('login-google'));
    expect(screen.queryByTestId('login-local')).not.toBeInTheDocument();
    rerender(<LoginPage onSignIn={() => {}} onUseLocally={() => {}} busy />);
    expect(screen.getByTestId('login-local')).toBeDisabled();
  });
});
