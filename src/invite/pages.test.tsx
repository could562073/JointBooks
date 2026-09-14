import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JoinPage } from './JoinPage';
import { LoginPage } from './LoginPage';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
});
afterEach(() => vi.unstubAllGlobals());

describe('LoginPage（§8.3）', () => {
  it('標語、饅頭、Google 登入鍵、權限說明都在', () => {
    render(<LoginPage onSignIn={() => {}} />);
    expect(screen.getByTestId('login-page')).toHaveTextContent('饅頭共享，生活記帳本');
    expect(screen.getByTestId('login-mantou')).toBeInTheDocument();
    expect(screen.getByTestId('login-google')).toBeInTheDocument();
  });

  // 使用者裁決改用 spreadsheets 權限（她的 App 才讀得到你建的帳本），說明要跟著誠實
  it('權限說明與實際請求的範圍一致：讀寫 Google 試算表，不再宣稱只碰一份檔案', () => {
    render(<LoginPage onSignIn={() => {}} />);
    expect(screen.getByTestId('login-scope')).toHaveTextContent('讀寫 Google 試算表');
    expect(screen.getByTestId('login-scope')).not.toHaveTextContent('這一份試算表');
  });

  it('點了先確認，確認後才回報', () => {
    const onSignIn = vi.fn();
    render(<LoginPage onSignIn={onSignIn} />);
    fireEvent.click(screen.getByTestId('login-google'));
    expect(onSignIn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('login-create-go'));
    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it('未設定 client id 時停用並說明原因，不是點了沒反應', () => {
    render(<LoginPage onSignIn={() => {}} disabled />);
    expect(screen.getByTestId('login-google')).toBeDisabled();
    expect(screen.getByTestId('login-unconfigured')).toHaveTextContent('純本機模式');
  });
});

const HANDLERS = { onJoin: () => {}, onBrowse: () => {}, onHome: () => {} };

describe('JoinPage 的邀請卡（§8.3）', () => {
  it('顯示帳本名稱與權限 pill', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'invite', sid: 'S' }} />);
    expect(screen.getByTestId('join-card')).toHaveTextContent('加拿大共用記帳');
    expect(screen.getByTestId('join-card')).toHaveTextContent('加入後可新增與編輯所有紀錄');
  });

  it('列出「加入後會發生的事」三條', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'invite', sid: 'S' }} />);
    expect(screen.getByTestId('join-page').querySelectorAll('li')).toHaveLength(3);
  });

  it('主 CTA 與次要鍵都會回報', () => {
    const onJoin = vi.fn();
    const onBrowse = vi.fn();
    render(<JoinPage {...HANDLERS} state={{ kind: 'invite', sid: 'S' }} onJoin={onJoin} onBrowse={onBrowse} />);

    fireEvent.click(screen.getByTestId('join-cta'));
    expect(onJoin).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('join-browse'));
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });
});

describe('JoinPage 的四個分支（§8.1）', () => {
  it('已是成員：說「你已在這本帳裡」，CTA 換成進入帳本，沒有「暫不加入」', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'already', sid: 'S' }} />);
    expect(screen.getByTestId('join-already')).toHaveTextContent('你已在這本帳裡');
    expect(screen.getByTestId('join-cta')).toHaveTextContent('進入帳本');
    expect(screen.queryByTestId('join-browse')).not.toBeInTheDocument();
  });

  it('過期：顯示已失效，CTA 變成「回首頁」', () => {
    const onHome = vi.fn();
    render(<JoinPage {...HANDLERS} state={{ kind: 'expired' }} onHome={onHome} />);
    expect(screen.getByTestId('join-page')).toHaveTextContent('這個邀請已失效');
    fireEvent.click(screen.getByTestId('join-home'));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('簽章不符：同樣顯示已失效', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'invalid' }} />);
    expect(screen.getByTestId('join-page')).toHaveAttribute('data-state', 'invalid');
    expect(screen.getByTestId('join-home')).toBeInTheDocument();
  });

  it('唯讀試用：明說資料只存在這支手機上', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'browsing' }} />);
    expect(screen.getByTestId('join-page')).toHaveTextContent('只存在這支手機上');
  });

  it('失效狀態下不提供加入的入口', () => {
    render(<JoinPage {...HANDLERS} state={{ kind: 'expired' }} />);
    expect(screen.queryByTestId('join-cta')).not.toBeInTheDocument();
    expect(screen.queryByTestId('join-browse')).not.toBeInTheDocument();
  });
});
