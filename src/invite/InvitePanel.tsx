import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { DUR, EASE } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import { useSheetDismiss } from '../screens/entry/useSheetDismiss';
import { copyText, shareUrl } from './clipboard';
import styles from './InvitePanel.module.css';

type Props = {
  /** 還沒有雲端帳本時是 null：面板照開，但不能給出一條指向不存在帳本的連結 */
  url: string | null;
  onClose(): void;
  /** §8.2 最下方「預覽她點開後看到的畫面 ›」 */
  onPreview(): void;
};

/**
 * §8.2 邀請面板（MOTION #22 進場／下滑關閉、#23 複製回饋、#24 QR 展開）。
 * 把手的下滑關閉沿用記一筆面板的 useSheetDismiss——規格是同一條（#22「進場同 #1」）。
 */
export function InvitePanel({ url, onClose, onPreview }: Props) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const dismiss = useSheetDismiss(onClose);

  // MOTION #23：2.2 秒後復原
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), DUR.copyRevert);
    return () => clearTimeout(t);
  }, [copied]);

  // §8.2：QR 內容與連結完全相同，且是依真實連結產生而不是示意圖
  useEffect(() => {
    if (!qrOpen || !url) return;
    let alive = true;
    void QRCode.toString(url, { type: 'svg', margin: 1 }).then((svg) => {
      if (alive) setQr(svg);
    });
    return () => { alive = false; };
  }, [qrOpen, url]);

  async function onCopy() {
    if (!url) return;
    const ok = await copyText(url);
    setCopied(ok);
    if (!ok) setShareNote('這個瀏覽器不允許自動複製，請長按上方連結手動複製');
  }

  async function onShare() {
    if (!url) return;
    const r = await shareUrl(url);
    if (r === 'copied') { setCopied(true); setShareNote('這個裝置不支援分享，已改為複製連結'); }
    if (r === 'failed') setShareNote('分享與複製都失敗了，請長按上方連結手動複製');
  }

  return (
    <div className={styles.scrim} onClick={onClose} data-testid="invite-scrim">
      <div
        className={reduced || dismiss.dragging ? styles.panel : `${styles.panel} ${styles.panelIn}`}
        style={{ ...dismiss.style, ['--in' as string]: `${DUR.sheetIn}ms` }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="邀請成員"
        data-testid="invite-panel"
      >
        <div
          className={styles.handle}
          style={{ touchAction: dismiss.touchAction }}
          data-testid="invite-handle"
          {...dismiss.handlers}
        >
          <span className={styles.bar} aria-hidden="true" />
        </div>

        <h2 className={styles.title}>邀請成員</h2>

        {url === null ? (
          // 還沒建帳本就不該給出連結：一條指向不存在帳本的邀請，對方點下去
          // 會「成功加入」一本不存在的帳，比什麼都不給更糟
          <p className={styles.body} data-testid="invite-noledger">
            這台裝置還沒有雲端帳本。先用 Google 登入建立帳本，才有連結可以邀請她。
          </p>
        ) : (
          <>
            <p className={styles.link} data-testid="invite-link">{url}</p>

            <button
              type="button"
              className={copied ? `${styles.cta} ${styles.done}` : styles.cta}
              style={{ transition: reduced ? 'none' : `background ${DUR.copyFeedback}ms ${EASE.exit}` }}
              onClick={() => void onCopy()}
              data-copied={copied ? '' : undefined}
              data-testid="invite-copy"
            >{copied ? '已複製連結' : '複製邀請連結'}</button>

            <div className={styles.secondary}>
              <button
                type="button" className={styles.ghost}
                onClick={() => void onShare()} data-testid="invite-share"
              >用訊息傳送</button>
              <button
                type="button" className={styles.ghost}
                onClick={() => setQrOpen((v) => !v)}
                aria-expanded={qrOpen}
                data-testid="invite-qr-toggle"
              >顯示 QR Code</button>
            </div>

            {shareNote && <p className={styles.note} data-testid="invite-note">{shareNote}</p>}

            {/* MOTION #24：QR 區塊 translateY 10px→0 + opacity，240ms */}
            {qrOpen && (
              <div
                className={reduced ? styles.qr : `${styles.qr} ${styles.qrIn}`}
                style={{ ['--pop' as string]: `${DUR.popIn}ms` }}
                data-testid="invite-qr"
              >
                {qr
                  ? <span className={styles.qrSvg} dangerouslySetInnerHTML={{ __html: qr }} />
                  : <span className={styles.qrLoading}>產生中…</span>}
              </div>
            )}

            <ul className={styles.facts}>
              <li>她會拿到這本帳的編輯權限，可以新增與修改紀錄。</li>
              <li>連結七天後失效，過期後重新產生一條即可。</li>
              {/* 沒有後端就沒有真正的簽章驗證，連結本身就是憑證——要講清楚 */}
              <li>任何拿到這條連結的人都能加入，請只傳給她本人。</li>
            </ul>

            <button
              type="button" className={styles.preview}
              onClick={onPreview} data-testid="invite-preview"
            >預覽她點開後看到的畫面 ›</button>
          </>
        )}

        <button type="button" className={styles.close} onClick={onClose} data-testid="invite-close">
          關閉
        </button>
      </div>
    </div>
  );
}
