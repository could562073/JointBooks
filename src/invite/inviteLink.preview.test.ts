import { describe, it, expect } from 'vitest';
import { buildInviteUrl, checkInvite, isPreview, previewHref } from './inviteLink';
import { joinStateOf } from './joinFlow';

describe('預覽對方點開後看到的畫面', () => {
  it('站內路徑，帶 preview=1，原本的 sid 與 t 都保留', async () => {
    const url = await buildInviteUrl('https://app.example', 'SID-1', 1_000);
    const href = previewHref(url);
    expect(href.startsWith('/join?')).toBe(true);
    expect(isPreview(href.slice(href.indexOf('?')))).toBe(true);
    expect(new URLSearchParams(href.split('?')[1]).get('sid')).toBe('SID-1');
  });

  it('多了 preview 參數，連結照樣驗得過', async () => {
    const url = await buildInviteUrl('https://app.example', 'SID-1', 1_000);
    const search = previewHref(url).split('?')[1]!;
    expect((await checkInvite(search, 2_000)).kind).toBe('ok');
  });

  it('一般連結不是預覽', () => {
    expect(isPreview('?sid=S&t=1.abc')).toBe(false);
  });

  it('這台已經在帳本裡：預覽照樣顯示邀請卡，而不是「你已在這本帳裡」', () => {
    const check = { kind: 'ok', sid: 'S', expiresAt: 9 } as const;
    expect(joinStateOf({ check, joinedSid: 'S' }).kind).toBe('already');
    expect(joinStateOf({ check, joinedSid: 'S', preview: true })).toEqual({ kind: 'invite', sid: 'S', preview: true });
  });
});
