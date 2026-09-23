import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resetDb } from '../db/schema';
import { ledgerRepo } from '../repo/ledgerRepo';
import type { SheetsClient } from '../sheets/client';
import { ensureTaxHeader, TAX_HEADER_KEY } from './taxHeader';

function client() {
  return { update: vi.fn(async () => ({})) } as unknown as SheetsClient;
}

beforeEach(async () => { await resetDb(); });

describe('ensureTaxHeader', () => {
  it('第一次會把稅寫進 O1，並記住是哪一本帳', async () => {
    const c = client();
    await ensureTaxHeader(c, 'S1');
    expect(c.update).toHaveBeenCalledWith('S1', '紀錄!O1', [['稅']]);
    expect(await ledgerRepo.getMeta(TAX_HEADER_KEY)).toBe('S1');
  });

  it('同一本帳第二次什麼都不做', async () => {
    const c = client();
    await ensureTaxHeader(c, 'S1');
    await ensureTaxHeader(c, 'S1');
    expect(c.update).toHaveBeenCalledTimes(1);
  });

  // 登出後接到另一本舊帳本時，那一本的 O1 也還是空的：記布林值就永遠補不到
  it('換一本帳就再補一次', async () => {
    const c = client();
    await ensureTaxHeader(c, 'S1');
    await ensureTaxHeader(c, 'S2');
    expect(c.update).toHaveBeenCalledTimes(2);
    expect(await ledgerRepo.getMeta(TAX_HEADER_KEY)).toBe('S2');
  });

  // 標頭寫不進去（例如使用者在 Sheets 上把第 1 列設成保護範圍）不該擋住推送：
  // 這個函式跑在 syncOnce 的必經路徑上，往上丟會讓整輪同步失敗
  it('寫不進去時不往上丟，也不記旗標，下次還會再試', async () => {
    const c = { update: vi.fn(async () => { throw new Error('403'); }) } as unknown as SheetsClient;
    await expect(ensureTaxHeader(c, 'S1')).resolves.toBeUndefined();
    expect(await ledgerRepo.getMeta(TAX_HEADER_KEY)).toBeUndefined();
  });
});
