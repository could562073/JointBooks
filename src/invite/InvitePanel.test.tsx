import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { displayInviteUrl } from './inviteLink';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InvitePanel } from './InvitePanel';

const URL_ = 'https://app.example/join?sid=SID&t=1.abc';

beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('prefers-reduced-motion'),
    media: q, addEventListener() {}, removeEventListener() {},
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function withClipboard() {
  const writeText = vi.fn(async () => {});
  vi.stubGlobal('navigator', { clipboard: { writeText } });
  return writeText;
}

const BASE = { url: URL_, onClose: () => {}, onPreview: () => {} };

describe('InvitePanel 的內容', () => {
  it('顯示邀請連結與三條說明', () => {
    withClipboard();
    render(<InvitePanel {...BASE} />);
    // 顯示縮短版（原型如此），完整連結保留在 data-url 給複製、分享、QR 用
    expect(screen.getByTestId('invite-link')).toHaveAttribute('data-url', URL_);
    expect(screen.getByTestId('invite-link')).toHaveTextContent(displayInviteUrl(URL_));
    // 原型的三步說明卡
    expect(screen.getByTestId('invite-panel')).toHaveTextContent('連結 7 天內有效');
    expect(screen.getByTestId('invite-panel').querySelectorAll('ol > li')).toHaveLength(3);
  });

  /*
   * 原型寫「舊連結立即失效」，但沒有後端就做不到——產生新連結不會讓已傳出的舊連結
   * 失效。照原型抄會變成錯誤的安全說明，這條擋住之後的「對齊原型」把它改回去。
   */
  it('不宣稱產生新連結會讓舊連結立即失效', () => {
    withClipboard();
    render(<InvitePanel {...BASE} />);
    expect(screen.getByTestId('invite-panel')).not.toHaveTextContent('舊連結立即失效');
    expect(screen.getByTestId('invite-panel')).toHaveTextContent('舊連結會一直有效到它自己的期限');
  });

  /*
   * 連結本身不帶權限：她的帳號要先被分享，才讀得到那份試算表。舊說明寫「任何拿到
   * 連結的人都能加入」，接上 Google 分享之後已經不是事實。
   */
  it('說明只有分享過的帳號能加入，不說任何人拿到連結都能加入', () => {
    withClipboard();
    render(<InvitePanel {...BASE} />);
    expect(screen.getByTestId('invite-panel')).toHaveTextContent('只有你分享過的 Google 帳號能用這條連結加入');
    expect(screen.getByTestId('invite-panel')).not.toHaveTextContent('任何拿到這條連結的人都能加入');
  });

  it('關閉與預覽都會回報', () => {
    withClipboard();
    const onClose = vi.fn();
    const onPreview = vi.fn();
    render(<InvitePanel {...BASE} onClose={onClose} onPreview={onPreview} />);

    fireEvent.click(screen.getByTestId('invite-preview'));
    expect(onPreview).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('invite-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('點遮罩關閉，點面板內不會', () => {
    withClipboard();
    const onClose = vi.fn();
    render(<InvitePanel {...BASE} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('invite-panel'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('invite-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('InvitePanel 的複製（MOTION #23）', () => {
  it('複製後文字換成「已複製連結」', async () => {
    const writeText = withClipboard();
    render(<InvitePanel {...BASE} />);

    fireEvent.click(screen.getByTestId('invite-copy'));
    await waitFor(() => expect(screen.getByTestId('invite-copy')).toHaveTextContent('已複製連結'));
    expect(writeText).toHaveBeenCalledWith(URL_);
  });

  it('2.2 秒後復原', async () => {
    withClipboard();
    // 假時鐘要在 render 之前裝好：effect 裡的 setTimeout 是用當下的時鐘排的，
    // 中途才換會讓那個 timer 仍然掛在真實時鐘上，advanceTimersByTime 推不動它
    vi.useFakeTimers();
    render(<InvitePanel {...BASE} />);

    fireEvent.click(screen.getByTestId('invite-copy'));
    // 讓 clipboard 的 promise 與後續的 setState 跑完
    await act(async () => {});
    expect(screen.getByTestId('invite-copy')).toHaveAttribute('data-copied');

    act(() => { vi.advanceTimersByTime(2200); });
    expect(screen.getByTestId('invite-copy')).toHaveTextContent('複製邀請連結');
  });

  it('剪貼簿不可用時提示手動複製，不會假裝成功', async () => {
    vi.stubGlobal('navigator', {});
    render(<InvitePanel {...BASE} />);
    fireEvent.click(screen.getByTestId('invite-copy'));
    await waitFor(() => expect(screen.getByTestId('invite-note')).toHaveTextContent('手動複製'));
    expect(screen.getByTestId('invite-copy')).toHaveTextContent('複製邀請連結');
  });
});

describe('InvitePanel 的分享（§8.2）', () => {
  it('有 Web Share 就用系統分享單', async () => {
    const share = vi.fn(async () => {});
    vi.stubGlobal('navigator', { share });
    render(<InvitePanel {...BASE} />);
    fireEvent.click(screen.getByTestId('invite-share'));
    await waitFor(() => expect(share).toHaveBeenCalledWith({ url: URL_ }));
  });

  it('不支援時退回複製並提示', async () => {
    const writeText = withClipboard();
    render(<InvitePanel {...BASE} />);
    fireEvent.click(screen.getByTestId('invite-share'));
    await waitFor(() => expect(screen.getByTestId('invite-note')).toHaveTextContent('已改為複製連結'));
    expect(writeText).toHaveBeenCalledWith(URL_);
  });
});

describe('InvitePanel 的 QR（MOTION #24）', () => {
  it('預設不展開', () => {
    withClipboard();
    render(<InvitePanel {...BASE} />);
    expect(screen.queryByTestId('invite-qr')).not.toBeInTheDocument();
  });

  it('點了展開，且產生的是依真實連結畫的 SVG 而不是示意圖', async () => {
    withClipboard();
    render(<InvitePanel {...BASE} />);
    fireEvent.click(screen.getByTestId('invite-qr-toggle'));

    await waitFor(() => {
      expect(screen.getByTestId('invite-qr').querySelector('svg')).toBeInTheDocument();
    });
  });

  it('再點一次收合', async () => {
    withClipboard();
    render(<InvitePanel {...BASE} />);
    fireEvent.click(screen.getByTestId('invite-qr-toggle'));
    await waitFor(() => expect(screen.getByTestId('invite-qr')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('invite-qr-toggle'));
    expect(screen.queryByTestId('invite-qr')).not.toBeInTheDocument();
  });
});
