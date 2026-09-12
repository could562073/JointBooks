import { lazy, Suspense, useEffect, useRef } from 'react';
import { TabBar, tabDirection } from './components/TabBar';
import { DUR } from './lib/motion';
import { DailyScreen } from './screens/daily/DailyScreen';
import { useLedger } from './store/useLedger';
import styles from './App.module.css';

// 只在 dev 模式下才會走到這裡；production 建置時 import.meta.env.DEV 會被
// 靜態替換成 false，這整個分支連同 lazy import 都不會被送到使用者手上。
// DebugGallery 用 dynamic import，就算沒被消掉也只會落在獨立的 chunk，
// 不會混進一直被下載的正式進入點 chunk 裡。
const DebugGallery = lazy(() => import('./debug/DebugGallery'));

export default function App() {
  const debugKey = import.meta.env.DEV
    ? new URLSearchParams(location.search).get('debug')
    : null;

  if (debugKey) {
    return (
      <Suspense fallback={null}>
        <DebugGallery debugKey={debugKey} />
      </Suspense>
    );
  }

  return <Shell />;
}

function Shell() {
  const ready = useLedger((s) => s.ready);
  const tab = useLedger((s) => s.tab);
  const setTab = useLedger((s) => s.setTab);
  const load = useLedger((s) => s.load);

  // MOTION #8 的進場方向。用 ref 記上一個分頁，render 期間不需要它觸發重繪
  const prev = useRef(tab);
  const dir = tabDirection(prev.current, tab);
  prev.current = tab;

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={styles.shell} data-testid="app-root">
      {/* key 帶著 tab：換頁就重掛，CSS 進場動畫才會重播（MOTION #8） */}
      <div
        key={tab}
        className={`${styles.page} ${dir > 0 ? styles.fromRight : styles.fromLeft}`}
        style={{ ['--slide' as string]: `${DUR.slide}ms` }}
        data-testid={`page-${tab}`}
      >
        {/* 統計頁與配置頁是 Plan 06／07，先留位子讓分頁列可以切 */}
        {ready && tab === 'daily' && (
          <DailyScreen onEdit={() => {}} onAdd={() => {}} />
        )}
        {ready && tab !== 'daily' && (
          <div className={styles.stub} data-testid={`stub-${tab}`}>
            這一頁還沒做
          </div>
        )}
      </div>

      <TabBar tab={tab} onChange={setTab} />
    </div>
  );
}
