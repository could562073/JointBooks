import { describe, it, expect, vi } from 'vitest';
import { copyText, shareUrl } from './clipboard';

function nav(over: Partial<Navigator> = {}): Navigator {
  return over as Navigator;
}

describe('copyText', () => {
  it('寫入剪貼簿', async () => {
    const writeText = vi.fn(async () => {});
    await expect(copyText('x', nav({ clipboard: { writeText } as unknown as Clipboard })))
      .resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('x');
  });

  it('沒有 clipboard API 時回 false 而不是炸掉（非 HTTPS 或舊瀏覽器）', async () => {
    await expect(copyText('x', nav())).resolves.toBe(false);
  });

  it('使用者拒絕權限時回 false', async () => {
    const writeText = vi.fn(async () => { throw new Error('denied'); });
    await expect(copyText('x', nav({ clipboard: { writeText } as unknown as Clipboard })))
      .resolves.toBe(false);
  });
});

describe('shareUrl', () => {
  it('有 Web Share 就用它', async () => {
    const share = vi.fn(async () => {});
    await expect(shareUrl('u', nav({ share }))).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ url: 'u' });
  });

  it('使用者在分享單按取消不算失敗，也不退回複製', async () => {
    const err = new Error('cancelled');
    err.name = 'AbortError';
    const share = vi.fn(async () => { throw err; });
    const writeText = vi.fn(async () => {});
    await expect(shareUrl('u', nav({ share, clipboard: { writeText } as unknown as Clipboard })))
      .resolves.toBe('shared');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('不支援 Web Share 時退回複製（§8.2）', async () => {
    const writeText = vi.fn(async () => {});
    await expect(shareUrl('u', nav({ clipboard: { writeText } as unknown as Clipboard })))
      .resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('u');
  });

  it('分享失敗（不是取消）時也退回複製', async () => {
    const share = vi.fn(async () => { throw new Error('boom'); });
    const writeText = vi.fn(async () => {});
    await expect(shareUrl('u', nav({ share, clipboard: { writeText } as unknown as Clipboard })))
      .resolves.toBe('copied');
  });

  it('兩條路都不通時回 failed，讓畫面能顯示手動複製', async () => {
    await expect(shareUrl('u', nav())).resolves.toBe('failed');
  });
});
