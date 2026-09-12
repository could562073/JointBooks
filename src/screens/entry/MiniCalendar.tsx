import { daysInMonth, firstCellOffset, parseDate, weekdayLabels, type WeekStart } from '../../domain/date';
import { monthLabel } from '../daily/labels';
import { shiftMonth, today, withDay } from './datePick';
import styles from './MiniCalendar.module.css';

type Props = {
  /** 目前選中的 YYYY-MM-DD */
  value: string;
  onChange(date: string): void;
  onClose(): void;
  weekStart?: WeekStart;
};

/**
 * §5 日期欄展開的小月曆（MOTION #38）。
 *
 * 它沒有自己的「正在瀏覽哪個月」狀態——`‹ ›` 直接移動選中日（見 datePick 的
 * 說明）。少一個狀態就少一個會跟 value 對不上的地方。
 */
export function MiniCalendar({ value, onChange, onClose, weekStart = 'mon' }: Props) {
  const d = parseDate(value);
  const y = d.getFullYear();
  const m = d.getMonth();
  const selected = d.getDate();
  const offset = firstCellOffset(y, m, weekStart);
  const total = daysInMonth(y, m);
  const todayStr = today();

  return (
    <div className={styles.panel} data-testid="mini-calendar">
      <div className={styles.nav}>
        <button
          type="button" className={styles.arrow} aria-label="上個月"
          onClick={() => onChange(shiftMonth(value, -1))}
        >‹</button>
        <span className={styles.title} data-testid="mini-title">{monthLabel(y, m).zh}</span>
        <button
          type="button" className={styles.arrow} aria-label="下個月"
          onClick={() => onChange(shiftMonth(value, 1))}
        >›</button>
      </div>

      <div className={styles.week}>
        {weekdayLabels(weekStart).map((label) => (
          <span key={label} className={styles.weekday}>{label}</span>
        ))}
      </div>

      <div className={styles.grid}>
        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} aria-hidden="true" />
        ))}
        {Array.from({ length: total }, (_, i) => {
          const day = i + 1;
          const date = withDay(value, day);
          return (
            <button
              key={day}
              type="button"
              className={styles.cell}
              data-selected={day === selected ? '' : undefined}
              data-today={date === todayStr ? '' : undefined}
              aria-pressed={day === selected}
              data-testid={`mini-day-${day}`}
              // §5：選日後即收合
              onClick={() => { onChange(date); onClose(); }}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className={styles.actions}>
        <button
          type="button" className={styles.todayBtn} data-testid="mini-today"
          onClick={() => { onChange(todayStr); onClose(); }}
        >今天</button>
        <button
          type="button" className={styles.closeBtn} data-testid="mini-close"
          onClick={onClose}
        >收起</button>
      </div>
    </div>
  );
}
