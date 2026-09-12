import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { SegmentedControl, type Segment } from '../../components/SegmentedControl';
import { makeCategory, nextColorSet, nextOrder, selectable } from '../../domain/categories';
import type { Category, CategoryKind, Txn } from '../../domain/types';
import { DUR } from '../../lib/motion';
import { CategoryCard } from './CategoryCard';
import styles from './CategoriesPage.module.css';

/** 增補檔 B-1：標題列下方的支出／收入分段，行為完全比照統計頁的週／月／年 */
const KINDS: readonly Segment<CategoryKind>[] = [
  { key: 'expense', label: '支出' },
  { key: 'income', label: '收入' },
];

type Props = {
  categories: Category[];
  txns: Txn[];
  onSave(c: Category): void;
  onDelete(id: string): void;
  onBack(): void;
};

/** §7.2 確認視窗要顯示「已用在 N 筆紀錄」 */
export function usageCount(txns: Txn[], categoryId: string): number {
  return txns.filter((t) => !t.deleted && t.mainId === categoryId).length;
}

/**
 * §7.2 分類與月預算子頁（MOTION #14 自右滑入）。
 * 標題列與分段固定，只有分類卡清單捲動。
 */
export function CategoriesPage({ categories, txns, onSave, onDelete, onBack }: Props) {
  const [kind, setKind] = useState<CategoryKind>('expense');
  // 換分段時整區水平滑入（B-1，比照 MOTION #8）
  const [slide, setSlide] = useState<{ dir: -1 | 1; seq: number }>({ dir: 1, seq: 0 });
  const [confirming, setConfirming] = useState<Category | null>(null);
  /** 剛新增的分類 id：名稱欄要自動進入編輯（MOTION #17） */
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const rows = useMemo(() => selectable(categories, kind), [categories, kind]);

  function switchKind(next: CategoryKind) {
    if (next === kind) return;
    setSlide((s) => ({ dir: next === 'income' ? 1 : -1, seq: s.seq + 1 }));
    setKind(next);
  }

  function add() {
    // §7.2：新卡插入清單最上方，kind 跟隨當前分段（B-1）
    const c = makeCategory({
      kind,
      name: '新分類',
      colorSet: nextColorSet(categories),
      order: nextOrder(categories),
    });
    onSave(c);
    setJustAdded(c.id);
  }

  return (
    <div className={styles.page} data-testid="categories-page">
      <div className={styles.head}>
        <button
          type="button" className={styles.back} onClick={onBack}
          aria-label="返回" data-testid="categories-back"
        >‹</button>
        <h1 className={styles.title}>分類與月預算</h1>
        <button
          type="button" className={styles.add} onClick={add}
          aria-label="新增分類" data-testid="categories-add"
        >＋</button>
      </div>

      <div className={styles.segment}>
        <SegmentedControl segments={KINDS} value={kind} onChange={switchKind} testId="catkind" />
      </div>

      <p className={styles.hint}>左滑分類卡可以刪除；刪除後已記的帳不會被改動。</p>

      {/* §7.2：標題列與提示行固定，只有分類卡清單捲動 */}
      <div className={styles.scroll} data-testid="categories-scroll">
        <ul
          key={slide.seq}
          className={`${styles.list} ${slide.dir > 0 ? styles.fromRight : styles.fromLeft}`}
          style={{ ['--slide' as string]: `${DUR.slide}ms` }}
          data-testid="categories-list"
        >
          {rows.map((c) => (
            <CategoryCard
              key={c.id}
              category={c}
              autoEditName={c.id === justAdded}
              onEditedName={() => setJustAdded(null)}
              onChange={onSave}
              onDelete={setConfirming}
            />
          ))}
        </ul>
      </div>

      {confirming && (
        <ConfirmDialog
          title={`刪除「${confirming.name}」？`}
          subject={<span>已用在 {usageCount(txns, confirming.id)} 筆紀錄</span>}
          description="刪除後已記的帳不會被改動也不會消失，仍以原分類名稱留在統計裡。"
          confirmLabel="刪除"
          onCancel={() => setConfirming(null)}
          onConfirm={() => { onDelete(confirming.id); setConfirming(null); }}
          testId="cat-delete-confirm"
        />
      )}
    </div>
  );
}
