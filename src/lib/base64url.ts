/**
 * RFC 4648 §5 的 base64url，不帶 = 補位。
 *
 * 原本放在 auth/pkce.ts；登入改走 Google Identity Services 後 pkce 要移除，
 * 但邀請連結的簽章（invite/inviteLink.ts）還要用，所以搬到共用的 lib。
 */
export function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
