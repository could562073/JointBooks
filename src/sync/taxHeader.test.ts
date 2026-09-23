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
});
