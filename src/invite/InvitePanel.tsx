import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { DUR, EASE } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import { useSheetDismiss } from '../screens/entry/useSheetDismiss';
import { copyText, shareUrl } from './clipboard';
import { isEmail, normalizeEmail } from './email';
import { displayInviteUrl } from './inviteLink';
import styles from './InvitePanel.module.css';

/**
 * 原型的三步說明。其中幾句照原型寫會跟實際行為不符，改成事實：
 *   - 原型「過期後可重新產生，舊連結立即失效」：沒有後端，產生新連結不會讓舊連結
 *     失效，舊連結會一直有效到它自己的期限。（使用者裁決：照實際行為寫）
 *   - 原型「登入的帳號會被加為這份 Sheet 的編輯者」：沒有後端替她加權限，是你在
 *     面板上把帳本分享給她的帳號，她要用同一個帳號登入才讀得到。
 *   - 原型「只有你能移除成員」：App 沒有移除成員的功能。改成說明誰能加入——連結
 *     本身不帶權限，沒被分享的帳號拿到連結也讀不到帳本。
 */
const STEPS = [
  { title: '連結 7 天內有效', body: '過期後重新產生一條即可；已經傳出去的舊連結會一直有效到它自己的期限。' },
  { title: '對方需用 Google 登入', body: '要用你分享的那個 Google 帳號登入，才讀得到這本帳。' },
  { title: '加入後權限相同', body: '雙方都能新增、修改、刪除所有紀錄。只有你分享過的 Google 帳號能用這條連結加入。' },
] as const;

type Props = {
  /** 還沒有雲端帳本時是 null：面板照開，但不能給出一條指向不存在帳本的連結 */
  url: string | null;
  /**
   * 把帳本分享給她的 Google 帳號（Drive 權限：可編輯）。使用者裁決加的欄位，原型沒有：
   * 沒有這一步，她的 App 讀不到你建的試算表，連結傳過去也加入不了。
   */
  onShareEmail?(email: string): Promise<void>;
  /** 已經分享過的帳號，重開面板時照樣顯示 */
  sharedWith?: string | null;
  onClose(): void;
  /** §8.2 最下方「預覽她點開後看到的畫面 ›」 */
  onPreview(): void;
};

/**
 * §8.2 邀請面板（MOTION #22 進場／下滑關閉、#23 複製回饋、#24 QR 展開）。
 * 把手的下滑關閉沿用記一筆面板的 useSheetDismiss——規格是同一條（#22「進場同 #1」）。
 *
 * 接上雲端時是兩步的單一流程：先分享帳本給她的帳號，分享完才出現邀請連結。
 * 連結本身不帶權限，先傳連結的話她點開只會看到「還讀不到這本帳」。
 */
export function InvitePanel({ url, onClose, onPreview, onShareEmail, sharedWith = null }: Props) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [sharedTo, setSharedTo] = useState<string | null>(sharedWith);
  // 分享過就收成一行；還沒分享、或按了「分享給其他帳號」才展開輸入欄
  const [editing, setEditing] = useState(sharedWith === null);
  // 這次開面板才分享完、連結第一次出現：播一次上浮淡入
  const [revealed, setRevealed] = useState(false);
  const reduced = useReducedMotion();
  const dismiss = useSheetDismiss(onClose);

  const linkReady = !onShareEmail || sharedTo !== null;

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

  async function onShareToHer() {
    if (!onShareEmail) return;
    const addr = normalizeEmail(email);
    if (!isEmail(addr)) { setShareError('請輸入完整的 Google 帳號，例如 name@gmail.com'); return; }
    setShareError(null);
    setSharing(true);
    try {
      // 這裡不先 await 任何東西：外層可能需要叫出 Google 連線視窗，
      // 必須在使用者按下按鈕的同一個事件裡呼叫才不會被擋
      await onShareEmail(addr);
      if (sharedTo === null) setRevealed(true);
      setSharedTo(addr);
      setEmail('');
      setEditing(false);
    } catch {
      setShareError('分享失敗。請確認帳號正確、已加進 Google Cloud 的測試使用者，再試一次。');
    } finally {
      setSharing(false);
    }
  }

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
        aria-label="邀請老婆加入"
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

        <div className={styles.header}>
          <h2 className={styles.title}>邀請老婆加入</h2>
          <button type="button" className={styles.close} onClick={onClose} data-testid="invite-close">
            關閉
          </button>
        </div>

        {url === null ? (
          // 還沒建帳本就不該給出連結：一條指向不存在帳本的邀請，對方點下去
          // 會「成功加入」一本不存在的帳，比什麼都不給更糟
          <p className={styles.lead} data-testid="invite-noledger">
            這台裝置還沒有雲端帳本。先用 Google 登入建立帳本，才有連結可以邀請她。
          </p>
        ) : (
          <>
            <p className={styles.lead}>
              {onShareEmail
                ? '先把帳本分享給她的 Google 帳號，再把邀請連結傳給她；她點開、用那個帳號登入就會加入這本帳。'
                : '把連結傳給她，她點開登入就會加入這本帳，之後兩人看到同一份資料。'}
            </p>

            {onShareEmail && (editing ? (
              <form
                className={styles.shareCard}
                onSubmit={(e) => { e.preventDefault(); void onShareToHer(); }}
                data-testid="invite-share-form"
              >
                <label className={styles.linkLabel} htmlFor="invite-email">
                  {sharedTo === null ? '第一步 · 分享帳本給她的 Google 帳號' : '分享給其他 Google 帳號'}
                </label>
                <div className={styles.shareRow}>
                  <input
                    id="invite-email"
                    className={styles.emailInput}
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    autoCapitalize="none"
                    placeholder="name@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="invite-email"
                  />
                  <button
                    type="submit" className={styles.shareBtn} disabled={sharing}
                    data-testid="invite-email-submit"
                  >{sharing ? '分享中…' : '分享帳本'}</button>
                </div>
                {shareError && <p className={styles.note} data-testid="invite-email-error">{shareError}</p>}
              </form>
            ) : (
              <div className={styles.shareCard} data-testid="invite-shared">
                <div className={styles.linkLabel}>第一步 · 分享帳本給她的 Google 帳號</div>
                <div className={styles.sharedRow}>
                  <span className={styles.shared}>✓ 已分享給 {sharedTo}</span>
                  <button
                    type="button" className={styles.change}
                    onClick={() => setEditing(true)} data-testid="invite-email-change"
                  >分享給其他帳號</button>
                </div>
              </div>
            ))}

            {linkReady ? (
              <div
                className={revealed && !reduced ? styles.reveal : undefined}
                style={{ ['--pop' as string]: `${DUR.popIn}ms` }}
                data-testid="invite-link-block"
              >
                <div className={styles.linkCard}>
                  <span className={styles.linkIcon} aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 20 20">
                      <path
                        d="M8.6 11.4a3.1 3.1 0 0 0 4.4 0l2.5-2.5a3.1 3.1 0 0 0-4.4-4.4l-.9.9"
                        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
                      />
                      <path
                        d="M11.4 8.6a3.1 3.1 0 0 0-4.4 0l-2.5 2.5a3.1 3.1 0 0 0 4.4 4.4l.9-.9"
                        fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
                      />
                    </svg>
                  </span>
                  <div className={styles.linkText}>
                    <div className={styles.linkLabel}>
                      {onShareEmail ? '第二步 · 把邀請連結傳給她' : '邀請連結'}
                    </div>
                    {/* 顯示縮短版（原型如此）；完整連結放在 data-url，複製、分享、QR 都用它 */}
                    <div className={styles.linkUrl} title={url} data-url={url} data-testid="invite-link">
                      {displayInviteUrl(url)}
                    </div>
                  </div>
                </div>

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
              </div>
            ) : (
              <p className={styles.locked} data-testid="invite-link-locked">
                第二步 · 分享完成後，這裡會出現要傳給她的邀請連結
              </p>
            )}

            <button
              type="button" className={styles.preview}
              onClick={onPreview} data-testid="invite-preview"
            >預覽她點開後看到的畫面 ›</button>

            <ol className={styles.steps}>
              {STEPS.map((step, i) => (
                <li key={step.title} className={styles.step}>
                  <span className={styles.stepNo}>{i + 1}</span>
                  <div className={styles.stepText}>
                    <div className={styles.stepTitle}>{step.title}</div>
                    <div className={styles.stepBody}>{step.body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
