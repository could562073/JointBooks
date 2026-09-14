import type { DrivePermission, SheetsClient } from '../sheets/client';

/**
 * 帳本分享給了誰。一本帳本最多兩個人（建立的人＋一位受邀者），所以受邀者就是這份試算表
 * 共用對象裡、不是擁有者的那個 Google 帳號。以雲端的共用設定為準，換手機也對得上。
 */
export async function findInvitee(client: SheetsClient, sid: string): Promise<string | null> {
  const ps = await client.listPermissions(sid);
  return ps.find(isInvitee)?.emailAddress ?? null;
}

/**
 * 移除受邀者：拿掉所有不是擁有者的個人共用權限（以前「分享給其他帳號」可能留下不只一個）。
 * 對方之後讀不到這本帳；邀請連結本身不帶權限，舊連結也就沒用了。回傳拿掉了幾個。
 */
export async function removeInvitees(client: SheetsClient, sid: string): Promise<number> {
  const ps = (await client.listPermissions(sid)).filter(isInvitee);
  for (const p of ps) await client.removePermission(sid, p.id);
  return ps.length;
}

function isInvitee(p: DrivePermission): boolean {
  return p.type === 'user' && p.role !== 'owner' && Boolean(p.emailAddress);
}
