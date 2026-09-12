/**
 * §8.2 的兩個分享出口。抽出來是因為兩者都有「這個瀏覽器不支援」的分支，
 * 而那個分支的行為（退回複製）是規格指定的，不是隨手寫的 fallback。
 */

export type ShareOutcome = 'shared' | 'copied' | 'failed';

/** navigator.clipboard 在非 HTTPS 或舊瀏覽器上不存在 */
export async function copyText(text: string, nav: Navigator = navigator): Promise<boolean> {
  try {
    if (!nav.clipboard?.writeText) return false;
    await nav.clipboard.writeText(text);
    return true;
  } catch {
    // 使用者拒絕剪貼簿權限也走這裡
    return false;
  }
}

/**
 * §8.2：用訊息傳送 → navigator.share；不支援時**退回複製連結並提示**。
 * 使用者在系統分享單上按取消會丟 AbortError，那不是失敗，也不該退回複製。
 */
export async function shareUrl(url: string, nav: Navigator = navigator): Promise<ShareOutcome> {
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ url });
      return 'shared';
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return 'shared';
      // 分享失敗（不是取消）時仍然退回複製，總比什麼都沒發生好
    }
  }
  return (await copyText(url, nav)) ? 'copied' : 'failed';
}
