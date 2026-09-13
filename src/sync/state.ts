/** §14.6：狀態機直接餵給同步狀態那顆點（MOTION #26） */
/**
 * needs-auth：Google 的 access token 過期了，要使用者點一下重新連線。
 * 它不是 error——token model 沒有 refresh token，過期是常態，亮紅燈會讓人以為壞了。
 */
export type SyncState = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'needs-auth';

export type SyncEvent =
  | { type: 'start' }
  | { type: 'done' }
  | { type: 'fail' }
  | { type: 'offline' }
  | { type: 'online' }
  | { type: 'needs-auth' };

/**
 * §14.6 的狀態轉換。
 *
 * offline 優先於一切：離線時按下同步不該轉成 syncing 再馬上 fail，那會讓
 * 狀態點閃一下紅色，但使用者其實只是沒有網路。
 */
export function nextState(current: SyncState, e: SyncEvent): SyncState {
  if (e.type === 'offline') return 'offline';

  if (current === 'offline') {
    // 回線之後先回到 idle，真正要不要同步由呼叫端決定
    return e.type === 'online' ? 'idle' : 'offline';
  }

  switch (e.type) {
    case 'start': return 'syncing';
    case 'done': return 'synced';
    case 'fail': return 'error';
    case 'needs-auth': return 'needs-auth';
    // 已經在線上時收到 online 不動作
    case 'online': return current;
  }
}

/** MOTION #26：只有這個狀態要播 spin */
export function isBusy(s: SyncState): boolean {
  return s === 'syncing';
}
