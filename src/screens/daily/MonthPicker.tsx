import { useState } from 'react';
import { DUR } from '../../lib/motion';
import { isCurrentMonthCell, monthSlideDirection, pickerYears } from './picker';
import styles from './MonthPicker.module.css';

type Props = {
  /** 目前真正在看的年月，用來標出哪一格是選中的 */
  year: number;
  month: number;
  /** 選完月份。direction 給外層播方向性滑入（MOTION #34） */
  onPick(y: number, m: number, direction: -1 | 1): void;
  onClose(): void;
};

/**
 * §4 年月快速選擇器（MOTION #33 進場、#34 換年）。
 *
 * 錨點年是這支自己的 state，不進 store：翻年份 pill 的時候還沒真的換月，
 * 標題和月曆都不該跟著動，這個中間狀態離開選擇器就沒有意義了。
 *
 * 動畫走 CSS 類別而不是從 JS 組 animation 字串——keyframes 名稱在 CSS Modules
 * 裡會被改寫，從 JS 端引用要多一層假設。時長仍由 DUR 經 CSS 變數傳進去，
 * 常數維持單一來源。
 */
export function MonthPicker({ year, month, onPick, onClose }: Props) {
  const [anchor, setAnchor] = useState(year);
  // 年份列的滑入方向。用 key 重掛 DOM 來重播 CSS 動畫，比原型的 flip 布林乾淨
  const [yearDir, setYearDir] = useState<-1 | 1>(1);

  function shiftYear(delta: -1 | 1) {
    setAnchor((a) => a + delta);
    setYearDir(delta);
  }

  /** 直接點 pill 也算換年，方向看點到的年份在錨點的哪一邊（MOTION #34） */
  function pickYear(y: number) {
    if (y === anchor) return;
    setYearDir(y > anchor ? 1 : -1);
    setAnchor(y);
  }

  return (
    <div
      className={styles.panel}
      style={{ ['--panel-in' as string]: `${DUR.yearPanelIn}ms`, ['--slide' as string]: `${DUR.slide}ms` }}
      data-testid="month-picker"
    >
      <div className={styles.yearRow}>
        <button className={styles.yearArrow} onClick={() => shiftYear(-1)} aria-label="前一年">‹</button>

        <div className={styles.years} data-testid="year-pills" data-dir={yearDir}>
          {pickerYears(anchor).map((y) => (
            <button
              key={y}
              className={styles.yearPill}
              data-selected={y === anchor ? '' : undefined}
              aria-pressed={y === anchor}
              // 原型的年份 pill 只寫數字；念給螢幕閱讀器時補上「年」
              aria-label={`${y}年`}
              onClick={() => pickYear(y)}
            >
              {y}
            </button>
          ))}
        </div>

        <button className={styles.yearArrow} onClick={() => shiftYear(1)} aria-label="後一年">›</button>
      </div>

      {/* MOTION #34：換年時滑動的是月方格整區，不是年份列。
          key 帶著錨點，換年就重新掛載一次，CSS 動畫才會重播 */}
      <div
        key={anchor}
        className={`${styles.months} ${yearDir > 0 ? styles.fromRight : styles.fromLeft}`}
        data-testid="month-grid"
      >
        {Array.from({ length: 12 }, (_, i) => {
          const current = isCurrentMonthCell(anchor, year, month, i);
          return (
            <button
              key={i}
              className={styles.monthCell}
              data-current={current ? '' : undefined}
              aria-pressed={current}
              data-testid={`picker-month-${i}`}
              onClick={() => onPick(anchor, i, monthSlideDirection(year, month, anchor, i))}
            >
              {i + 1}月
            </button>
          );
        })}
      </div>

      <button className={styles.close} onClick={onClose} data-testid="picker-close">收起</button>
    </div>
  );
}
