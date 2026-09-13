import { useMemo, useRef } from 'react';
import { ScrollThumb, TAB_BAR_INSET } from '../../components/ScrollThumb';
import { SegmentedControl, type Segment } from '../../components/SegmentedControl';
import { budgetRows, comparePrevious, totalsIn, trendSeries } from '../../domain/aggregate';
import { rangeOf } from '../../domain/date';
import { formatCadWhole } from '../../domain/money';
import type { Dimension } from '../../domain/types';
import { selectedDate as selectedDateOf, useLedger } from '../../store/useLedger';
import { BudgetList } from './BudgetList';
import { OverviewCard } from './OverviewCard';
import { budgetTotal, periodLabel } from './statsLabels';
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
  const quotaCents = useMemo(() => budgetTotal(budgets), [budgets]);
  // 只在捲動時出現的捲動條要跟著這個捲動區
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className={styles.screen} data-testid="stats-screen">
      {/*
        整頁一起捲動（跟原型的單一捲動容器一致），不像日常頁只有明細那一段捲——
        標題與週／月／年分段本來釘在頂端，但原型裡它們也是跟著內容一起捲走的。
      */}
      <ScrollThumb target={scrollRef} bottomInset={TAB_BAR_INSET} />
      <div ref={scrollRef} className={styles.scroll} data-testid="stats-scroll">
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>統計</h1>
          <p className={styles.subtitle}>how we did</p>
        </div>

        <div className={styles.tabs}>
          <SegmentedControl
            segments={DIMENSIONS}
            value={dimension}
            onChange={setDimension}
            testId="dimension"
          />
        </div>

        <OverviewCard
          totals={totals}
          periodLabel={periodLabel(dimension, range)}
          delta={delta}
        />

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.title}>趨勢</h2>
            <span className={styles.rule} aria-hidden="true" />
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                支出
                <span className={`${styles.swatch} ${styles.swatchExpense}`} aria-hidden="true" />
              </span>
              <span className={styles.legendItem}>
                收入
                <span className={`${styles.swatch} ${styles.swatchIncome}`} aria-hidden="true" />
              </span>
            </div>
          </div>
          {/* 換維度要重播描線與填充，key 帶著維度 */}
          <TrendChart points={trend} drawKey={dimension} />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.title}>預算</h2>
            <span className={styles.rule} aria-hidden="true" />
            <span className={styles.quota}>月額度 {formatCadWhole(quotaCents, 'none')}</span>
          </div>
          <BudgetList rows={budgets} fillKey={dimension} />
        </section>
      </div>
    </div>
  );
}
