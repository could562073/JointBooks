import { daysInMonth, firstCellOffset, isWeekend, weekdayLabels, type WeekStart } from '../../domain/date';
import type { DayCell } from '../../domain/aggregate';
import { formatCompact } from '../../domain/money';
import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { CELL_CONTENT_H, cellPosition, heatColor, rowCount, SLIDER_WIDTH, sliderOffset } from './calendarLayout';
import { useCellPop } from './useCellPop';
import styles from './MonthCalendar.module.css';

type Props = {
  year: number;
  month: number;
  cells: DayCell[];
  selectedDay: number;
  /** 今天的 YYYY-MM-DD；不在本月時就沒有格子會被標成今天 */
  todayDate: string;
  /** §7 的「週起始」設定。星期列與首格空白數都跟著它走（§15.1-3） */
  weekStart?: WeekStart;
  onSelectDay(day: number): void;
};

export function MonthCalendar({
  year, month, cells, selectedDay, todayDate, weekStart = 'mon', onSelectDay,
}: Props) {
  const reduced = useReducedMotion();
  const offset = firstCellOffset(year, month, weekStart);
  const rows = rowCount(offset, daysInMonth(year, month));
  const sel = sliderOffset(cellPosition(offset, selectedDay));
  const popping = useCellPop(year, month, cells);

  return (
    <div className={styles.wrap} data-testid="month-calendar">
      <div className={styles.week}>
        {weekdayLabels(weekStart).map((label, col) => (
          <span
            key={label}
            className={`${styles.weekday} ${isWeekend(col, weekStart) ? styles.weekend : ''}`}
            data-weekend={isWeekend(col, weekStart) ? '' : undefined}
          >
            {label}
          </span>
        ))}
      </div>

      <div
        className={styles.grid}
        style={{ gridTemplateRows: `repeat(${rows}, ${CELL_CONTENT_H}px)` }}
        data-testid="month-grid"
      >
        {/* 1 號之前的空格：用 aria-hidden 的佔位，不要用空 button 免得被 tab 到 */}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad${i}`} aria-hidden="true" />
        ))}

        {cells.map((c) => {
          const isToday = c.date === todayDate;
          return (
            <button
              key={c.date}
              type="button"
              className={styles.cell}
              style={{ background: heatColor(c.heat) }}
              onClick={() => onSelectDay(c.day)}
              aria-pressed={c.day === selectedDay}
              data-testid={`cell-${c.day}`}
              data-today={isToday ? '' : undefined}
            >
              <span className={`${styles.day} ${isToday ? styles.today : ''}`}>{c.day}</span>
              {c.expenseCents > 0 && (
                <span
                  // MOTION #4：金額變動時跳一下。reduced-motion 不掛動畫
                  className={
                    !reduced && popping.has(c.day) ? `${styles.spend} ${styles.pop}` : styles.spend
                  }
                  style={{ ['--pop' as string]: `${DUR.calCellPop}ms` }}
                  data-popping={popping.has(c.day) ? '' : undefined}
                >{formatCompact(c.expenseCents)}</span>
              )}
              {c.hasIncome && <span className={styles.incomeMark} data-testid={`income-${c.day}`} />}
            </button>
          );
        })}

        <span
          className={styles.slider}
          data-testid="calendar-slider"
          style={{
            left: sel.left,
            top: sel.top,
            width: SLIDER_WIDTH,
            transition: reduced ? 'none' : `left ${DUR.calSnap}ms ${EASE.move}, top ${DUR.calSnap}ms ${EASE.move}`,
          }}
        />
      </div>
    </div>
  );
}
