import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { formatCad, pushDigit } from '../../domain/money';
import type { Category, Currency, Person, Txn } from '../../domain/types';
import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import type { NewTxnInput } from '../../repo/ledgerRepo';
import { keyChar, type KeypadKey } from './amountInput';
import { CategoryPicker } from './CategoryPicker';
import {
  actualCadCents, canSave, draftForNew, draftFromTxn, needsCadField,
  setCurrency, setKind, setMain, toInput, type AmountField, type EntryDraft,
} from './entryDraft';
import { Keypad } from './Keypad';
import { KindSegment } from './KindSegment';
import { MiniCalendar } from './MiniCalendar';
import { useSheetDismiss } from './useSheetDismiss';
import styles from './EntrySheet.module.css';

const CURRENCIES: Currency[] = ['CAD', 'TWD', 'USD'];
const PEOPLE: Person[] = ['我', '妻'];

/** 「誰記的」兩顆小圓臉的底色，與明細列的頭像同一組 */
const FACE: Record<Person, string> = { 我: 'var(--c-primary)', 妻: 'var(--c-partner)' };

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

  const [draft, setDraft] = useState<EntryDraft>(() =>
    txn ? draftFromTxn(categories, txn) : draftForNew(categories, defaultDate)
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

  const main = categories.find((c) => c.id === draft.mainId);
  const sub = main?.subs.find((s) => s.id === draft.subId);
  const showCad = needsCadField(draft);
  const saveable = canSave(draft);

  const key = useCallback((k: KeypadKey) => {
    const c = keyChar(k);
    setDraft((d) => (d.field === 'cad'
      ? { ...d, cad: pushDigit(d.cad, c) }
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

          <div className={styles.currencies} data-testid="currencies">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                className={styles.currency}
                data-selected={draft.currency === c ? '' : undefined}
                aria-pressed={draft.currency === c}
                onClick={() => setDraft((d) => setCurrency(d, c))}
                data-testid={`currency-${c}`}
              >{c}</button>
            ))}
          </div>
        </div>

        <p className={styles.hint} data-testid="currency-hint">
          {showCad
            ? '非 CAD：請填銀行實際扣款的 CAD 金額（不用匯率換算）'
            : '主幣別 CAD · 直接記錄'}
        </p>

        {/* §5：非 CAD 時才出現實扣 CAD 欄位 */}
        {showCad && (
          <button
            type="button"
            className={styles.cad}
            data-focused={draft.field === 'cad' ? '' : undefined}
            onClick={() => focus('cad')}
            data-testid="field-cad"
          >
            <span className={styles.cardLabel}>實際扣款 CAD</span>
            <span className={styles.cadLine}>
              <span className={styles.dollarSm} aria-hidden="true">$</span>
              <span className={styles.cadDigits} data-empty={isBlank(draft.cad) ? '' : undefined}>
                {draft.cad || '0'}
              </span>
            </span>
          </button>
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

          <div className={styles.card}>
            <span className={styles.cardLabel}>誰記的</span>
            <span className={styles.people} data-testid="people">
              {PEOPLE.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={styles.face}
                  style={{ background: FACE[p] }}
                  data-selected={draft.by === p ? '' : undefined}
                  aria-pressed={draft.by === p}
                  aria-label={p}
                  onClick={() => setDraft((d) => ({ ...d, by: p }))}
                  data-testid={`by-${p}`}
                >
                  <span className={styles.eye} style={{ left: 6 }} />
                  <span className={styles.eye} style={{ right: 6 }} />
                </button>
              ))}
            </span>
          </div>
        </div>

        {dateOpen && (
          <div
            className={reduced ? styles.calendar : `${styles.calendar} ${styles.calendarIn}`}
            style={{ ['--pop' as string]: `${DUR.popIn}ms` }}
            data-testid="date-row-panel"
          >
            <MiniCalendar
              value={draft.date}
              onChange={(date) => setDraft((d) => ({ ...d, date }))}
              onClose={() => setDateOpen(false)}
            />
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

        <Keypad onKey={key} onSave={save} canSave={saveable} />
      </div>

      {confirming && txn && (
        <ConfirmDialog
          title="刪除這筆紀錄？"
          subject={
            <>
              <span>{main?.name ?? txn.mainName} · {sub?.name ?? txn.subName}</span>
              <span>{formatCad(actualCadCents(draft), 'minus')}</span>
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
