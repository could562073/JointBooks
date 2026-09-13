import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isEmail, normalizeEmail } from './email';
import { InvitePanel } from './InvitePanel';

const URL_ = 'https://app.example/join?sid=SID&t=1.abc';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
  vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn(async () => {}) } });
});
afterEach(() => vi.unstubAllGlobals());

const BASE = { url: URL_, onClose: () => {}, onPreview: () => {} };

async function submit(value: string) {
  fireEvent.change(screen.getByTestId('invite-email'), { target: { value } });
  await act(async () => { fireEvent.submit(screen.getByTestId('invite-share-form')); });
}

describe('email 格式', () => {
  it('去空白、轉小寫', () => {
    expect(normalizeEmail('  Wife@Gmail.COM ')).toBe('wife@gmail.com');
  });

  it('擋掉明顯打錯的，不限 gmail 網域', () => {
    expect(isEmail('wife@gmail.com')).toBe(true);
    expect(isEmail('wife@company.ca')).toBe(true);
    expect(isEmail('wife@gmail')).toBe(false);
    expect(isEmail('wife gmail.com')).toBe(false);
  });
});

describe('邀請面板：先分享帳本、再傳連結', () => {
  it('沒有接上分享功能（純本機模式）：沒有分享這一步，連結直接可用', () => {
    render(<InvitePanel {...BASE} />);
    expect(screen.queryByTestId('invite-share-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('invite-link')).toHaveAttribute('data-url', URL_);
  });

  it('還沒有帳本時也不顯示分享這一步', () => {
    render(<InvitePanel {...BASE} url={null} onShareEmail={async () => {}} />);
    expect(screen.queryByTestId('invite-share-form')).not.toBeInTheDocument();
  });

  it('還沒分享：先不給連結，只留佔位說明分享完才會出現', () => {
    render(<InvitePanel {...BASE} onShareEmail={async () => {}} />);
    expect(screen.getByTestId('invite-share-form')).toBeInTheDocument();
    expect(screen.queryByTestId('invite-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('invite-copy')).not.toBeInTheDocument();
    expect(screen.getByTestId('invite-link-locked')).toHaveTextContent('分享完成後');
    // 預覽與說明不受影響
    expect(screen.getByTestId('invite-preview')).toBeInTheDocument();
  });

  it('格式不對：顯示提示，不送出，連結仍不出現', async () => {
    const onShareEmail = vi.fn(async () => {});
    render(<InvitePanel {...BASE} onShareEmail={onShareEmail} />);
    await submit('wife@gmail');
    expect(onShareEmail).not.toHaveBeenCalled();
    expect(screen.getByTestId('invite-email-error')).toHaveTextContent('完整的 Google 帳號');
    expect(screen.queryByTestId('invite-link')).not.toBeInTheDocument();
  });

  it('分享成功：送出整理過的帳號，收成一行「已分享」，接著出現邀請連結', async () => {
    const onShareEmail = vi.fn(async () => {});
    render(<InvitePanel {...BASE} onShareEmail={onShareEmail} />);
    await submit('  Wife@Gmail.com ');
    expect(onShareEmail).toHaveBeenCalledWith('wife@gmail.com');
    expect(screen.getByTestId('invite-shared')).toHaveTextContent('已分享給 wife@gmail.com');
    expect(screen.queryByTestId('invite-email')).not.toBeInTheDocument();
    expect(screen.queryByTestId('invite-link-locked')).not.toBeInTheDocument();
    expect(screen.getByTestId('invite-link')).toHaveAttribute('data-url', URL_);
    expect(screen.getByTestId('invite-copy')).toBeInTheDocument();
  });

  it('分享失敗：顯示錯誤，不標成已分享，也不給連結', async () => {
    const onShareEmail = vi.fn(async () => { throw new Error('403'); });
    render(<InvitePanel {...BASE} onShareEmail={onShareEmail} />);
    await submit('wife@gmail.com');
    expect(screen.getByTestId('invite-email-error')).toHaveTextContent('分享失敗');
    expect(screen.queryByTestId('invite-shared')).not.toBeInTheDocument();
    expect(screen.queryByTestId('invite-link')).not.toBeInTheDocument();
  });

  it('之前分享過：重開面板直接是已分享的一行加上連結', () => {
    render(<InvitePanel {...BASE} onShareEmail={async () => {}} sharedWith="wife@gmail.com" />);
    expect(screen.getByTestId('invite-shared')).toHaveTextContent('wife@gmail.com');
    expect(screen.queryByTestId('invite-share-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('invite-link')).toBeInTheDocument();
  });

  it('分享給其他帳號：展開輸入欄時連結照樣留著，送出後改顯示新帳號', async () => {
    const onShareEmail = vi.fn(async () => {});
    render(<InvitePanel {...BASE} onShareEmail={onShareEmail} sharedWith="wife@gmail.com" />);
    fireEvent.click(screen.getByTestId('invite-email-change'));
    expect(screen.getByTestId('invite-email')).toBeInTheDocument();
    expect(screen.getByTestId('invite-link')).toBeInTheDocument();

    await submit('wife.work@gmail.com');
    expect(onShareEmail).toHaveBeenCalledWith('wife.work@gmail.com');
    expect(screen.getByTestId('invite-shared')).toHaveTextContent('已分享給 wife.work@gmail.com');
  });
});
