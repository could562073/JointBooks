import { Icon } from '../../components/Icon';
import type { BudgetRow } from '../../domain/aggregate';
import { colorSetOf } from '../../domain/palette';
import { formatCadWhole } from '../../domain/money';
import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import styles from './BudgetList.module.css';

/**
 * §6：超支轉橘、>85% 轉黃、否則用分類色。
 * 全部用淡色系（使用者要求：深色的條太壓迫）——分類色取調色盤的 blob（饅頭身體那一階），
 * 不是給文字用的深色 color。
 */
const STATE_FILL: Record<BudgetRow['state'], string | null> = {
  over: '#F2B3A0',
  warn: '#F6D89A',
  normal: null,
};

type Props = {
  rows: BudgetRow[];
  /** 換維度時重播填充動畫（MOTION #12）用的 key */
  fillKey: string;
};

/**
 * §6 預算使用。每個主分類一條「已花 / 預算」。
 * 分母的維度倍率在 domain 的 budgetRows 算好（增補檔 D-1），這支只負責畫。
 */
export function BudgetList({ rows, fillKey }: Props) {
  const reduced = useReducedMotion();

  if (rows.length === 0) {
    return (
      <p className={styles.empty} data-testid="budget-empty">還沒有設定預算的分類</p>
    );
  }

  return (
    <ul className={styles.list} data-testid="budget-list">
      {rows.map((r, i) => {
        const fill = STATE_FILL[r.state] ?? colorSetOf(r.colorSet).blob;
        return (
          <li key={r.categoryId} className={styles.row} data-testid={`budget-${r.categoryId}`}>
            <div className={styles.head}>
              <span className={styles.nameGroup}>
                <Icon
                  name={r.icon} size={17} box={22} boxRadius={8}
                  tint={colorSetOf(r.colorSet).tint}
                />
                <span className={styles.name}>{r.name}</span>
              </span>
              <span className={styles.numbers} data-testid={`budget-${r.categoryId}-numbers`}>
                {formatCadWhole(r.spentCents, 'none')} / {formatCadWhole(r.budgetCents, 'none')}
              </span>
            </div>

            <div className={styles.track}>
              <span
                // key 帶著維度與序號，換維度就重掛讓填充動畫重播
                key={fillKey}
                className={reduced ? styles.bar : `${styles.bar} ${styles.fill}`}
                style={{
                  // 超支時條滿格，多出來的部分靠文字說明，不要畫出軌道外
                  width: `${Math.min(1, r.ratio) * 100}%`,
                  background: fill,
                  ['--fill' as string]: `${DUR.budgetFill}ms`,
                  ['--delay' as string]: `${i * DUR.budgetStagger}ms`,
                  ['--flash' as string]: `${DUR.budgetFlash}ms`,
                  ['--ease' as string]: EASE.move,
                }}
                data-state={r.state}
                data-testid={`budget-${r.categoryId}-bar`}
              />
            </div>

            {r.state === 'over' ? (
              <span className={styles.over} data-testid={`budget-${r.categoryId}-over`}>
                超支 {formatCadWhole(r.overCents, 'none')}
              </span>
            ) : (
              <span className={styles.remaining}>
                還可以花 {formatCadWhole(r.budgetCents - r.spentCents, 'none')}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
