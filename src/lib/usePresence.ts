import { useEffect, useState } from 'react';

export type Presence = {
  /** 要不要把元素掛在 DOM 上（打開中，或正在播離場動畫） */
  mounted: boolean;
  /** 正在播離場動畫；這段期間元素還在，但已經不該再被操作 */
  exiting: boolean;
};

/**
 * 讓「關起來」也能有動畫：open 轉 false 時先保持掛載 duration 毫秒，播完才卸載。
 *
 * 不這樣做的話，條件渲染一關就直接從 DOM 消失，離場動畫根本沒有元素可以播。
 * reduced-motion 時立刻卸載——那個模式下使用者要的是立刻到位（§10 通則）。
 *
 * mounted 與 exiting 在 render 當下就算出來，不等 effect：否則關閉那一格會先
 * 以「進場中」的樣子畫一次，才在下一格切成離場。
 */
export function usePresence(open: boolean, duration: number, reduced: boolean): Presence {
  const [lingering, setLingering] = useState(open);

  useEffect(() => {
    if (open) { setLingering(true); return; }
    if (reduced) { setLingering(false); return; }
    const t = setTimeout(() => setLingering(false), duration);
    // 離場途中又被打開，或元件卸載時，都要把還沒到的卸載取消掉
    return () => clearTimeout(t);
  }, [open, reduced, duration]);

  const mounted = open || (lingering && !reduced);
  return { mounted, exiting: mounted && !open };
}
