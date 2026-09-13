import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../db/schema';
import { DEFAULT_MEMBERS } from '../domain/members';
import { ledgerRepo } from '../repo/ledgerRepo';
import { setSelfPerson } from '../sync/ledgerId';
import { MEMBERS_DIRTY_KEY } from '../sync/members';
import { useLedger } from './useLedger';

const initial = useLedger.getState();
const s = () => useLedger.getState();

beforeEach(async () => {
  await resetDb();
  useLedger.setState(initial, true);
});

describe('這台裝置是誰、成員名稱與饅頭顏色', () => {
  it('沒記過就是建立帳本的「我」；成員是預設的老公與雪雪大人', async () => {
    await s().load();
    expect(s().self).toBe('我');
    expect(s().members).toEqual(DEFAULT_MEMBERS);
  });

  it('加入流程寫過「妻」之後，這台裝置就是妻', async () => {
    await setSelfPerson('妻');
    await s().load();
    expect(s().self).toBe('妻');
  });

  it('改名、換色會存起來並標記待推上雲端，重新載入還在', async () => {
    await s().load();
    await s().setMember('妻', { name: '  小雪  ' });
    await s().setMember('妻', { color: 'mint' });
    expect(s().members.妻).toEqual({ name: '小雪', color: 'mint' });
    expect(await ledgerRepo.getMeta(MEMBERS_DIRTY_KEY)).toBe(true);

    useLedger.setState(initial, true);
    await s().load();
    expect(s().members.妻).toEqual({ name: '小雪', color: 'mint' });
  });

  it('名稱清成空白就回到預設，不會存成空的', async () => {
    await s().load();
    await s().setMember('我', { name: '   ' });
    expect(s().members.我.name).toBe('老公');
  });
});
