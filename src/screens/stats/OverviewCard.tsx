import { Mantou } from '../../components/Mantou';
import type { Totals } from '../../domain/aggregate';
import { formatCadWhole } from '../../domain/money';
import { DUR } from '../../lib/motion';
import { useCountUp } from '../../lib/useCountUp';
import { deltaLabel, expenseOfIncomeRatio } from './statsLabels';
import styles from './OverviewCard.module.css';

type Props = {
  totals: Totals;
  /** 「本週結餘」這類標題（statsLabels.balanceTitle） */
  title: string;
  /** 標題旁的期間「9/8 ~ 9/14」（statsLabels.periodSpan） */
  periodLabel: string;
  delta: { deltaRatio: number; direction: 'up' | 'down' | 'flat' };
};

function Amount({ cents, sign, className, testId }: {
  cents: number; sign: 'auto' | 'none'; className: string | undefined; testId: string;
}) {
  // MOTION #11：三個數字都 count-up，換維度時從前一值跑到新值
  const shown = useCountUp(cents, DUR.countUp);
  // 原型的合計數字只到元，不顯示角分
  return <span className={className} data-testid={testId}>{formatCadWhole(shown, sign)}</span>;
}

/**
 * §6 結餘總覽卡。結餘、收入、支出三個數字都要 count-up（MOTION #11）。
 */
export function OverviewCard({ totals, title, periodLabel, delta }: Props) {
  // 支出欄下方那條進度條：花掉了收入的幾成（不是支出佔收支合計的比例）
  const ratio = expenseOfIncomeRatio(totals.incomeCents, totals.expenseCents);

  return (
    <div className={styles.card} data-testid="overview-card">
      <div className={styles.top}>
        <div className={styles.label}>
          {title}
          <span className={styles.period} data-testid="overview-period">{periodLabel}</span>
        </div>

        <span
          className={styles.delta}
          data-direction={delta.direction}
          data-testid="overview-delta"
        >{deltaLabel(delta.deltaRatio, delta.direction)}</span>
      </div>

      <div className={styles.netRow}>
        <Amount
          cents={totals.netCents} sign="auto"
          className={styles.net} testId="overview-net"
        />
        {/* MOTION #30：饅頭呆滯呼吸 */}
        <Mantou variant="full" width={37} breathing className={styles.mascot} data-testid="overview-mantou" />
      </div>

      <div className={styles.split}>
        <div className={styles.col}>
          <span className={styles.colLabel}>收入</span>
          <Amount
            cents={totals.incomeCents} sign="none"
            className={styles.income} testId="overview-income"
          />
          {/* 原型如此：收入欄下方是固定滿版的裝飾色條，不隨資料變動 */}
          <span className={styles.incomeBar} aria-hidden="true" />
        </div>
        <div className={styles.col}>
          <span className={styles.colLabel}>支出</span>
          <Amount
            cents={totals.expenseCents} sign="none"
            className={styles.expense} testId="overview-expense"
          />
          <span className={styles.expenseTrack} data-testid="overview-bar" aria-hidden="true">
            <span
              className={styles.expenseFill}
              style={{ width: `${(ratio * 100).toFixed(2)}%` }}
              data-testid="overview-bar-expense"
            />
          </span>
        </div>
      </div>
    </div>
  );
}
