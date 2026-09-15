/**
 * 目前跑的是哪一版。使用者回報「修好了卻沒效」時，手機上的主畫面 App 其實還是舊版——
 * 配置頁底下顯示這一行，兩支手機對得上才知道是不是同一版。
 *
 * 版本號用語意化版本（package.json 的 version，使用者要求「比較正統的記錄方式」），
 * 後面帶這次建置的提交碼：同一個版本號會部署很多次，回報問題時提交碼才對得精準。
 * 兩個值都由 vite.config.ts 在建置時寫入。
 */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? '0.0.0';

export const APP_COMMIT: string = import.meta.env.VITE_APP_COMMIT ?? 'dev';

/** 例：「v1.0.0 · 4548372」 */
export function versionLabel(version: string = APP_VERSION, commit: string = APP_COMMIT): string {
  return commit ? `v${version} · ${commit}` : `v${version}`;
}

/** 長按版本那一行看得到的建置時間（換成手機所在的時區）；沒有或壞掉就不顯示 */
export function buildStamp(builtAt: string | undefined = import.meta.env.VITE_APP_BUILT_AT): string {
  const at = builtAt ? new Date(builtAt) : null;
  if (!at || Number.isNaN(at.getTime())) return '';
  const two = (n: number) => String(n).padStart(2, '0');
  return `建置於 ${at.getFullYear()}/${two(at.getMonth() + 1)}/${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`;
}
