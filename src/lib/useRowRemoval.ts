import { useCallback, useEffect, useRef, useState } from 'react';
import { DUR } from './motion';
import { useReducedMotion } from './useReducedMotion';

export type RowRemoval = {
  /** 正在播收合動畫的 id */
  collapsing: ReadonlySet<string>;
  /** 開始移除：先播收合，動畫演完才真的刪 */
  remove(id: string): void;
};

/**
 * MOTION #16／#37：刪除確認後，那一列先 opacity→0 + 高度收合 260ms 才消失。
 *
 * 兩處需求一樣（分類卡與明細列），所以放在 lib 共用。真正的刪除延後到動畫
 * 結束——先刪再播動畫的話，元素早就不在 DOM 裡了，什麼都看不到。
 *
 * reduced-motion 直接刪：那個模式下使用者要的是立刻到位。
 */
export function useRowRemoval(onRemove: (id: string) => void): RowRemoval {
  const [collapsing, setCollapsing] = useState<ReadonlySet<string>>(() => new Set());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const reduced = useReducedMotion();

  // 卸載時清掉所有 timer，避免對已經不存在的元件呼叫 onRemove
  useEffect(() => {
    const map = timers.current;
    return () => { for (const t of map.values()) clearTimeout(t); map.clear(); };
  }, []);

  const remove = useCallback((id: string) => {
    if (reduced) { onRemove(id); return; }
    // 同一列連按兩次不要排兩個 timer
    if (timers.current.has(id)) return;

    setCollapsing((prev) => new Set(prev).add(id));
    timers.current.set(id, setTimeout(() => {
      timers.current.delete(id);
      setCollapsing((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      onRemove(id);
    }, DUR.rowCollapse));
  }, [reduced, onRemove]);

  return { collapsing, remove };
}
