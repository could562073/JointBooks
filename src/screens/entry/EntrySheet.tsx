import { useCallback, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { Icon } from '../../components/Icon';
import { colorSetOf } from '../../domain/palette';
import { formatCad } from '../../domain/money';
import type { Category, Currency, Person, Txn } from '../../domain/types';
import { DUR } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import type { NewTxnInput } from '../../repo/ledgerRepo';
import { dayTitle } from '../daily/labels';
import { parseDate } from '../../domain/date';
import { pressKey, type KeypadKey } from './amountInput';
import { CategoryPicker } from './CategoryPicker';
import {
  actualCadCents, canSave, draftForNew, draftFromTxn, needsCadField,
  setCurrency, setKind, setMain, toInput, type AmountField, type EntryDraft,
} from './entryDraft';
import { FieldRow } from './FieldRow';
import { Keypad } from './Keypad';
import { KindSegment } from './KindSegment';
import { MiniCalendar } from './MiniCalendar';
import { useSheetDismiss } from './useSheetDismiss';
import styles from './EntrySheet.module.css';

const CURRENCIES: Currency[] = ['CAD', 'TWD', 'USD'];
const PEOPLE: Person[] = ['我', '妻'];

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
  const [openRow, setOpenRow] = useState<'date' | 'category' | null>(null);
  const [confirming, setConfirming] = useState(false);

  const dismiss = useSheetDismiss(onClose);

  const main = categories.find((c) => c.id === draft.mainId);
  const sub = main?.subs.find((s) => s.id === draft.subId);
  const showCad = needsCadField(draft);
  const saveable = canSave(draft);

  const key = useCallback((k: KeypadKey) => {
    setDraft((d) => (d.field === 'cad'
      ? { ...d, cad: pressKey(d.cad, k) }
      : { ...d, amount: pressKey(d.amount, k) }));
  }, []);

  const focus = (field: AmountField) => setDraft((d) => ({ ...d, field }));

  const dateLabel = useMemo(() => {
    const d = parseDate(draft.date);
    return dayTitle(d.getFullYear(), d.getMonth(), d.getDate());
  }, [draft.date]);

  function save() {
    if (!saveable) return;
    onSave(toInput(draft));
    onClose();
  }

  return (
    <div
      className={reduced ? styles.scrim : `${styles.scrim} ${styles.scrimIn}`}
      style={{ ['--in' as string]: `${DUR.sheetIn}ms`, ['--scrim' as string]: `${DUR.scrimSheetIn}ms` }}
      onClick={onClose}
      data-testid="entry-scrim"
    >
      <div
        // 拖曳中要關掉進場動畫（MOTION #35），否則位移會跟動畫互相打架
        className={reduced || dismiss.dragging ? styles.sheet : `${styles.sheet} ${styles.sheetIn}`}
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
              type="button" className={styles.iconBtn} onClick={onClose}
              aria-label="關閉" data-testid="entry-close"
            >✕</button>
          </div>
        </div>

        <p className={styles.mode} data-testid="entry-mode">{editing ? '編輯這筆' : '記一筆'}</p>

        <div className={styles.body}>
          <div className={styles.amounts}>
            <button
              type="button"
              className={styles.amountField}
              data-focused={draft.field === 'amount' ? '' : undefined}
              onClick={() => focus('amount')}
              data-testid="field-amount"
            >
              <span className={styles.fieldLabel}>金額</span>
              <span className={styles.fieldValue}>{draft.amount || '0'}</span>
            </button>

            {/* §5：非 CAD 時才出現實扣 CAD 欄位 */}
            {showCad && (
              <button
                type="button"
                className={styles.amountField}
                data-focused={draft.field === 'cad' ? '' : undefined}
                onClick={() => focus('cad')}
                data-testid="field-cad"
              >
                <span className={styles.fieldLabel}>實際扣款 CAD</span>
                <span className={styles.fieldValue}>{draft.cad || '0'}</span>
              </button>
            )}
          </div>

          <div className={styles.currencies} data-testid="currencies">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                className={styles.pill}
                data-selected={draft.currency === c ? '' : undefined}
                aria-pressed={draft.currency === c}
                onClick={() => setDraft((d) => setCurrency(d, c))}
                data-testid={`currency-${c}`}
              >{c}</button>
            ))}
          </div>

          <p className={styles.hint} data-testid="currency-hint">
            {showCad
              ? '非 CAD：請填銀行實際扣款的 CAD 金額（不用匯率換算）'
              : '主幣別 CAD · 直接記錄'}
          </p>

          <FieldRow
            label="日期"
            value={dateLabel}
            open={openRow === 'date'}
            onToggle={() => setOpenRow((r) => (r === 'date' ? null : 'date'))}
            testId="date-row"
          >
            <MiniCalendar
              value={draft.date}
              onChange={(date) => setDraft((d) => ({ ...d, date }))}
              onClose={() => setOpenRow(null)}
            />
          </FieldRow>

          {/* 增補檔 B-3：分類區可收合，預設收起 */}
          <FieldRow
            label="分類"
            value={
              <>
                {main && (
                  <Icon
                    name={main.icon} size={14} box={20} boxRadius={6}
                    tint={colorSetOf(main.colorSet).tint}
                  />
                )}
                {main?.name ?? '未選'} · {sub?.name ?? '未選'}
              </>
            }
            open={openRow === 'category'}
            onToggle={() => setOpenRow((r) => (r === 'category' ? null : 'category'))}
            testId="category-row"
          >
            <CategoryPicker
              categories={categories}
              kind={draft.kind}
              mainId={draft.mainId}
              subId={draft.subId}
              onPickMain={(id) => setDraft((d) => setMain(d, categories, id))}
              onPickSub={(id) => {
                setDraft((d) => ({ ...d, subId: id }));
                // B-3：選完子分類即自動收合
                setOpenRow(null);
              }}
              onAddMain={onAddMain}
              onAddSub={(name) => onAddSub(draft.mainId, name)}
            />
          </FieldRow>

          <div className={styles.people} data-testid="people">
            {PEOPLE.map((p) => (
              <button
                key={p}
                type="button"
                className={styles.pill}
                data-selected={draft.by === p ? '' : undefined}
                aria-pressed={draft.by === p}
                onClick={() => setDraft((d) => ({ ...d, by: p }))}
                data-testid={`by-${p}`}
              >{p}</button>
            ))}
          </div>

          <input
            className={styles.note}
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder="例：Costco 週採買"
            aria-label="備註"
            data-testid="entry-note"
          />
        </div>

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
            onClose();
          }}
          testId="delete-confirm"
        />
      )}
    </div>
  );
}
