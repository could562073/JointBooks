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

/** 分頁在列上的位置；找不到就當第一個，不讓未知的 tab 把版面算歪 */
export function tabIndex(tab: Tab): number {
  return Math.max(0, TABS.findIndex((t) => t.key === tab));
}

/**
 * §10 #8：往後（日常→統計→配置）自右側進，往前自左側進。
 * 跟月份切換同一個方向約定：1 是新內容從右邊來。
 */
export function tabDirection(from: Tab, to: Tab): -1 | 1 {
  return tabIndex(to) < tabIndex(from) ? -1 : 1;
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
  const index = tabIndex(tab);

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
            {/*
              §2：頁籤饅頭 22×18，沒有嘴也沒有腳——tab variant 就是這個用途。
              MOTION #10：選中的那一隻壓扁再彈回。key 帶著 tab，每次換頁都重掛
              一次讓動畫重播；沒選中的不掛動畫類別，免得整排一起跳。
            */}
            <span
              key={active ? `on-${tab}` : 'off'}
              className={active && !reduced ? styles.squash : undefined}
              style={{ ['--squash' as string]: `${DUR.slide}ms` }}
              data-testid={active ? 'tab-mantou-active' : undefined}
            >
              <Mantou variant="tab" width={22} />
            </span>
            <span className={styles.label}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
