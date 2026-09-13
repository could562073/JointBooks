import { useLayoutEffect, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { selectable } from '../../domain/categories';
import type { Category, CategoryKind } from '../../domain/types';
import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import styles from './CategoryPicker.module.css';

type Props = {
  categories: Category[];
  kind: CategoryKind;
  mainId: string;
  subId: string;
  onPickMain(id: string): void;
  onPickSub(id: string): void;
  /** 就地新增主分類；回傳新分類的 id 讓這裡立即選中 */
  onAddMain(name: string): Promise<string> | string;
  onAddSub(name: string): Promise<string> | string;
};

type Ring = { x: number; y: number; w: number; h: number; animate: boolean };

/**
 * §5 的主分類與子分類 chip 區，照原型一直展開。
 *
 * 增補檔 B-3 曾把這一區改成可收合、預設收起（為了 iPhone SE 放得下鍵盤）；
 * 使用者驗收後裁決改回原型——原型的面板本身整片可捲動，SE 靠捲動解決。
 * 「＋ 新增」是虛線 chip，就地建立後立即選中（§5）。
 *
 * 主分類的選中外圈是獨立的一塊，換分類時從舊的 chip 滑到新的；chip 自己的底色與
 * 字色淡出淡入。子分類只做淡出淡入（使用者要求）。
 */
export function CategoryPicker({
  categories, kind, mainId, subId, onPickMain, onPickSub, onAddMain, onAddSub,
}: Props) {
  // 哪一區正在輸入新名稱；null 表示都沒有
  const [adding, setAdding] = useState<'main' | 'sub' | null>(null);
  const [draft, setDraft] = useState('');
  const reduced = useReducedMotion();

  const mains = selectable(categories, kind);
  const main = categories.find((c) => c.id === mainId);

  const gridRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef(new Map<string, HTMLButtonElement>());
  const lastKind = useRef(kind);
  const [ring, setRing] = useState<Ring | null>(null);

  // 量選中那顆 chip 的位置。換收支時整排 chip 都換掉了，直接到位，不從舊位置滑過來
  useLayoutEffect(() => {
    const measure = (animate: boolean) => {
      const el = chipRefs.current.get(mainId);
      if (!el) { setRing(null); return; }
      setRing((prev) => ({
        x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight,
        animate: animate && prev !== null,
      }));
    };
    const kindChanged = lastKind.current !== kind;
    lastKind.current = kind;
    measure(!kindChanged);

    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;
    // 面板變寬變窄時 chip 換行位置會變：重量一次、直接到位。
    // 只在寬度真的變了才量——observe 當下那一次回呼會把剛設好的滑動蓋掉
    let width = grid.clientWidth;
    const ro = new ResizeObserver(() => {
      if (grid.clientWidth === width) return;
      width = grid.clientWidth;
      measure(false);
    });
    ro.observe(grid);
    return () => ro.disconnect();
  }, [mainId, kind, mains.length, adding]);

  async function commit() {
    const name = draft.trim();
    const where = adding;
    setAdding(null);
    setDraft('');
    if (!name || !where) return;
    // 新增完立即選中（§5：就地建立後立即可選）
    const id = await (where === 'main' ? onAddMain(name) : onAddSub(name));
    if (id) (where === 'main' ? onPickMain : onPickSub)(id);
  }

  function startAdding(where: 'main' | 'sub') {
    setAdding(where);
    setDraft('');
  }

  const input = (
    <input
      className={styles.input}
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') void commit();
        // Esc 放棄，不建立任何東西
        if (e.key === 'Escape') { setAdding(null); setDraft(''); }
      }}
      aria-label="新分類名稱"
      data-testid="category-input"
    />
  );

  const slide = `${DUR.slide}ms ${EASE.move}`;

  return (
    <div
      className={styles.wrap}
      style={{ ['--fade' as string]: reduced ? '0ms' : `${DUR.popIn}ms` }}
      data-testid="category-picker"
    >
      <div className={styles.label}>主分類</div>
      <div ref={gridRef} className={`${styles.grid} ${styles.mainGrid}`} data-testid="main-chips">
        {mains.map((c) => (
          <button
            key={c.id}
            ref={(el) => { if (el) chipRefs.current.set(c.id, el); else chipRefs.current.delete(c.id); }}
            type="button"
            className={styles.main}
            data-selected={c.id === mainId ? '' : undefined}
            aria-pressed={c.id === mainId}
            onClick={() => onPickMain(c.id)}
            data-testid={`main-${c.id}`}
          >
            {/* 原型的主分類 chip 裡是裸圖示，沒有底色方塊 */}
            <Icon name={c.icon} size={18} />
            {c.name}
          </button>
        ))}

        {adding === 'main' ? input : (
          <button
            type="button" className={styles.add} onClick={() => startAdding('main')}
            data-testid="add-main"
          >＋ 新增</button>
        )}

        {ring && (
          <span
            className={styles.ring}
            style={{
              width: ring.w,
              height: ring.h,
              transform: `translate(${ring.x}px, ${ring.y}px)`,
              transition: reduced || !ring.animate
                ? 'none'
                : `transform ${slide}, width ${slide}, height ${slide}`,
            }}
            aria-hidden="true"
            data-for={mainId}
            data-testid="main-ring"
          />
        )}
      </div>

      <div className={`${styles.label} ${styles.subLabel}`}>
        子分類 · <span>{main?.name ?? '未選'}</span>
      </div>
      <div className={styles.grid} data-testid="sub-chips">
        {(main?.subs ?? []).map((s) => (
          <button
            key={s.id}
            type="button"
            className={styles.sub}
            data-selected={s.id === subId ? '' : undefined}
            aria-pressed={s.id === subId}
            onClick={() => onPickSub(s.id)}
            data-testid={`sub-${s.id}`}
          >
            {s.name}
          </button>
        ))}

        {adding === 'sub' ? input : (
          <button
            type="button" className={styles.add} onClick={() => startAdding('sub')}
            data-testid="add-sub"
          >＋ 新增</button>
        )}
      </div>
    </div>
  );
}
