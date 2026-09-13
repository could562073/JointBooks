import { useRef } from 'react';
import { tabDirection } from './TabBar';

type Tab = Parameters<typeof tabDirection>[0];

/**
 * MOTION #8 的進場方向：只在分頁真的換了的那一次 render 決定，之後的重繪沿用。
 *
 * 不能每次 render 都拿「上一次 render 的分頁」來比：StrictMode 開發模式會連 render
 * 兩次、換頁後任何狀態更新也會重繪，第二次比出來是「同一頁」→ 當成往後、自右進。
 * 動畫類別一換，進場動畫就從右邊重播一次——配置 → 統計因此變成自右進。
 */
export function useTabDirection(tab: Tab): -1 | 1 {
  const nav = useRef<{ tab: Tab; dir: -1 | 1 }>({ tab, dir: 1 });
  if (nav.current.tab !== tab) nav.current = { tab, dir: tabDirection(nav.current.tab, tab) };
  return nav.current.dir;
}
