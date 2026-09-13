import { normalizeMembers, type Members } from '../domain/members';
import { ledgerRepo } from '../repo/ledgerRepo';

/** 本機存的成員名稱與饅頭顏色 */
export const MEMBERS_KEY = 'members';
/** 本機改過、還沒推上雲端 */
export const MEMBERS_DIRTY_KEY = 'membersDirty';

export async function localMembers(): Promise<Members> {
  return normalizeMembers(await ledgerRepo.getMeta<unknown>(MEMBERS_KEY));
}

/** 同步控制器用：推之前讀本機、推完標記、拉回來存 */
export type MembersSync = {
  dirty(): Promise<boolean>;
  local(): Promise<Members>;
  /** 推上去之後：這段時間本機沒再改，才清掉待推標記（改了的話下一輪再推） */
  markPushed(pushed: Members): Promise<void>;
  /** 從雲端拉回來：本機還有沒推的修改就不覆蓋，等它推上去（最後寫入的贏） */
  save(m: Members): Promise<void>;
};

export const membersSync: MembersSync = {
  async dirty() {
    return (await ledgerRepo.getMeta<boolean>(MEMBERS_DIRTY_KEY)) === true;
  },
  local: localMembers,
  async markPushed(pushed) {
    const now = await localMembers();
    if (JSON.stringify(now) === JSON.stringify(pushed)) await ledgerRepo.setMeta(MEMBERS_DIRTY_KEY, false);
  },
  async save(m) {
    if (await membersSync.dirty()) return;
    await ledgerRepo.setMeta(MEMBERS_KEY, m);
  },
};
