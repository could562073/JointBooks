import { useEffect, useState, type CSSProperties } from 'react';
import { DUR } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import styles from './LaunchScreen.module.css';

/**
 * 啟動畫面（使用者要求，照原型 v2 的「啟動畫面」）。每次打開 App 蓋在最上層：
 * 兩顆饅頭依序彈起、後面一圈光暈擴散、字標浮現（原型底部的讀取條依使用者要求拿掉），2.15 秒後放大淡出，
 * 淡出播完（約 2.6 秒）就卸載（MOTION #39）。
 *
 * 只是蓋在上面的一層，底下的 App 照常載入與同步，不會因此多等資料。
 * 減少動態效果時不播彈起與光暈，淡出改成 120ms。
 */
export function LaunchScreen() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<'showing' | 'leaving' | 'gone'>('showing');
  const out = reduced ? DUR.reduced : DUR.bootOut;

  useEffect(() => {
    const leave = setTimeout(() => setPhase('leaving'), DUR.bootHold);
    const gone = setTimeout(() => setPhase('gone'), DUR.bootHold + out);
    return () => { clearTimeout(leave); clearTimeout(gone); };
  }, [out]);

  if (phase === 'gone') return null;

  const vars = {
    '--out': `${out}ms`,
    '--bun': `${DUR.bootBun}ms`,
    '--bun-stagger': `${DUR.bootBunStagger}ms`,
    '--word': `${DUR.bootWord}ms`,
    '--word-delay': `${DUR.bootWordDelay}ms`,
    '--ring': `${DUR.bootRing}ms`,
  } as CSSProperties;

  return (
    <div
      className={[
        styles.screen,
        reduced ? styles.reduced : '',
        phase === 'leaving' ? styles.leaving : '',
      ].filter(Boolean).join(' ')}
      style={vars}
      data-leaving={phase === 'leaving' ? '' : undefined}
      data-reduced={reduced ? '' : undefined}
      data-testid="launch-screen"
      aria-hidden="true"
    >
      <div className={styles.glowA} />
      <div className={styles.glowB} />

      <div className={styles.buns}>
        <div className={styles.ring} />

        <div className={styles.bunMe} data-bun="">
          <span className={`${styles.meFoot} ${styles.meFootL}`} />
          <span className={`${styles.meFoot} ${styles.meFootR}`} />
          <span className={styles.meBody} />
          <span className={styles.meHi} />
          <span className={`${styles.meEye} ${styles.meEyeL}`} />
          <span className={`${styles.meEye} ${styles.meEyeR}`} />
          <span className={`${styles.meBlush} ${styles.meBlushL}`} />
          <span className={`${styles.meBlush} ${styles.meBlushR}`} />
          <span className={styles.meMouth} />
        </div>

        <div className={styles.bunPartner} data-bun="">
          <span className={`${styles.ptFoot} ${styles.ptFootL}`} />
          <span className={`${styles.ptFoot} ${styles.ptFootR}`} />
          <span className={styles.ptBody} />
          <span className={styles.ptHi} />
          <span className={`${styles.ptEye} ${styles.ptEyeL}`} />
          <span className={`${styles.ptEye} ${styles.ptEyeR}`} />
          <span className={`${styles.ptBlush} ${styles.ptBlushL}`} />
          <span className={`${styles.ptBlush} ${styles.ptBlushR}`} />
          <span className={styles.ptMouth} />
        </div>
      </div>

      <div className={styles.word}>
        <div className={styles.title}>饅頭記帳</div>
        <div className={styles.sub}>our little money book</div>
      </div>
    </div>
  );
}
