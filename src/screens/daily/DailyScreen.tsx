import { useCallback, useMemo, useState } from 'react';
import { calendarCells, dayTotal, totalsIn, txnsOn } from '../../domain/aggregate';
import { rangeOf, todayLocal } from '../../domain/date';
import type { Txn } from '../../domain/types';
import { DUR } from '../../lib/motion';
import { selectedDate as selectedDateOf, useLedger } from '../../store/useLedger';
import { CalendarHandle } from './CalendarHandle';
import { DayHeader } from './DayHeader';
import { Fab } from './Fab';
import { MonthCalendar } from './MonthCalendar';
import { MonthNav } from './MonthNav';
import { MonthPicker } from './MonthPicker';
import { PullIndicator } from './PullIndicator';
import { SummaryCards } from './SummaryCards';
import { TxnList } from './TxnList';
import { useCalendarCollapse } from './useCalendarCollapse';
import { useMonthSwipe } from './useMonthSwipe';
import { usePullRefresh } from './usePullRefresh';
import styles from './DailyScreen.module.css';

type Props = {
  /** 點明細列進編輯（Plan 05 的記一筆面板） */
  onEdit(txn: Txn): void;
  /** 點右下懸浮 ＋ 記一筆 */
  onAdd(): void;
};

/**
 * §4 日常頁容器。
 *
 * 版面規則：外層不捲動，只有明細區有自己的 scroll。這是「收起／展開後明細的
 * scroll 位置不重置」的前提——TxnList 從頭到尾掛著沒被卸載，收合只改上方
 * 區塊的 max-height，捲動容器本身沒動過，位置自然就留著。
 *
 * 收支三卡與月曆放在同一個收合區（跟原型的 460px 一致）：把手收的是這一塊，
 * 年月選擇器展開時強制收的也是這一塊，兩個需求指向同一個區域。
 */
export function DailyScreen({ onEdit, onAdd }: Props) {
  const { year, month, selectedDay, categories, txns, showWhoTags } = useLedger();
  const goMonth = useLedger((s) => s.goMonth);
  const setMonth = useLedger((s) => s.setMonth);
  const selectDay = useLedger((s) => s.selectDay);

  const [pickerOpen, setPickerOpen] = useState(false);
  // 換月後的方向性滑入（MOTION #7、#34）。用計數器當 key，同方向連續換月也會重播
  const [slide, setSlide] = useState<{ dir: -1 | 1; seq: number }>({ dir: 1, seq: 0 });

  const collapse = useCalendarCollapse(false, pickerOpen);

  const shiftMonth = useCallback(
    (delta: number) => {
      goMonth(delta);
      setSlide((s) => ({ dir: delta < 0 ? -1 : 1, seq: s.seq + 1 }));
    },
    [goMonth]
  );

  const swipe = useMonthSwipe(shiftMonth);
  // §10 #27：目前重讀的是本機 Dexie；接上 Sheets 同步是 Plan 08
  const reload = useLedger((s) => s.load);
  const pull = usePullRefresh(reload);

  const selectedDate = useLedger(selectedDateOf);

  const cells = useMemo(
    () => calendarCells(txns, year, month, categories),
    [txns, year, month, categories]
  );
  const monthTotals = useMemo(
    () => totalsIn(txns, rangeOf('month', selectedDate), categories),
    [txns, selectedDate, categories]
  );
  const dayRows = useMemo(() => txnsOn(txns, selectedDate), [txns, selectedDate]);
  const dayExpense = useMemo(
    () => dayTotal(txns, selectedDate, categories).expenseCents,
    [txns, selectedDate, categories]
  );

  function pickMonth(y: number, m: number, direction: -1 | 1) {
    setMonth(y, m);
    setPickerOpen(false);
    setSlide((s) => ({ dir: direction, seq: s.seq + 1 }));
  }

  return (
    <div className={styles.screen} data-testid="daily-screen">
      <MonthNav
        year={year}
        month={month}
        pickerOpen={pickerOpen}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        onTogglePicker={() => setPickerOpen((o) => !o)}
      />

      {pickerOpen && (
        <MonthPicker
          year={year}
          month={month}
          onPick={pickMonth}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {/* 收合區：收支三卡 + 月曆。把手與選擇器收的都是這一塊 */}
      <div className={styles.collapsible} style={collapse.style} data-testid="calendar-region">
        <div
          key={slide.seq}
          className={`${styles.sliding} ${slide.dir > 0 ? styles.fromRight : styles.fromLeft}`}
          style={{
            ['--slide' as string]: `${DUR.slide}ms`,
            // 跟手期間直接吃位移，不要疊上進場動畫
            transform: swipe.dragging ? `translate3d(${swipe.offset}px, 0, 0)` : undefined,
            opacity: swipe.dragging ? swipe.opacity : undefined,
            // 跟手期間關掉進場動畫，否則位移會跟動畫互相打架
            animation: swipe.dragging ? 'none' : undefined,
          }}
          data-testid="month-body"
        >
          <SummaryCards
            incomeCents={monthTotals.incomeCents}
            expenseCents={monthTotals.expenseCents}
            netCents={monthTotals.netCents}
          />
          <div style={{ touchAction: swipe.touchAction }} {...swipe.handlers}>
            <MonthCalendar
              year={year}
              month={month}
              cells={cells}
              selectedDay={selectedDay}
              todayDate={todayLocal()}
              onSelectDay={selectDay}
            />
          </div>
        </div>
      </div>

      <CalendarHandle
        hint={collapse.hint}
        handlers={collapse.handlers}
        touchAction={collapse.touchAction}
        collapsed={collapse.collapsed}
      />

      <DayHeader year={year} month={month} day={selectedDay} expenseCents={dayExpense} />

      {/*
        整頁唯一的捲動容器。收合不卸載它，捲動位置才不會被重置。
        下拉重整的事件掛在這裡，但不套 touch-action:none——那會把原生捲動關掉；
        守門在 usePullRefresh 裡（捲到頂 + 往下拉才接管）。
      */}
      <div className={styles.scroll} data-testid="txn-scroll" {...pull.handlers}>
        <PullIndicator phase={pull.phase} offset={pull.offset} />
        <TxnList
          txns={dayRows}
          categories={categories}
          showWhoTags={showWhoTags}
          onEdit={onEdit}
        />
      </div>

      {/* §4：只有這一頁有，且 position:fixed 不隨明細捲動 */}
      <Fab onClick={onAdd} />
    </div>
  );
}
