import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { joinStateOf } from './joinFlow';
import { JoinPage } from './JoinPage';

const HANDLERS = { onJoin: () => {}, onBrowse: () => {}, onHome: () => {} };
const check = { kind: 'ok', sid: 'THEIRS', expiresAt: 9 } as const;

describe('這台已經有自己的帳本，又用邀請連結加入別人的', () => {
  it('狀態標成 switching；還沒有帳本的就不是', () => {
    expect(joinStateOf({ check, joinedSid: 'MINE' })).toEqual({ kind: 'invite', sid: 'THEIRS', switching: true });
    expect(joinStateOf({ check, joinedSid: null })).toEqual({ kind: 'invite', sid: 'THEIRS' });
  });

  it('邀請頁提醒：加入後改記這一本，原本的紀錄不會搬進來', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'invite', sid: 'THEIRS', switching: true }} />);
    expect(screen.getByTestId('join-switch-note')).toHaveTextContent('不會搬進來');
  });

  it('第一次加入的人不會看到這段提醒', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'invite', sid: 'THEIRS' }} />);
    expect(screen.queryByTestId('join-switch-note')).not.toBeInTheDocument();
  });
});
