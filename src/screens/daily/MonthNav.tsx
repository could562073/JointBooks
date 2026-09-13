import { DUR, EASE } from '../../lib/motion';
import styles from './MonthNav.module.css';
import { monthLabel } from './labels';

type Props = {
  year: number;
  month: number;
  /** 年月快速選擇器是否展開，決定標題的 ▾／▴ 與 aria-expanded */
  pickerOpen: boolean;
  onPrev(): void;
  onNext(): void;
  onTogglePicker(): void;
};

/**
 * §4 月份導覽（固定不捲動）。MOTION #33 的觸發點在標題鍵上。
 *
 * 這一層不自己算月份進退——跨年的正確性屬於 store 的 goMonth，已在
 * useLedger.test.ts 驗過，這裡重算一次只會多一個會分岔的來源。
 */
export function MonthNav({ year, month, pickerOpen, onPrev, onNext, onTogglePicker }: Props) {
  const { zh, en } = monthLabel(year, month);

  return (
    <nav className={styles.nav} data-testid="month-nav">
      {/* 原型把 ‹ 標題 › 綁成靠左的一組，右邊留白——不是三者平均散開 */}
      <div className={styles.group}>
        <button className={styles.arrow} onClick={onPrev} aria-label="上個月">‹</button>

        <button
          className={styles.title}
          onClick={onTogglePicker}
          aria-expanded={pickerOpen}
          data-testid="month-title"
        >
          <span className={styles.line}>
            <span className={styles.zh}>{zh}</span>
            {/* MOTION #33：▾ 轉 180° 而不是換成 ▴——同一個字元轉過去，動得起來 */}
            <span
              className={styles.chevron}
              style={{
                transform: pickerOpen ? 'rotate(180deg)' : 'none',
                transition: `transform ${DUR.chevron}ms ${EASE.exit}`,
              }}
              data-testid="month-chevron"
              aria-hidden="true"
            >
              ▾
            </span>
          </span>
          <span className={styles.en}>{en}</span>
        </button>

        <button className={styles.arrow} onClick={onNext} aria-label="下個月">›</button>
      </div>
    </nav>
  );
}
