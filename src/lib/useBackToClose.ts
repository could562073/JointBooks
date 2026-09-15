import { useEffect, useRef } from 'react';

/**
 * 面板開著時佔一格瀏覽器歷史紀錄：Android 的返回鍵、iPhone 從左緣右滑（上一頁）
 * 先關掉面板（用面板自己的關閉動畫），不會直接離開 App（§12.4）。
 *
 * 用畫面上的按鈕關掉時，把開面板時推進去的那一格退掉，歷史紀錄才不會越按越長。
 * 退那一格延到下一輪才做：React 開發模式會把 effect 掛上、拆掉、再掛上一次，
 * 立刻退的話，剛打開的面板會被自己的上一頁關掉。
 */
export function useBackToClose(close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  const marker = useRef(`jb-layer-${Math.random().toString(36).slice(2)}`);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const mine = marker.current;
    if (history.state?.jbLayer !== mine) {
      history.pushState({ ...(history.state ?? {}), jbLayer: mine }, '');
    }
    // 回到開面板之前的那一格＝使用者按了返回
    const onPop = () => {
      if (history.state?.jbLayer !== mine) closeRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      mounted.current = false;
      window.removeEventListener('popstate', onPop);
      setTimeout(() => {
        if (!mounted.current && history.state?.jbLayer === mine) history.back();
      }, 0);
    };
  }, []);
}
