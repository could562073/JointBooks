import { useState, type ReactNode } from 'react';
import { DUR, EASE } from '../../lib/motion';
import { useReducedMotion } from '../../lib/useReducedMotion';
import styles from './InlineEdit.module.css';

type Props = {
  /** 未編輯時顯示的內容（分類名是純文字；月預算 pill 帶「／月」副標，需要 ReactNode） */
  display: ReactNode;
  /** 進入編輯時輸入欄的初值 */
  initial: string;
  onCommit(next: string): void;
  label: string;
  testId: string;
  /** 金額 pill 與分類名的外觀不同 */
  variant?: 'text' | 'pill';
  inputMode?: 'text' | 'decimal';
  /** 一掛上去就是編輯狀態（「＋ 子分類」點下去要直接能打字，不是再點一次） */
  startEditing?: boolean;
  /** 取消時通知外層，讓它把「＋ 子分類」收回去 */
  onCancel?(): void;
};

/**
 * §7.2 就地編輯（MOTION #19）：點一下變輸入欄，✓ 存、✕ 取消。
 *
 * 空白一律視為取消而不是存成空字串——分類沒有名字、預算沒有數字都不是
 * 合法狀態，把它當「使用者反悔了」處理比跳錯誤訊息自然。
 */
export function InlineEdit({
  display, initial, onCommit, label, testId, variant = 'text', inputMode = 'text',
  startEditing = false, onCancel,
}: Props) {
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(startEditing ? initial : '');
  const [popping, setPopping] = useState(false);
  const reduced = useReducedMotion();

  function start() {
    setDraft(initial);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setDraft('');
    onCancel?.();
  }

  function commit() {
    const v = draft.trim();
    setEditing(false);
    setDraft('');
    if (!v) { onCancel?.(); return; }
    onCommit(v);
    if (reduced) return;
    // MOTION #19：✓ 之後 scale 1→1.06→1
    setPopping(true);
  }

  if (!editing) {
    return (
      <button
        type="button"
        className={[
          variant === 'pill' ? styles.pill : styles.text,
          !reduced && popping ? styles.pop : '',
        ].filter(Boolean).join(' ')}
        style={{ ['--pop' as string]: `${DUR.morphPop}ms` }}
        onClick={start}
        onAnimationEnd={() => setPopping(false)}
        aria-label={label}
        data-popping={popping ? '' : undefined}
        data-testid={testId}
      >{display}</button>
    );
  }

  return (
    <span className={styles.editing} data-testid={`${testId}-editing`}>
      <input
        className={variant === 'pill' ? styles.inputPill : styles.input}
        style={{ transition: reduced ? 'none' : `width ${DUR.morph}ms ${EASE.exit}` }}
        value={draft}
        autoFocus
        inputMode={inputMode}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') cancel();
        }}
        aria-label={label}
        data-testid={`${testId}-input`}
      />
      <button
        type="button" className={styles.ok} onClick={commit}
        aria-label="確認" data-testid={`${testId}-ok`}
      >✓</button>
      <button
        type="button" className={styles.cancel} onClick={cancel}
        aria-label="取消" data-testid={`${testId}-cancel`}
      >✕</button>
    </span>
  );
}
