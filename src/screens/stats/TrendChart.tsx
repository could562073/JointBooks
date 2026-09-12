import type { TrendPoint } from '../../domain/aggregate';
import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import {
  areaPath, chartPoints, pathLength, polyline, seriesMax, VIEW,
} from './trendGeometry';
import styles from './TrendChart.module.css';

type Props = {
  points: TrendPoint[];
  /** 換維度時重播描線動畫（MOTION #11）用的 key */
  drawKey: string;
};

/**
 * §6 趨勢折線。支出實線、收入虛線、支出下方淡色面積、最後一點加大。
 *
 * 座標全部在 trendGeometry 算好（專案分層規則 R1），這支只負責畫。
 */
export function TrendChart({ points, drawKey }: Props) {
  const reduced = useReducedMotion();

  const expense = points.map((p) => p.expenseCents);
  const income = points.map((p) => p.incomeCents);
  const max = seriesMax(expense, income);
  const ePts = chartPoints(expense, max);
  const iPts = chartPoints(income, max);
  const last = ePts[ePts.length - 1];

  // MOTION #11：stroke-dashoffset 100%→0。長度自己算，不必碰 DOM
  const len = pathLength(ePts);
  const drawing = !reduced && len > 0;

  return (
    <div className={styles.wrap} data-testid="trend-chart">
      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        className={styles.svg}
        role="img"
        aria-label="收支趨勢"
        preserveAspectRatio="none"
      >
        {/* key 帶著維度，換維度就重掛一次讓描線動畫重播 */}
        <g key={drawKey}>
          {/* §6：支出下方淡色面積 */}
          {ePts.length >= 2 && (
            <path d={areaPath(ePts)} className={styles.area} data-testid="trend-area" />
          )}

          {/* §6：收入虛線 */}
          {iPts.length >= 2 && (
            <polyline points={polyline(iPts)} className={styles.income} data-testid="trend-income" />
          )}

          {/* §6：支出實線 */}
          {ePts.length >= 2 && (
            <polyline
              points={polyline(ePts)}
              className={drawing ? `${styles.expense} ${styles.drawIn}` : styles.expense}
              style={drawing ? {
                // dasharray 要等於整條線長，dashoffset 才能從「整條藏起來」跑到 0
                strokeDasharray: len,
                ['--len' as string]: len,
                ['--draw' as string]: `${DUR.trendDraw}ms`,
                ['--ease' as string]: EASE.move,
              } : undefined}
              data-testid="trend-expense"
            />
          )}

          {/* §6：最後一點加大 */}
          {last && (
            <circle cx={last.x} cy={last.y} r={4} className={styles.lastDot} data-testid="trend-last" />
          )}
        </g>
      </svg>

      <div className={styles.axis} data-testid="trend-axis">
        {points.map((p, i) => (
          <span key={`${p.label}-${i}`} className={styles.tick}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}
