import { describe, it, expect, vi } from 'vitest';
import type { DrivePermission, SheetsClient } from '../sheets/client';
import { findInvitee, removeInvitees } from './invitee';

function clientWith(perms: DrivePermission[]) {
  const removePermission = vi.fn(async (_sid: string, _id: string) => {});
  const client = { listPermissions: vi.fn(async () => perms), removePermission } as unknown as SheetsClient;
  return { client, removePermission };
}

const OWNER: DrivePermission = { id: 'O', type: 'user', role: 'owner', emailAddress: 'me@gmail.com' };
const WIFE: DrivePermission = { id: 'W', type: 'user', role: 'writer', emailAddress: 'wife@gmail.com' };
const OLD: DrivePermission = { id: 'X', type: 'user', role: 'writer', emailAddress: 'old@gmail.com' };
const LINK: DrivePermission = { id: 'A', type: 'anyone', role: 'reader' };

describe('受邀者（試算表共用對象裡不是擁有者的那個帳號）', () => {
  it('找得到就回帳號，擁有者自己與「知道連結的人」不算', async () => {
    expect(await findInvitee(clientWith([OWNER, LINK, WIFE]).client, 'SID')).toBe('wife@gmail.com');
  });

  it('只有擁有者：還沒邀請', async () => {
    expect(await findInvitee(clientWith([OWNER]).client, 'SID')).toBeNull();
  });

  it('移除會拿掉所有受邀的個人帳號，不動擁有者', async () => {
    const { client, removePermission } = clientWith([OWNER, WIFE, OLD, LINK]);
    expect(await removeInvitees(client, 'SID')).toBe(2);
    expect(removePermission.mock.calls.map((c) => c[1])).toEqual(['W', 'X']);
  });
});
