/**
 * §8.1 需要的路徑。專案沒有 router 套件——兩條路徑用不著一個幾十 KB 的依賴，
 * 而且 PWA 的 start_url 也只認這幾條。
 *
 * 原本還有 /auth/callback：登入改走 Google Identity Services 的彈出視窗後，
 * 不會再有整頁導回來的回呼，已移除。
 */
export type Route =
  | { kind: 'app' }
  | { kind: 'join'; search: string };

/**
 * base 是部署的子路徑（GitHub Pages 上是 /JointBooks/），先去掉再判斷。
 * 沒去掉的話，部署後打開 /JointBooks/join 會被當成主程式，邀請連結等於失效。
 */
export function routeOf(pathname: string, search: string, base = '/'): Route {
  // 不在子路徑底下的網址不是這個 App 的頁面（例如同網域別的專案的 /join），一律當主程式
  if (base !== '/' && !pathname.startsWith(base)) return { kind: 'app' };
  const rel = base === '/' ? pathname : `/${pathname.slice(base.length)}`;
  if (rel === '/join') return { kind: 'join', search };
  return { kind: 'app' };
}
