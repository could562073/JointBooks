import { daysInMonth, firstCellOffset, isWeekend, weekdayLabels } from '../../domain/date';
import type { DayCell } from '../../domain/aggregate';
import { formatCompact } from '../../domain/money';
import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { CELL_H, cellPosition, heatColor, rowCount, sliderOffset } from './calendarLayout';
import styles from './MonthCalendar.module.css';

type Props = {
  year: number;
  month: number;
  cells: DayCell[];
  selectedDay: number;
  /** 今天的 YYYY-MM-DD；不在本月時就沒有格子會被標成今天 */
  todayDate: string;
  onSelectDay(day: number): void;
};

export function MonthCalendar({ year, month, cells, selectedDay, todayDate, onSelectDay }: Props) {
  const reduced = useReducedMotion();
  const offset = firstCellOffset(year, month);
  const rows = rowCount(offset, daysInMonth(year, month));
  const sel = sliderOffset(cellPosition(offset, selectedDay));

  return (
    <div className={styles.wrap} data-testid="month-calendar">
      <div className={styles.week}>
        {weekdayLabels().map((label, col) => (
          <span
            key={label}
            className={`${styles.weekday} ${isWeekend(col) ? styles.weekend : ''}`}
            data-weekend={isWeekend(col) ? '' : undefined}
          >
            {label}
          </span>
        ))}
      </div>

      <div
        className={styles.grid}
        style={{ ['--cell-h' as string]: `${CELL_H}px`, gridTemplateRows: `repeat(${rows}, ${CELL_H}px)` }}
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
                <span className={styles.spend}>{formatCompact(c.expenseCents)}</span>
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
            transition: reduced ? 'none' : `left ${DUR.calSnap}ms ${EASE.move}, top ${DUR.calSnap}ms ${EASE.move}`,
          }}
        />
      </div>
    </div>
  );
}
