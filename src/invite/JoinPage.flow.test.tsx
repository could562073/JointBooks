import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JoinPage } from './JoinPage';

const HANDLERS = { onJoin: () => {}, onBrowse: () => {}, onHome: () => {} };

describe('JoinPage 的加入過程', () => {
  it('連線中：加入鍵停用並顯示「連線中…」', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'invite', sid: 'S' }} busy />);
    expect(screen.getByTestId('join-cta')).toBeDisabled();
    expect(screen.getByTestId('join-cta')).toHaveTextContent('連線中…');
  });

  it('加入失敗時把原因顯示出來', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'invite', sid: 'S' }} error="還讀不到這本帳" />);
    expect(screen.getByTestId('join-error')).toHaveTextContent('還讀不到這本帳');
  });

  it('沒有錯誤時不顯示錯誤區塊', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'invite', sid: 'S' }} />);
    expect(screen.queryByTestId('join-error')).not.toBeInTheDocument();
  });
});
