import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { TabBar, tabDirection } from './components/TabBar';
import { DUR } from './lib/motion';
import { DailyScreen } from './screens/daily/DailyScreen';
import { EntrySheet } from './screens/entry/EntrySheet';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { StatsScreen } from './screens/stats/StatsScreen';
import { createMain, createSub } from './screens/entry/entryCategories';
import { selectedDate as selectedDateOf } from './store/useLedger';
import type { Txn } from './domain/types';
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
  const categories = useLedger((s) => s.categories);
  const selectedDate = useLedger(selectedDateOf);
  const addTxn = useLedger((s) => s.addTxn);
  const updateTxn = useLedger((s) => s.updateTxn);
  const deleteTxn = useLedger((s) => s.deleteTxn);
  const saveCategory = useLedger((s) => s.saveCategory);

  // null = 面板關著；'new' = 新增；Txn = 編輯那一筆
  const [entry, setEntry] = useState<'new' | Txn | null>(null);

  // 就地新增分類：存進 store 之後把 id 交回面板，讓它立即選中（§5）
  const addMain = useCallback(async (name: string) => {
    const kind = entry && entry !== 'new'
      ? categories.find((c) => c.id === entry.mainId)?.kind ?? 'expense'
      : 'expense';
    const r = createMain(categories, kind, name);
    if (!r) return '';
    await saveCategory(r.category);
    return r.id;
  }, [categories, entry, saveCategory]);

  const addSubTo = useCallback(async (mainId: string, name: string) => {
    const r = createSub(categories, mainId, name);
    if (!r) return '';
    await saveCategory(r.category);
    return r.id;
  }, [categories, saveCategory]);

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
          <DailyScreen onEdit={(t) => setEntry(t)} onAdd={() => setEntry('new')} />
        )}
        {ready && tab === 'stats' && <StatsScreen />}
        {ready && tab === 'settings' && (
          <SettingsScreen onInvite={() => {}} />
        )}
      </div>

      <TabBar tab={tab} onChange={setTab} />

      {/*
        面板掛在外殼而不是日常頁裡：它要蓋過分頁列，且編輯入口之後會不只一個。
        key 讓每次開啟都重新初始化 draft——同一個面板連開兩筆不同的紀錄時，
        少了它第二筆會沿用第一筆的 useState 初值。
      */}
      {entry && (
        <EntrySheet
          key={entry === 'new' ? 'new' : entry.id}
          categories={categories}
          defaultDate={selectedDate}
          {...(entry === 'new' ? {} : { txn: entry })}
          onSave={(input) => {
            if (entry === 'new') void addTxn(input);
            else void updateTxn(entry.id, input);
          }}
          onDelete={(id) => void deleteTxn(id)}
          onClose={() => setEntry(null)}
          onAddMain={addMain}
          onAddSub={addSubTo}
        />
      )}
    </div>
  );
}
