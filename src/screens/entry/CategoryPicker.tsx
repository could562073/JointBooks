import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { selectable } from '../../domain/categories';
import type { Category, CategoryKind } from '../../domain/types';
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

/**
 * §5 的主分類與子分類 chip 區，照原型一直展開。
 *
 * 增補檔 B-3 曾把這一區改成可收合、預設收起（為了 iPhone SE 放得下鍵盤）；
 * 使用者驗收後裁決改回原型——原型的面板本身整片可捲動，SE 靠捲動解決。
 * 「＋ 新增」是虛線 chip，就地建立後立即選中（§5）。
 */
export function CategoryPicker({
  categories, kind, mainId, subId, onPickMain, onPickSub, onAddMain, onAddSub,
}: Props) {
  // 哪一區正在輸入新名稱；null 表示都沒有
  const [adding, setAdding] = useState<'main' | 'sub' | null>(null);
  const [draft, setDraft] = useState('');

  const mains = selectable(categories, kind);
  const main = categories.find((c) => c.id === mainId);

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

  return (
    <div className={styles.wrap} data-testid="category-picker">
      <div className={styles.label}>主分類</div>
      <div className={styles.grid} data-testid="main-chips">
        {mains.map((c) => (
          <button
            key={c.id}
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
