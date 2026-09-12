import { Mantou } from '../../components/Mantou';
import { DUR } from '../../lib/motion';
import { useCountUp } from '../../lib/useCountUp';
import { formatCad } from '../../domain/money';
import styles from './SummaryCards.module.css';

type Props = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

/**
 * 增補檔 D-4：月結日固定 1 日，結餘卡副標固定顯示「本月」、不顯示區間。
 * （§4 原本寫「副標顯示結算期間」，增補檔優先。）
 */
const PERIOD_LABEL = '本月';

function Amount({ cents, signed }: { cents: number; signed: boolean }) {
  // MOTION #31：三個數字都要 count-up
  const shown = useCountUp(cents, DUR.countUp);
  return <span className={styles.value}>{formatCad(shown, signed ? 'auto' : 'none')}</span>;
}

/**
 * §4 收支三卡。三個數字都是**整月合計**，不隨選中日變動——選中日只影響下方的
 * 日期標題與明細。這是規格特別點出來的，寫在這裡免得之後有人「順手」接成當日。
 */
export function SummaryCards({ incomeCents, expenseCents, netCents }: Props) {
  return (
    <div className={styles.row} data-testid="summary-cards">
      <div className={`${styles.card} ${styles.income}`} data-testid="card-income">
        <span className={styles.label}>收入</span>
        <Amount cents={incomeCents} signed={false} />
      </div>

      <div className={`${styles.card} ${styles.expense}`} data-testid="card-expense">
        <span className={styles.label}>支出</span>
        <Amount cents={expenseCents} signed={false} />
      </div>

      <div className={`${styles.card} ${styles.net}`} data-testid="card-net">
        {/* MOTION #30：結餘卡的饅頭呆滯呼吸。寬度取 30px，對照原型再校準（D23） */}
        <Mantou variant="full" width={30} breathing className={styles.mascot} data-testid="net-mantou" />
        <span className={styles.label}>結餘</span>
        <Amount cents={netCents} signed />
        <span className={styles.sub}>{PERIOD_LABEL}</span>
      </div>
    </div>
  );
}
