/**
 * §8.1／§14.2 需要的三個路徑。專案沒有 router 套件——三條路徑用不著一個
 * 幾十 KB 的依賴，而且 PWA 的 start_url 也只認這幾條。
 */
export type Route =
  | { kind: 'app' }
  | { kind: 'join'; search: string }
  | { kind: 'callback'; search: string };

export function routeOf(pathname: string, search: string): Route {
  if (pathname === '/join') return { kind: 'join', search };
  if (pathname === '/auth/callback') return { kind: 'callback', search };
  return { kind: 'app' };
}
