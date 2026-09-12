import { useEffect, useRef, useState } from 'react';
import type { DayCell } from '../../domain/aggregate';
import { changedDays } from './calendarLayout';

/**
 * §10 #4：金額變動的月曆格播一次 scale 1→1.12→1。
 *
 * 比較的基準只在同一個年月內成立，所以換月時直接重設基準、不回報任何變動
 * ——不這樣做的話，換月會讓整排格子一起跳。
 */
export function useCellPop(year: number, month: number, cells: DayCell[]): Set<number> {
  const key = `${year}-${month}`;
  const prev = useRef<{ key: string; cells: DayCell[] } | null>(null);
  const [popping, setPopping] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const last = prev.current;
    prev.current = { key, cells };

    const days = last && last.key === key ? changedDays(last.cells, cells) : [];
    if (days.length === 0) {
      // 只有真的有東西在跳的時候才寫 state，避免每次 render 都塞一個新 Set
      setPopping((p) => (p.size === 0 ? p : new Set()));
      return;
    }

    setPopping(new Set(days));
  }, [key, cells]);

  return popping;
}
