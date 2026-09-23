import { ledgerRepo } from '../repo/ledgerRepo';
import type { SheetsClient } from '../sheets/client';
import { SHEET } from '../sheets/ledgerSheet';
import { TXN_HEADER } from '../sheets/rows';

/**
 * 已經補過稅欄標頭的帳本 id。存的是 sid 而不是布林值：一台手機可能登出後接到
 * 另一本舊帳本，布林旗標會讓第二本永遠補不到標頭。
 */
export const TAX_HEADER_KEY = 'taxHeaderSid';

/**
 * 補寫紀錄頁 O1 的「稅」標頭。加這一欄之前建的帳本那一格是空的，資料寫得進去
 * 但人在 Sheet 上看不出那一欄是什麼。每台裝置、每本帳只打一次 API。
 *
 * 剛建好的帳本其實已經有標頭（createLedger 寫的是 A1:O1），這裡仍會多寫一次
 * 同樣的值。刻意不去 createLedger 的兩個呼叫點各設一次旗標：那是兩個會被忘記
 * 的地方，一整本帳多打一次 API 換掉這個風險划算。
 */
export async function ensureTaxHeader(client: SheetsClient, sid: string): Promise<void> {
  if (await ledgerRepo.getMeta<string>(TAX_HEADER_KEY) === sid) return;
  try {
    await client.update(sid, `${SHEET.txns}!O1`, [[TXN_HEADER[14]]]);
  } catch {
    // 標頭純粹是給人看的，寫不進去不該擋住真正的資料——呼叫它的是同步的推送
    // 路徑，往上丟會讓整輪 syncOnce 失敗，連拉回來的帳都存不進本機。
    // 不設旗標，下一次推送會再試一次。
    return;
  }
  await ledgerRepo.setMeta(TAX_HEADER_KEY, sid);
}
