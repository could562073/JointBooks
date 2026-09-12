import { DUR, EASE } from '../lib/motion';
import { useReducedMotion } from '../lib/useReducedMotion';
import type { Tab } from '../store/useLedger';
import { Mantou } from './Mantou';
import styles from './TabBar.module.css';

/** §2：三等寬頁籤。順序就是滑塊的座標，不要另外維護一張索引表 */
export const TABS: { key: Tab; label: string }[] = [
  { key: 'daily', label: '日常' },
  { key: 'stats', label: '統計' },
  { key: 'settings', label: '配置' },
];

/** 選中滑塊的落點。跟月曆滑塊同一套做法：算好百分比，不寫 CSS calc */
export function tabSliderLeft(index: number): string {
  return `${((index * 100) / TABS.length).toFixed(4)}%`;
}

type Props = {
  tab: Tab;
  onChange(t: Tab): void;
};

/**
 * §2 底部分頁列（MOTION #29 毛玻璃）。選中框是一塊可位移的滑塊，
 * 不是各頁籤自己變底色——跟月曆的選中框同一個道理。
 */
export function TabBar({ tab, onChange }: Props) {
  const reduced = useReducedMotion();
  const index = Math.max(0, TABS.findIndex((t) => t.key === tab));

  return (
    <nav className={styles.bar} data-testid="tab-bar">
      <span
        className={styles.slider}
        style={{
          left: tabSliderLeft(index),
          width: `${(100 / TABS.length).toFixed(4)}%`,
          transition: reduced ? 'none' : `left ${DUR.slide}ms ${EASE.move}`,
        }}
        aria-hidden="true"
        data-testid="tab-slider"
      />

      {TABS.map((t) => {
        const active = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            className={styles.tab}
            onClick={() => onChange(t.key)}
            aria-current={active ? 'page' : undefined}
            data-active={active ? '' : undefined}
            data-testid={`tab-${t.key}`}
          >
            {/* §2：頁籤饅頭 22×18，沒有嘴也沒有腳——tab variant 就是這個用途 */}
            <Mantou variant="tab" width={22} />
            <span className={styles.label}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
