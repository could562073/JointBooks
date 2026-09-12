import { Icon } from '../../components/Icon';
import type { BudgetRow } from '../../domain/aggregate';
import { colorSetOf } from '../../domain/palette';
import { formatCad } from '../../domain/money';
import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import styles from './BudgetList.module.css';

/** §6：超支轉橘、>85% 轉黃、否則用分類色 */
const STATE_FILL: Record<BudgetRow['state'], string | null> = {
  over: '#E08A72',
  warn: '#F2C97A',
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
        const fill = STATE_FILL[r.state] ?? colorSetOf(r.colorSet).color;
        return (
          <li key={r.categoryId} className={styles.row} data-testid={`budget-${r.categoryId}`}>
            <Icon
              name={r.icon} size={16} box={28} boxRadius={9}
              tint={colorSetOf(r.colorSet).tint}
            />

            <div className={styles.mid}>
              <div className={styles.head}>
                <span className={styles.name}>{r.name}</span>
                <span className={styles.numbers} data-testid={`budget-${r.categoryId}-numbers`}>
                  {formatCad(r.spentCents, 'none')} / {formatCad(r.budgetCents, 'none')}
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

              {r.state === 'over' && (
                <span className={styles.over} data-testid={`budget-${r.categoryId}-over`}>
                  超支 {formatCad(r.overCents, 'none')}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
