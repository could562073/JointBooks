import { describe, it, expect } from 'vitest';
import { buildInviteUrl, checkInvite, INVITE_TTL_MS, signInvite, displayInviteUrl } from './inviteLink';

const SID = '1AbCdEfGhIjKlMnOpQrStUvWxYz';
const NOW = 1_800_000_000_000;

describe('signInvite', () => {
  it('同樣的輸入永遠算出同樣的簽章', async () => {
    expect(await signInvite(SID, NOW)).toBe(await signInvite(SID, NOW));
  });

  it('換一個 sid 就換一個簽章', async () => {
    expect(await signInvite(SID, NOW)).not.toBe(await signInvite('other', NOW));
  });

  it('換一個過期時間也換一個簽章', async () => {
    expect(await signInvite(SID, NOW)).not.toBe(await signInvite(SID, NOW + 1));
  });

  it('格式是「過期時間.簽章」', async () => {
    expect(await signInvite(SID, NOW)).toMatch(/^\d+\.[A-Za-z0-9_-]{12}$/);
  });
});

describe('buildInviteUrl', () => {
  it('照 §14.3 的格式', async () => {
    const u = new URL(await buildInviteUrl('https://app.example', SID, NOW));
    expect(u.pathname).toBe('/join');
    expect(u.searchParams.get('sid')).toBe(SID);
    expect(u.searchParams.get('t')).toBeTruthy();
  });

  it('七天後過期（§14.3）', async () => {
    const url = await buildInviteUrl('https://app.example', SID, NOW);
    const t = new URL(url).searchParams.get('t')!;
    expect(Number(t.split('.')[0])).toBe(NOW + INVITE_TTL_MS);
    expect(INVITE_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
  });
});

describe('checkInvite', () => {
  async function link(now = NOW) {
    return new URL(await buildInviteUrl('https://app.example', SID, now)).search;
  }

  it('剛產生的連結有效', async () => {
    await expect(checkInvite(await link(), NOW)).resolves
      .toEqual({ kind: 'ok', sid: SID, expiresAt: NOW + INVITE_TTL_MS });
  });

  it('七天內都還有效', async () => {
    const s = await link();
    await expect(checkInvite(s, NOW + INVITE_TTL_MS - 1)).resolves.toMatchObject({ kind: 'ok' });
  });

  it('超過七天就過期（§8.1 例外分支）', async () => {
    const s = await link();
    await expect(checkInvite(s, NOW + INVITE_TTL_MS + 1)).resolves.toEqual({ kind: 'expired' });
  });

  it('簽章被改過就是 invalid', async () => {
    const s = await link();
    await expect(checkInvite(s.replace(/.$/, 'X'), NOW)).resolves.toEqual({ kind: 'invalid' });
  });

  it('換一個 sid 但沿用原簽章也是 invalid', async () => {
    const s = await link();
    const q = new URLSearchParams(s.slice(1));
    q.set('sid', 'someone-elses-sheet');
    await expect(checkInvite(`?${q}`, NOW)).resolves.toEqual({ kind: 'invalid' });
  });

  it('自己把過期時間改遠一點不會通過——簽章包含過期時間', async () => {
    const s = await link();
    const q = new URLSearchParams(s.slice(1));
    const mac = q.get('t')!.split('.')[1]!;
    q.set('t', `${NOW + INVITE_TTL_MS * 10}.${mac}`);
    await expect(checkInvite(`?${q}`, NOW)).resolves.toEqual({ kind: 'invalid' });
  });

  it('缺參數是 invalid，不是 expired', async () => {
    await expect(checkInvite('', NOW)).resolves.toEqual({ kind: 'invalid' });
    await expect(checkInvite('?sid=x', NOW)).resolves.toEqual({ kind: 'invalid' });
    await expect(checkInvite('?t=1.abc', NOW)).resolves.toEqual({ kind: 'invalid' });
  });

  it('t 的格式壞掉是 invalid', async () => {
    await expect(checkInvite(`?sid=${SID}&t=garbage`, NOW)).resolves.toEqual({ kind: 'invalid' });
    await expect(checkInvite(`?sid=${SID}&t=abc.def`, NOW)).resolves.toEqual({ kind: 'invalid' });
  });
});

describe('displayInviteUrl（面板上顯示的短版連結）', () => {
  it('縮成 host + 路徑 + ?sid=前三…後三，簽章拿掉', () => {
    expect(displayInviteUrl('https://could562073.github.io/JointBooks/join?sid=1aBcdefghij9kQ&t=123.abc'))
      .toBe('could562073.github.io/JointBooks/join?sid=1aB…9kQ');
  });

  it('sid 很短時不縮', () => {
    expect(displayInviteUrl('https://a.b/join?sid=abc&t=1.x')).toBe('a.b/join?sid=abc');
  });

  it('不是合法網址時原樣回傳，不丟例外', () => {
    expect(displayInviteUrl('not a url')).toBe('not a url');
  });
});
