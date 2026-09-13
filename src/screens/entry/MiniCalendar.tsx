import { useCallback, useState } from 'react';
import { daysInMonth, firstCellOffset, parseDate, weekdayLabels, type WeekStart } from '../../domain/date';
import { DUR } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { monthLabel } from '../daily/labels';
import { useMonthSwipe } from '../daily/useMonthSwipe';
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
 *
 * 換月（按鈕或左右滑）跟日常頁的大月曆同一套 MOTION #7：同一個 useMonthSwipe、
 * 同一組門檻與跟手比例、同樣自方向側 ±38px 滑入。兩個月曆手感不一樣會很怪。
 */
export function MiniCalendar({ value, onChange, onClose, weekStart = 'mon' }: Props) {
  const reduced = useReducedMotion();
  // seq 每換一次月就加一，讓格線重新掛上、滑入動畫重播；0 代表剛打開，不播
  const [slide, setSlide] = useState<{ dir: -1 | 1; seq: number }>({ dir: 1, seq: 0 });

  const go = useCallback((delta: number) => {
    setSlide((s) => ({ dir: delta > 0 ? 1 : -1, seq: s.seq + 1 }));
    onChange(shiftMonth(value, delta));
  }, [value, onChange]);

  const swipe = useMonthSwipe(go);

  const d = parseDate(value);
  const y = d.getFullYear();
  const m = d.getMonth();
  const selected = d.getDate();
  const offset = firstCellOffset(y, m, weekStart);
  const total = daysInMonth(y, m);
  const todayStr = today();

  const sliding = !reduced && slide.seq > 0;
  const slideDir = slide.dir > 0 ? 'next' : 'prev';

  return (
    <div className={styles.panel} data-testid="mini-calendar">
      <div className={styles.nav}>
        <button
          type="button" className={styles.arrow} aria-label="上個月"
          onClick={() => go(-1)}
        >‹</button>
        <span className={styles.title} data-testid="mini-title">{monthLabel(y, m).zh}</span>
        <button
          type="button" className={styles.arrow} aria-label="下個月"
          onClick={() => go(1)}
        >›</button>
      </div>

      <div className={styles.week}>
        {weekdayLabels(weekStart).map((label) => (
          <span key={label} className={styles.weekday}>{label}</span>
        ))}
      </div>

      {/*
        手勢掛在不會重掛的外框上：換月時內層格線會因為 key 改變而整個重建，
        掛在內層的話，一次滑動完成的瞬間就把正在追蹤的 pointer 弄丟了。
      */}
      <div
        className={styles.viewport}
        style={{ touchAction: swipe.touchAction, ['--slide' as string]: `${DUR.slide}ms` }}
        data-testid="mini-swipe"
        {...swipe.handlers}
      >
        <div
          key={slide.seq}
          className={[
            styles.grid,
            sliding ? (slide.dir > 0 ? styles.fromRight : styles.fromLeft) : '',
          ].filter(Boolean).join(' ')}
          style={swipe.dragging
            // 拖曳中跟手並淡出，關掉進場動畫免得兩者打架（MOTION #7）
            ? { transform: `translate3d(${swipe.offset}px, 0, 0)`, opacity: swipe.opacity, animation: 'none' }
            : undefined}
          data-slide={sliding ? slideDir : undefined}
          data-testid="mini-grid"
        >
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
