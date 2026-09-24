import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatCad, pushDigit } from '../../domain/money';
import type { Category, Txn } from '../../domain/types';
import { DUR, EASE } from '../../lib/motion';
import { usePresence } from '../../lib/usePresence';
import { Mantou } from '../../components/Mantou';
import { useLedger } from '../../store/useLedger';
import { useReducedMotion } from '../../lib/useReducedMotion';
import type { NewTxnInput } from '../../repo/ledgerRepo';
import { keyChar, type KeypadKey } from './amountInput';
import { CategoryPicker } from './CategoryPicker';
import {
  canSave, draftForNew, draftFromTxn, setKind, setMain, showsTotal, toInput, totalCents,
  type AmountField, type EntryDraft,
} from './entryDraft';
import { Keypad } from './Keypad';
import { KindSegment } from './KindSegment';
import { MiniCalendar } from './MiniCalendar';
import { useSheetDismiss } from './useSheetDismiss';
import { useBackToClose } from '../../lib/useBackToClose';
import styles from './EntrySheet.module.css';

/** 金額還是 0（或只打了 0.）時用淡色字，跟原型的空狀態一樣 */
function isBlank(v: string): boolean {
  return v === '' || /^0?(\.0*)?$/.test(v);
}

type Props = {
  categories: Category[];
  /** 新增模式的預設日期＝月曆上的選中日 */
  defaultDate: string;
  /** 有值就是編輯模式 */
  txn?: Txn;
  onSave(input: NewTxnInput): void;
  onDelete?(id: string): void;
  onClose(): void;
  onAddMain(name: string): Promise<string> | string;
  onAddSub(mainId: string, name: string): Promise<string> | string;
};

/**
 * §5 記一筆／編輯面板。同一個面板兩種模式：有 txn 就是編輯（欄位帶入原值）。
 *
 * 版面照原型：分類與子分類一直展開，整個面板可捲動。增補檔 B-3 曾把分類
 * 區改成可收合（為了 iPhone SE 放得下鍵盤），使用者驗收後裁決改回原型。
 *
 * 狀態是一份 EntryDraft，所有轉換都走 entryDraft 的純函式——面板本身只負責
 * 把它畫出來並把事件轉回去（專案分層規則 R1）。
 */
export function EntrySheet({
  categories, defaultDate, txn, onSave, onDelete, onClose, onAddMain, onAddSub,
}: Props) {
  const editing = txn !== undefined;
  const reduced = useReducedMotion();
  // 誰記的跟著這台裝置的使用者（使用者要求，不再手動切換）；名稱與饅頭顏色照配置頁
  const self = useLedger((s) => s.self);
  const members = useLedger((s) => s.members);

  const [draft, setDraft] = useState<EntryDraft>(() =>
    txn ? draftFromTxn(categories, txn) : draftForNew(categories, defaultDate, self)
  );
  const [dateOpen, setDateOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * MOTION #2：面板下滑離場 260ms 之後才真的卸載。
   * reduced-motion 直接收掉——那個模式下使用者要的是立刻到位，不是慢動作。
   */
  const requestClose = useCallback(() => {
    if (reduced) { onClose(); return; }
    setClosing((c) => {
      // 已經在關了就不要再排一次 timer，否則點兩下會關兩次
      if (c) return c;
      timer.current = setTimeout(onClose, DUR.sheetOut);
      return true;
    });
  }, [reduced, onClose]);

  // 卸載時清掉 timer，避免對已經不存在的元件呼叫 onClose
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const dismiss = useSheetDismiss(requestClose);
  // Android 返回鍵、iPhone 右滑先關面板（播下滑動畫），不直接離開 App
  useBackToClose(requestClose);
  // MOTION #38：小月曆展開與收起都要有動畫，收起時先留著播完才卸載
  const datePanel = usePresence(dateOpen, DUR.popIn, reduced);

  const main = categories.find((c) => c.id === draft.mainId);
  const sub = main?.subs.find((s) => s.id === draft.subId);
  const saveable = canSave(draft);
  // 收入沒有稅：稅費卡與含稅合計那行都不出現
  const showTax = draft.kind === 'expense';

  const key = useCallback((k: KeypadKey) => {
    const c = keyChar(k);
    setDraft((d) => (d.field === 'tax'
      ? { ...d, tax: pushDigit(d.tax, c) }
      : { ...d, amount: pushDigit(d.amount, c) }));
  }, []);

  const focus = (field: AmountField) => setDraft((d) => ({ ...d, field }));

  function save() {
    if (!saveable) return;
    onSave(toInput(draft));
    requestClose();
  }

  return (
    <div
      className={[
        styles.scrim,
        reduced ? '' : closing ? styles.scrimOut : styles.scrimIn,
      ].filter(Boolean).join(' ')}
      style={{
        ['--in' as string]: `${DUR.sheetIn}ms`,
        ['--out' as string]: `${DUR.sheetOut}ms`,
        ['--scrim-in' as string]: `${DUR.scrimSheetIn}ms`,
        ['--scrim-out' as string]: `${DUR.scrimSheetOut}ms`,
      }}
      data-closing={closing ? '' : undefined}
      onClick={requestClose}
      data-testid="entry-scrim"
    >
      <div
        // 拖曳中要關掉進場動畫（MOTION #35），否則位移會跟動畫互相打架
        className={[
          styles.sheet,
          reduced || dismiss.dragging ? '' : closing ? styles.sheetOut : styles.sheetIn,
        ].filter(Boolean).join(' ')}
        style={dismiss.style}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? '編輯這筆' : '記一筆'}
        data-testid="entry-sheet"
      >
        {/* MOTION #35：把手下滑關閉 */}
        <div
          className={styles.handle}
          style={{ touchAction: dismiss.touchAction }}
          data-testid="entry-handle"
          {...dismiss.handlers}
        >
          <span className={styles.bar} aria-hidden="true" />
        </div>

        <div className={styles.header}>
          <KindSegment
            kind={draft.kind}
            onChange={(k) => setDraft((d) => setKind(d, categories, k))}
          />
          <div className={styles.headerBtns}>
            {/* §5：編輯模式左邊多一顆垃圾桶鍵 */}
            {editing && (
              <button
                type="button" className={`${styles.iconBtn} ${styles.trash}`}
                onClick={() => setConfirming(true)}
                aria-label="刪除這筆" data-testid="entry-delete"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2h5.8l.6-8.2"
                    fill="none" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              </button>
            )}
            <button
              type="button" className={styles.iconBtn} onClick={requestClose}
              aria-label="關閉" data-testid="entry-close"
            >
              {/* 用 SVG 而不是 ✕ 字元：字元的粗細跟著字型走，每台機器長得不一樣 */}
              <svg width="19" height="19" viewBox="0 0 19 19" aria-hidden="true">
                <path
                  d="M5.5 5.5l8 8M13.5 5.5l-8 8"
                  fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <p className={styles.mode} data-testid="entry-mode">{editing ? '編輯這筆' : '記一筆'}</p>

        <div className={styles.amountRow}>
          <button
            type="button"
            className={styles.amount}
            data-focused={draft.field === 'amount' ? '' : undefined}
            onClick={() => focus('amount')}
            data-testid="field-amount"
          >
            <span className={styles.dollar} aria-hidden="true">$</span>
            <span className={styles.digits} data-empty={isBlank(draft.amount) ? '' : undefined}>
              {draft.amount || '0'}
            </span>
          </button>

          {/* 稅費：跟金額同一排、共用同一組鍵盤。收入沒有稅，整格不出現 */}
          {showTax && (
            <button
              type="button"
              className={styles.tax}
              data-focused={draft.field === 'tax' ? '' : undefined}
              onClick={() => focus('tax')}
              data-testid="field-tax"
            >
              <span className={styles.taxLabel}>稅費</span>
              <span className={styles.dollarSm} aria-hidden="true">$</span>
              <span className={styles.taxDigits} data-empty={isBlank(draft.tax) ? '' : undefined}>
                {draft.tax || '0'}
              </span>
            </button>
          )}
        </div>

        {/* 加拿大的標價不含稅，所以金額欄要的是稅前；填了稅、金額也有值才把實付總額算給使用者看 */}
        {showTax && (
          <p className={styles.hint} data-testid="amount-hint">
            {showsTotal(draft) ? `含稅合計 ${formatCad(totalCents(draft), 'none')}` : '金額請填稅前'}
          </p>
        )}

        <CategoryPicker
          categories={categories}
          kind={draft.kind}
          mainId={draft.mainId}
          subId={draft.subId}
          onPickMain={(id) => setDraft((d) => setMain(d, categories, id))}
          onPickSub={(id) => setDraft((d) => ({ ...d, subId: id }))}
          onAddMain={onAddMain}
          onAddSub={(name) => onAddSub(draft.mainId, name)}
        />

        <div className={styles.cards}>
          <button
            type="button"
            className={`${styles.card} ${styles.dateCard}`}
            data-open={dateOpen ? '' : undefined}
            aria-expanded={dateOpen}
            onClick={() => setDateOpen((o) => !o)}
            data-testid="date-row"
          >
            <span className={styles.cardLabel}>日期</span>
            <span className={styles.dateLine}>
              <span className={styles.dateValue}>{draft.date}</span>
              {/* MOTION #38：▾ 轉 180°，不是換成 ▴ */}
              <span
                className={styles.chevron}
                style={{
                  transform: dateOpen ? 'rotate(180deg)' : 'none',
                  transition: reduced ? 'none' : `transform ${DUR.chevron}ms ${EASE.exit}`,
                }}
                data-testid="date-row-chevron"
                aria-hidden="true"
              >▾</span>
            </span>
          </button>

          {/* 只顯示、不切換：新的一筆記成這台裝置的使用者，編輯時保留原本記帳的人 */}
          <div className={styles.card} data-testid="who-card">
            <span className={styles.cardLabel}>誰記的</span>
            <span className={styles.who} data-testid="who">
              <Mantou variant="full" width={26} minimal color={members[draft.by].color} />
              <span className={styles.whoName}>{members[draft.by].name}</span>
            </span>
          </div>
        </div>

        {datePanel.mounted && (
          <div
            className={[
              styles.calendar,
              reduced ? '' : datePanel.exiting ? styles.calendarExit : styles.calendarEnter,
            ].filter(Boolean).join(' ')}
            style={{ ['--pop' as string]: `${DUR.popIn}ms` }}
            data-exiting={datePanel.exiting ? '' : undefined}
            data-testid="date-row-panel"
          >
            <div className={styles.calendarInner}>
              <MiniCalendar
                value={draft.date}
                onChange={(date) => setDraft((d) => ({ ...d, date }))}
                onClose={() => setDateOpen(false)}
              />
            </div>
          </div>
        )}

        <label className={styles.noteCard}>
          <span className={styles.cardLabel}>備註（可不填）</span>
          <input
            className={styles.note}
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder="例：Costco 週採買"
            aria-label="備註"
            data-testid="entry-note"
          />
        </label>

        {/* 鍵盤底座：面板裝不下時貼在面板底部，上面的內容從後面捲過去（見 .dock） */}
        <div className={styles.dock} data-testid="entry-dock">
          <Keypad onKey={key} onSave={save} canSave={saveable} />
        </div>
      </div>

      {confirming && txn && (
        <ConfirmDialog
          title="刪除這筆紀錄？"
          subject={
            <>
              <span>{main?.name ?? txn.mainName} · {sub?.name ?? txn.subName}</span>
              {/* actualCadCents(draft) 已隨這次改動移除；currency 一律 CAD，含稅合計即實扣金額 */}
              <span>{formatCad(totalCents(draft), 'minus')}</span>
            </>
          }
          description="刪除後無法復原，對方的手機也會同步移除。"
          confirmLabel="刪除"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            onDelete?.(txn.id);
            requestClose();
          }}
          testId="delete-confirm"
        />
      )}
    </div>
  );
}
