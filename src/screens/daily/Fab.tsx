import { useState } from 'react';
import { DUR, EASE } from '../../lib/motion';
import styles from './Fab.module.css';

type Props = { onClick(): void };

/**
 * §2／§4 日常頁懸浮 ＋（MOTION #28）。只有這一頁有，且不隨明細捲動。
 *
 * 按壓態放在 state 而不是 :active——:active 在 iOS Safari 上會被捲動取消得
 * 太早，手指還在按著就先彈回來了。pointer 事件自己管，行為才一致。
 */
export function Fab({ onClick }: Props) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      type="button"
      className={styles.fab}
      style={{
        transform: pressed ? 'scale(.92)' : 'none',
        transition: `transform ${pressed ? DUR.fabPress : DUR.fabRelease}ms ${EASE.exit}`,
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={onClick}
      aria-label="記一筆"
      data-testid="fab"
      data-pressed={pressed ? '' : undefined}
    >
      <span className={styles.plus} aria-hidden="true">＋</span>
    </button>
  );
}
