import { useMemo } from 'react';
import { SegmentedControl, type Segment } from '../../components/SegmentedControl';
import { budgetRows, comparePrevious, totalsIn, trendSeries } from '../../domain/aggregate';
import { rangeOf } from '../../domain/date';
import type { Dimension } from '../../domain/types';
import { selectedDate as selectedDateOf, useLedger } from '../../store/useLedger';
import { BudgetList } from './BudgetList';
import { OverviewCard } from './OverviewCard';
import { periodLabel, trendAxisNote } from './statsLabels';
import { TrendChart } from './TrendChart';
import styles from './StatsScreen.module.css';

const DIMENSIONS: readonly Segment<Dimension>[] = [
  { key: 'week', label: '週' },
  { key: 'month', label: '月' },
  { key: 'year', label: '年' },
];

/**
 * §6 統計頁。四塊內容都由 domain/aggregate 算好（Plan 02），這支負責組版面
 * 與維度切換。
 *
 * 錨點用日常頁的選中日，不是今天——使用者在月曆上挑了一天再切到統計頁時，
 * 看的應該是那一天所在的期間。
 */
export function StatsScreen() {
  const dimension = useLedger((s) => s.dimension);
  const setDimension = useLedger((s) => s.setDimension);
  const txns = useLedger((s) => s.txns);
  const categories = useLedger((s) => s.categories);
  const anchor = useLedger(selectedDateOf);

  const range = useMemo(() => rangeOf(dimension, anchor), [dimension, anchor]);
  const totals = useMemo(
    () => totalsIn(txns, range, categories), [txns, range, categories]
  );
  const delta = useMemo(
    () => comparePrevious(txns, dimension, anchor, categories),
    [txns, dimension, anchor, categories]
  );
  const trend = useMemo(
    () => trendSeries(txns, dimension, anchor, categories),
    [txns, dimension, anchor, categories]
  );
  const budgets = useMemo(
    () => budgetRows(txns, categories, dimension, anchor),
    [txns, categories, dimension, anchor]
  );

  return (
    <div className={styles.screen} data-testid="stats-screen">
      <div className={styles.head}>
        <SegmentedControl
          segments={DIMENSIONS}
          value={dimension}
          onChange={setDimension}
          testId="dimension"
        />
      </div>

      {/* 統計頁整頁捲動，跟日常頁的「只有明細捲」不同 */}
      <div className={styles.scroll} data-testid="stats-scroll">
        <OverviewCard
          totals={totals}
          periodLabel={periodLabel(dimension, range)}
          delta={delta}
        />

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.title}>趨勢</h2>
            <span className={styles.note}>{trendAxisNote(dimension)}</span>
          </div>
          {/* 換維度要重播描線與填充，key 帶著維度 */}
          <TrendChart points={trend} drawKey={dimension} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.title}>預算使用</h2>
          <BudgetList rows={budgets} fillKey={dimension} />
        </section>
      </div>
    </div>
  );
}
