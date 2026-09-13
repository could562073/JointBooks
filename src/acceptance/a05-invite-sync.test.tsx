import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import QRCode from 'qrcode';
import App from '../App';
import { render } from '@testing-library/react';
import { buildInviteUrl, INVITE_TTL_MS, signInvite } from '../invite/inviteLink';
import { joinedSid, setJoinedSid } from '../sync/ledgerId';
import { goTab, openApp, setupLedger, teardownLedger } from './harness';

const SID = '1aB9kQ_fake_spreadsheet_id';

beforeEach(setupLedger);
afterEach(() => {
  teardownLedger();
  window.history.replaceState({}, '', '/');
});

/** 讓 jsdom 的 location 走到指定路徑，App 是直接讀 location 的 */
function at(path: string): void {
  window.history.replaceState({}, '', path);
}

describe('§15.1-20 邀請面板：複製內容與 QR 內容都等於連結', () => {
  it('按複製鍵時寫進剪貼簿的就是畫面上那條連結', async () => {
    await setJoinedSid(SID);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    await openApp();
    await goTab('settings');
    fireEvent.click(screen.getByTestId('invite-member'));
    await waitFor(() => expect(screen.getByTestId('invite-link')).toBeInTheDocument());

    // 畫面顯示縮短版；複製、分享、QR 對的是 data-url 裡的完整連結
    const shown = screen.getByTestId('invite-link').getAttribute('data-url')!;
    expect(shown).toContain(`sid=${SID}`);

    await act(async () => { fireEvent.click(screen.getByTestId('invite-copy')); });
    expect(writeText).toHaveBeenCalledWith(shown);
    expect(screen.getByTestId('invite-copy')).toHaveTextContent('已複製連結');
  });

  it('QR 是照那條連結產生的，不是示意圖', async () => {
    await setJoinedSid(SID);
    await openApp();
    await goTab('settings');
    fireEvent.click(screen.getByTestId('invite-member'));
    await waitFor(() => expect(screen.getByTestId('invite-link')).toBeInTheDocument());

    // 畫面顯示縮短版；複製、分享、QR 對的是 data-url 裡的完整連結
    const shown = screen.getByTestId('invite-link').getAttribute('data-url')!;
    fireEvent.click(screen.getByTestId('invite-qr-toggle'));

    await waitFor(() =>
      expect(screen.getByTestId('invite-qr').querySelector('svg')).toBeInTheDocument());

    // 同一個編碼器餵同一條連結會得到同一張圖；多一個字元就不一樣。
    // 比的是最後一條 path——第一條是底色方塊，兩張圖都相同，比了等於沒比。
    const modules = (svg: string) => svg.match(/<path[^>]*d="([^"]+)"/g)!.at(-1)!;
    const expected = await QRCode.toString(shown, { type: 'svg', margin: 1 });
    const other = await QRCode.toString(`${shown}x`, { type: 'svg', margin: 1 });
    expect(modules(expected)).not.toBe(modules(other));

    const rendered = screen.getByTestId('invite-qr').innerHTML;
    expect(rendered).toContain(modules(expected));
    expect(rendered).not.toContain(modules(other));
  });

  it('還沒有雲端帳本時不給連結，也不給複製與 QR', async () => {
    expect(await joinedSid()).toBeNull();
    await openApp();
    await goTab('settings');
    fireEvent.click(screen.getByTestId('invite-member'));

    await waitFor(() => expect(screen.getByTestId('invite-noledger')).toBeInTheDocument());
    expect(screen.queryByTestId('invite-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('invite-copy')).not.toBeInTheDocument();
    expect(screen.queryByTestId('invite-qr-toggle')).not.toBeInTheDocument();
  });
});

describe('§15.1-21 join 連結的四個分支', () => {
  it('分支一：連結有效、本機還沒加入 → 邀請卡與加入 CTA', async () => {
    at(`${await buildInviteUrl('', SID)}`);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('join-page')).toHaveAttribute('data-state', 'invite'));
    expect(screen.getByTestId('join-card')).toBeInTheDocument();
    expect(screen.getByTestId('join-cta')).toHaveTextContent('用 Google 登入並加入');
    expect(screen.getByTestId('join-browse')).toBeInTheDocument();
  });

  it('分支二：已經是這本帳的成員 → 不重複加入，直接給進入鍵', async () => {
    await setJoinedSid(SID);
    at(`${await buildInviteUrl('', SID)}`);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('join-page')).toHaveAttribute('data-state', 'already'));
    expect(screen.getByTestId('join-already')).toBeInTheDocument();
    expect(screen.getByTestId('join-cta')).toHaveTextContent('進入帳本');
    expect(screen.queryByTestId('join-browse')).not.toBeInTheDocument();
  });

  it('分支三：連結過期 → 失效畫面', async () => {
    const past = Date.now() - 1000;
    const t = await signInvite(SID, past);
    at(`/join?sid=${encodeURIComponent(SID)}&t=${encodeURIComponent(t)}`);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('join-page')).toHaveAttribute('data-state', 'expired'));
    expect(screen.getByTestId('join-home')).toBeInTheDocument();
    expect(screen.queryByTestId('join-card')).not.toBeInTheDocument();
  });

  it('分支四：簽章被改過 → 一樣是失效畫面，不放行', async () => {
    const url = await buildInviteUrl('', SID);
    at(`${url}x`);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('join-page')).toHaveAttribute('data-state', 'invalid'));
  });

  it('連結指向的是另一本帳時算「還沒加入」，不會誤判成已是成員', async () => {
    await setJoinedSid('another-ledger');
    at(`${await buildInviteUrl('', SID)}`);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('join-page')).toHaveAttribute('data-state', 'invite'));
  });

  it('「先看看，暫不加入」不寫入任何帳本 id', async () => {
    at(`${await buildInviteUrl('', SID)}`);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('join-browse')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('join-browse'));
    await waitFor(() => expect(screen.getByTestId('join-page')).toHaveAttribute('data-state', 'browsing'));
    expect(await joinedSid()).toBeNull();
  });

  it('剛好過期那一刻算過期，差一毫秒還有效', async () => {
    const now = Date.now();
    const url = await buildInviteUrl('', SID, now);
    at(url);
    vi.setSystemTime(now + INVITE_TTL_MS + 1);
    render(<App />);
    await waitFor(() => expect(screen.getByTestId('join-page')).toHaveAttribute('data-state', 'expired'));
    vi.useRealTimers();
  });
});
