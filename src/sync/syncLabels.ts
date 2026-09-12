import type { SyncState } from './state';

/**
 * MOTION #26 的「已同步 · 剛剛」。
 *
 * 不用 Intl.RelativeTimeFormat：它的輸出隨執行環境的 locale 資料變動，
 * 同一個時間點在不同機器上會顯示成不同字串（跟 txnTime 同一個理由）。
 */
export function agoLabel(lastSyncAt: number | null, now: number = Date.now()): string {
  if (lastSyncAt === null) return '尚未同步';

  const sec = Math.max(0, Math.floor((now - lastSyncAt) / 1000));
  if (sec < 60) return '剛剛';

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;

  return `${Math.floor(hr / 24)} 天前`;
}

/** 同步狀態那一行的完整文字 */
export function syncLabel(state: SyncState, lastSyncAt: number | null, now?: number): string {
  switch (state) {
    case 'syncing': return '同步中…';
    case 'offline': return '離線 · 已存在這支手機';
    case 'error': return '同步失敗 · 稍後重試';
    default: return `已同步 · ${agoLabel(lastSyncAt, now)}`;
  }
}
