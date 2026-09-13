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

/** 分頁列的內距與頁籤之間的間距（px），與 TabBar.module.css 同一組數字 */
const BAR_PAD = 5;
const TAB_GAP = 6;

/**
 * 選中滑塊的落點。
 *
 * 不能只用 index × 33.33%：列有 5px 內距、頁籤之間有 6px 間距，一格實際寬度是
 * (100% − 2×內距 − 2×間距) / 3。第 i 格的左緣＝內距 + i ×（格寬 + 間距），
 * 展開後百分比部分是 i × 33.33%，px 部分是 內距 − i × (2×內距 + 2×間距)/3 + i × 間距。
 * 少了 px 那一項，滑塊在第二、三格會偏掉幾個 px——跟月曆滑塊同一個坑。
 */
export function tabSliderLeft(index: number): string {
  const n = TABS.length;
  // Number() 去掉尾數零：瀏覽器與 jsdom 設進 style 時都會把 0.0000% 正規化成 0%，
  // 字串先寫成正規化後的樣子，讀回 style.left 才會跟這裡算的一致
  const pct = Number(((index * 100) / n).toFixed(4));
  const px = Number((BAR_PAD + index * (TAB_GAP - (2 * BAR_PAD + (n - 1) * TAB_GAP) / n)).toFixed(5));
  return `calc(${pct}% + ${px}px)`;
}

/** 滑塊寬度＝一格的寬度：扣掉兩側內距與所有間距後平分 */
export const TAB_SLIDER_WIDTH =
  `calc(${Number((100 / TABS.length).toFixed(4))}% - ${Number(((2 * BAR_PAD + (TABS.length - 1) * TAB_GAP) / TABS.length).toFixed(5))}px)`;

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
    // 原型：列浮在一條透明→奶油色的底帶上，捲到底的內容會淡出在列後面
    <div className={styles.dock}>
    <nav className={styles.bar} data-testid="tab-bar">
      <span
        className={styles.slider}
        style={{
          left: tabSliderLeft(index),
          width: TAB_SLIDER_WIDTH,
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
              {/* 原型：沒選中的饅頭是灰的，選中才轉紫；兩者都只有高光與眼睛 */}
              <Mantou variant={active ? 'tab' : 'muted'} width={22} minimal />
            </span>
            <span className={styles.label}>{t.label}</span>
          </button>
        );
      })}
    </nav>
    </div>
  );
}
