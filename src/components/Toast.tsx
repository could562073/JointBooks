import { useEffect, useRef, useState } from 'react';
import { DUR, EASE } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import styles from './Toast.module.css';

type Props = {
  message: string;
  onDone(): void;
};

/**
 * MOTION #25：對方新增紀錄時的 toast。
 * translateY -14px→0 + scale .96→1，280ms ease-out；停留 6s 後反向 220ms。
 *
 * 增補檔 E-5：原型那個是釘死常駐的純展示，實作要照 #25 會自己消失。
 */
export function Toast({ message, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    const hold = setTimeout(() => setLeaving(true), DUR.toastHold);
    const gone = setTimeout(onDone, DUR.toastHold + (reduced ? 0 : DUR.toastOut));
    timers.current = [hold, gone];
    return () => { for (const t of timers.current) clearTimeout(t); };
  }, [onDone, reduced]);

  return (
    <div
      className={[
        styles.toast,
        reduced ? '' : leaving ? styles.out : styles.in,
      ].filter(Boolean).join(' ')}
      style={{
        ['--in' as string]: `${DUR.toastIn}ms`,
        ['--out' as string]: `${DUR.toastOut}ms`,
        ['--pulse' as string]: `${DUR.syncPulse}ms`,
        ['--ease-out' as string]: EASE.exit,
      }}
      role="status"
      data-leaving={leaving ? '' : undefined}
      data-testid="toast"
    >
      {/* #25：期間同步圓點 pulse 2.4s 循環 */}
      <span
        className={reduced ? styles.dot : `${styles.dot} ${styles.pulsing}`}
        aria-hidden="true"
        data-testid="toast-dot"
      />
      <span className={styles.text}>{message}</span>
    </div>
  );
}
