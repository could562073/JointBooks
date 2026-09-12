import { Mantou } from '../../components/Mantou';
import { DUR } from '../../lib/motion';
import { pullStyle, type PullPhase } from './pullRefresh';
import styles from './PullIndicator.module.css';

type Props = { phase: PullPhase; offset: number };

/**
 * §10 #27 下拉重整的指示器。饅頭跟著手指下來，放手後轉一圈。
 * 高度就是位移本身，所以明細會被往下推開，而不是蓋在上面。
 */
export function PullIndicator({ phase, offset }: Props) {
  const s = pullStyle(phase === 'spinning' ? offset || 40 : offset);

  return (
    <div
      className={styles.wrap}
      style={{
        height: s.height,
        opacity: s.opacity,
        // 跟手中不要 transition，否則追不上手指；放手回彈才用 300ms
        transition: phase === 'pulling' ? 'none' : `height ${DUR.pullSettle}ms, opacity ${DUR.pullSettle}ms`,
      }}
      data-testid="pull-indicator"
      data-phase={phase}
      aria-hidden={phase === 'idle'}
    >
      <span
        className={phase === 'spinning' ? styles.spinning : undefined}
        style={{ ['--spin' as string]: `${DUR.pullSpin}ms` }}
      >
        <Mantou variant="full" width={28} />
      </span>
    </div>
  );
}
