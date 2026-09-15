import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { addSub, removeSub } from '../../domain/categories';
import { formatCadWhole, toCents } from '../../domain/money';
import { colorSetOf } from '../../domain/palette';
import type { Category } from '../../domain/types';
import { IconPicker } from './IconPicker';
import { InlineEdit } from './InlineEdit';
import { useCardSwipe } from './useCardSwipe';
import { DUR } from '../../lib/motion';
import styles from './CategoryCard.module.css';

type Props = {
  category: Category;
  onChange(next: Category): void;
  onDelete(c: Category): void;
  /** MOTION #17：剛新增的卡，名稱欄自動進入編輯（且**不**自動展開圖示選擇器） */
  autoEditName?: boolean;
  onEditedName?(): void;
  /** MOTION #16：正在播刪除的收合動畫 */
  collapsing?: boolean;
};

/**
 * §7.2 分類卡。圖示、名稱、預算、子分類都可以就地改；左滑露出刪除鍵（MOTION #15）。
 *
 * 收入分類不顯示金額 pill（增補檔 B-2：收入分類沒有預算）。
 */
export function CategoryCard({
  category: c, onChange, onDelete, autoEditName = false, onEditedName, collapsing = false,
}: Props) {
  const [pickingIcon, setPickingIcon] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const swipe = useCardSwipe();
  const set = colorSetOf(c.colorSet);

  return (
    <li
      className={[styles.wrap, autoEditName ? styles.fresh : '', collapsing ? 'jb-row-collapsing' : '']
        .filter(Boolean).join(' ')}
      // MOTION #17：剛新增的卡從上方 10px 浮現（原本文件標已實作，e2e 量過其實沒有）
      style={autoEditName ? { ['--rise' as string]: `${DUR.riseIn}ms` } : undefined}
      data-collapsing={collapsing ? '' : undefined}
      data-testid={`cat-${c.id}`}
    >
      {/* 刪除鍵墊在卡片底下，卡片滑開才露出來 */}
      <button
        type="button"
        className={styles.delete}
        onClick={() => onDelete(c)}
        aria-label={`刪除 ${c.name}`}
        data-testid={`cat-${c.id}-delete`}
        tabIndex={swipe.open ? 0 : -1}
      >刪除</button>

      <div
        className={styles.card}
        style={{ ...swipe.style, touchAction: swipe.touchAction }}
        data-open={swipe.open ? '' : undefined}
        {...swipe.handlers}
      >
        <div className={styles.head}>
          <span className={styles.nameGroup}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setPickingIcon((v) => !v)}
              aria-expanded={pickingIcon}
              aria-label={`更換 ${c.name} 的圖示`}
              data-testid={`cat-${c.id}-icon`}
            >
              <Icon name={c.icon} size={22} box={32} boxRadius={11} tint={set.tint} />
            </button>

            <InlineEdit
              display={c.name}
              initial={c.name}
              startEditing={autoEditName}
              onCancel={onEditedName}
              onCommit={(name) => { onChange({ ...c, name }); onEditedName?.(); }}
              label={`分類名稱：${c.name}`}
              testId={`cat-${c.id}-name`}
            />
          </span>

          {/* 增補檔 B-2：收入分類沒有預算，不顯示金額 pill */}
          {c.kind === 'expense' && (
            <InlineEdit
              display={(
                <>
                  {formatCadWhole(c.budgetCents ?? 0, 'none')}
                  <span className={styles.perMonth}>／月</span>
                </>
              )}
              initial={String((c.budgetCents ?? 0) / 100)}
              onCommit={(v) => onChange({ ...c, budgetCents: toCents(v) })}
              label={`${c.name} 的月預算`}
              testId={`cat-${c.id}-budget`}
              variant="pill"
              inputMode="decimal"
            />
          )}
        </div>

        {pickingIcon && (
          <IconPicker
            value={c.icon}
            tint={set.tint}
            onPick={(icon) => { onChange({ ...c, icon }); setPickingIcon(false); }}
          />
        )}

        <div className={styles.subs} data-testid={`cat-${c.id}-subs`}>
          {c.subs.map((s) => (
            <button
              key={s.id}
              type="button"
              className={styles.chip}
              style={{ background: set.tint, color: set.color }}
              // §11-6：至少留一個，剩一個時不給刪
              disabled={c.subs.length <= 1}
              // §11-6 的「至少留一個」判定在 domain 的 removeSub 裡，這裡不重寫一次
              onClick={() => onChange(removeSub(c, s.id))}
              aria-label={`刪除子分類 ${s.name}`}
              data-testid={`sub-${s.id}`}
            >
              <span>{s.name}</span>
              <span aria-hidden="true">✕</span>
            </button>
          ))}

          {addingSub ? (
            <InlineEdit
              display="＋ 子分類"
              initial=""
              startEditing
              onCancel={() => setAddingSub(false)}
              onCommit={(name) => {
                setAddingSub(false);
                // 修剪與重名判定都在 domain 的 addSub 裡
                onChange(addSub(c, name));
              }}
              label="新子分類名稱"
              testId={`cat-${c.id}-newsub`}
            />
          ) : (
            <button
              type="button" className={styles.add} onClick={() => setAddingSub(true)}
              data-testid={`cat-${c.id}-addsub`}
            >＋ 子分類</button>
          )}
        </div>
      </div>
    </li>
  );
}
