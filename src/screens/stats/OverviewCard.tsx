import { Mantou } from '../../components/Mantou';
import type { Totals } from '../../domain/aggregate';
import { formatCad } from '../../domain/money';
import { DUR } from '../../lib/motion';
import { useCountUp } from '../../lib/useCountUp';
import { deltaLabel, expenseShare } from './statsLabels';
import styles from './OverviewCard.module.css';

type Props = {
  totals: Totals;
  periodLabel: string;
  delta: { deltaRatio: number; direction: 'up' | 'down' | 'flat' };
};

function Amount({ cents, sign, className, testId }: {
  cents: number; sign: 'auto' | 'none'; className: string | undefined; testId: string;
}) {
  // MOTION #11：三個數字都 count-up，換維度時從前一值跑到新值
  const shown = useCountUp(cents, DUR.countUp);
  return <span className={className} data-testid={testId}>{formatCad(shown, sign)}</span>;
}

/**
 * §6 結餘總覽卡。結餘、收入、支出三個數字都要 count-up（MOTION #11）。
 */
export function OverviewCard({ totals, periodLabel, delta }: Props) {
  const share = expenseShare(totals.incomeCents, totals.expenseCents);

  return (
    <div className={styles.card} data-testid="overview-card">
      <div className={styles.top}>
        <div>
          <span className={styles.period} data-testid="overview-period">{periodLabel}</span>
          <Amount
            cents={totals.netCents} sign="auto"
            className={styles.net} testId="overview-net"
          />
        </div>
        {/* MOTION #30：饅頭呆滯呼吸 */}
        <Mantou variant="full" width={44} breathing className={styles.mascot} data-testid="overview-mantou" />
      </div>

      <span
        className={styles.delta}
        data-direction={delta.direction}
        data-testid="overview-delta"
      >{deltaLabel(delta.deltaRatio, delta.direction)}</span>

      <div className={styles.split}>
        <div className={styles.col}>
          <span className={styles.colLabel}>收入</span>
          <Amount
            cents={totals.incomeCents} sign="none"
            className={styles.income} testId="overview-income"
          />
        </div>
        <div className={styles.col}>
          <span className={styles.colLabel}>支出</span>
          <Amount
            cents={totals.expenseCents} sign="none"
            className={styles.expense} testId="overview-expense"
          />
        </div>
      </div>

      <div className={styles.bar} data-testid="overview-bar">
        <span
          className={styles.barExpense}
          style={{ width: `${(share * 100).toFixed(2)}%` }}
          data-testid="overview-bar-expense"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
