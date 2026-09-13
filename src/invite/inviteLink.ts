import { base64url } from '../lib/base64url';

/** §14.3：邀請連結建議 7 天過期 */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * §14.3 的邀請連結簽章。
 *
 * **這不是驗證身分用的簽章，也做不到。** 沒有後端就沒有只有伺服器知道的
 * 密鑰，任何拿到連結的人都能自己算出一個新的 t。它實際擋住的是兩件事：
 *   1. 過期——超過 7 天的連結會被接受頁擋下來
 *   2. 手打或轉貼時被截斷、改動的連結會被判為無效
 *
 * 真正擋住「亂猜」的是 spreadsheetId 本身（不可預測的長字串），不是這個 t。
 * 換句話說：連結本身就是憑證，外流等同給出寫入權——§8.2 的畫面文案要讓
 * 使用者知道這件事。需要可驗證的簽章時，得先有一個後端。
 */
export async function signInvite(sid: string, expiresAt: number): Promise<string> {
  const data = new TextEncoder().encode(`${sid}.${expiresAt}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  // 只取前 12 字：長度足夠讓改過的連結對不上，又不會讓 QR 太密
  const mac = base64url(new Uint8Array(digest)).slice(0, 12);
  return `${expiresAt}.${mac}`;
}

export async function buildInviteUrl(
  origin: string,
  sid: string,
  now: number = Date.now()
): Promise<string> {
  const t = await signInvite(sid, now + INVITE_TTL_MS);
  const q = new URLSearchParams({ sid, t });
  return `${origin}/join?${q}`;
}

export type InviteCheck =
  | { kind: 'ok'; sid: string; expiresAt: number }
  | { kind: 'expired' }
  | { kind: 'invalid' };

/** 接受邀請頁落地時的檢查。§8.1 的例外分支：過期或簽章不符要顯示「已失效」 */
export async function checkInvite(
  search: string,
  now: number = Date.now()
): Promise<InviteCheck> {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const sid = q.get('sid');
  const t = q.get('t');
  if (!sid || !t) return { kind: 'invalid' };

  const [rawExp, mac] = t.split('.');
  const expiresAt = Number(rawExp);
  if (!rawExp || !mac || !Number.isFinite(expiresAt)) return { kind: 'invalid' };

  // 先驗簽再看時間：簽章不符的連結不該因為「還沒過期」而被歸成別的錯誤
  const expected = await signInvite(sid, expiresAt);
  if (expected !== t) return { kind: 'invalid' };

  if (now > expiresAt) return { kind: 'expired' };
  return { kind: 'ok', sid, expiresAt };
}

/**
 * 邀請面板「預覽她點開後看到的畫面」要去的站內路徑：同一條連結加上 preview=1。
 *
 * 不加的話，這台裝置本來就在這本帳裡，接受邀請頁會走「你已在這本帳裡」那一支，
 * 看不到她實際會看到的邀請卡。簽章只算 sid 與 t，多一個參數不影響驗證。
 */
export function previewHref(url: string): string {
  const u = new URL(url);
  u.searchParams.set('preview', '1');
  return `${u.pathname}${u.search}`;
}

export function isPreview(search: string): boolean {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('preview') === '1';
}

/**
 * 面板上顯示用的短版連結：host + 路徑 + ?sid=前三…後三。
 *
 * 原型就是這樣縮的。只影響顯示——複製、分享、QR 一律用完整連結。拿掉 t 是因為
 * 那串簽章對人沒有意義，只會把真正需要辨認的 sid 擠出畫面。
 */
export function displayInviteUrl(url: string): string {
  try {
    const u = new URL(url);
    const sid = u.searchParams.get('sid') ?? '';
    const short = sid.length > 8 ? `${sid.slice(0, 3)}…${sid.slice(-3)}` : sid;
    return `${u.host}${u.pathname}?sid=${short}`;
  } catch {
    return url;
  }
}
