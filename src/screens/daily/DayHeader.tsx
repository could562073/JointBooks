import { formatCad } from '../../domain/money';
import { DUR } from '../../lib/motion';
import { useCountUp } from '../../lib/useCountUp';
import { dayTitle } from './labels';
import styles from './DayHeader.module.css';

type Props = {
  year: number;
  month: number;
  day: number;
  /** 當日支出合計（分）。原型的 selTot 只加支出，收入不進這個數字 */
  expenseCents: number;
};

export function DayHeader({ year, month, day, expenseCents }: Props) {
  // 換日期時重跑 count-up（§4：點不同日期跑 480ms）
  const shown = useCountUp(expenseCents, DUR.dayTotal);

  return (
    <div className={styles.row} data-testid="day-header">
      <span className={styles.title}>{dayTitle(year, month, day)}</span>
      {/* 這天沒有支出時原型顯示破折號而不是 $0.00，留白比零更像「沒有紀錄」 */}
      <span className={styles.total} data-testid="day-total">
        {expenseCents > 0 ? formatCad(shown, 'minus') : '—'}
      </span>
    </div>
  );
}
