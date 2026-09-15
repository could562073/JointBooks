/**
 * 目前跑的是哪一版。使用者回報「修好了卻沒效」時，手機上的主畫面 App 其實還是舊版——
 * 配置頁底下顯示這一行，兩支手機對得上才知道是不是同一版。值由 vite.config.ts 建置時寫入。
 */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev';

/** 例：「版本 4fc7fdb · 9/14 15:19」（建置時間換成手機所在的時區） */
export function versionLabel(
  version: string = APP_VERSION,
  builtAt: string | undefined = import.meta.env.VITE_APP_BUILT_AT
): string {
  const at = builtAt ? new Date(builtAt) : null;
  if (!at || Number.isNaN(at.getTime())) return `版本 ${version}`;
  const hh = String(at.getHours()).padStart(2, '0');
  const mm = String(at.getMinutes()).padStart(2, '0');
  return `版本 ${version} · ${at.getMonth() + 1}/${at.getDate()} ${hh}:${mm}`;
}
