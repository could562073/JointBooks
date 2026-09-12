import type { CalendarCollapse } from './useCalendarCollapse';
import styles from './CalendarHandle.module.css';

type Props = Pick<CalendarCollapse, 'hint' | 'handlers' | 'touchAction' | 'collapsed'>;

/**
 * §4 把手。狀態與門檻都在 useCalendarCollapse 裡，這支只負責畫出來並轉發事件。
 */
export function CalendarHandle({ hint, handlers, touchAction, collapsed }: Props) {
  return (
    <div
      className={styles.wrap}
      style={{ touchAction }}
      data-testid="calendar-handle"
      data-collapsed={collapsed ? '' : undefined}
      {...handlers}
    >
      <span className={styles.bar} aria-hidden="true" />
      <span className={styles.hint}>{hint}</span>
    </div>
  );
}
