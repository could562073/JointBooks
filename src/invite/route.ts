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

export function routeOf(pathname: string, search: string): Route {
  if (pathname === '/join') return { kind: 'join', search };
  return { kind: 'app' };
}
