import type { InviteCheck } from './inviteLink';

/**
 * §8.1 接受邀請的四個分支（含例外）。狀態算在這裡，畫面只負責照著畫。
 */
export type JoinState =
  /**
   * 連結有效、還沒登入：先看到邀請卡與權限說明，尚未寫入任何東西。
   * preview：邀請的人自己按「預覽她點開後看到的畫面」進來的，按鈕不做任何加入動作
   */
  | { kind: 'invite'; sid: string; preview?: true }
  /** 已經是這本帳的成員：不重複加入，直接進主程式 */
  | { kind: 'already'; sid: string }
  /** 連結過期或簽章不符 */
  | { kind: 'expired' }
  | { kind: 'invalid' }
  /** 她按「先看看，暫不加入」→ 唯讀試用，不寫入任何資料 */
  | { kind: 'browsing' };

export type JoinContext = {
  check: InviteCheck;
  /** 本機已經加入的帳本 id；沒有就是還沒加入 */
  joinedSid: string | null;
  /** 從邀請面板的預覽進來：不管這台是不是已經在帳本裡，都照她會看到的邀請卡畫 */
  preview?: boolean;
};

/**
 * §8.1-6 的三種情況 + 兩個例外分支。
 *
 * 「已是成員」的判定放在連結檢查**之後**：一條過期的連結即使指向她已經
 * 加入的帳本，顯示「這個邀請已失效」也比默默放行誠實——她本來就進得去，
 * 不需要靠這條連結。
 */
export function joinStateOf(ctx: JoinContext): JoinState {
  if (ctx.check.kind === 'expired') return { kind: 'expired' };
  if (ctx.check.kind === 'invalid') return { kind: 'invalid' };

  const sid = ctx.check.sid;
  if (ctx.preview) return { kind: 'invite', sid, preview: true };
  if (ctx.joinedSid === sid) return { kind: 'already', sid };
  return { kind: 'invite', sid };
}

/** §8.1 例外：建立者未登入就打開 join 連結 → 一律先走登入，再回到接受邀請頁 */
export function needsLoginFirst(signedIn: boolean, s: JoinState): boolean {
  return !signedIn && (s.kind === 'invite' || s.kind === 'already');
}

/** 加入之後要導去哪裡 */
export function afterJoin(s: JoinState): 'app' | 'stay' {
  return s.kind === 'already' || s.kind === 'invite' ? 'app' : 'stay';
}
