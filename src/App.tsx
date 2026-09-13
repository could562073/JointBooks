import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ShellHeader } from './components/ShellHeader';
import { TabBar, tabDirection } from './components/TabBar';
import { DUR } from './lib/motion';
import { useRowRemoval } from './lib/useRowRemoval';
import { DailyScreen } from './screens/daily/DailyScreen';
import { EntrySheet } from './screens/entry/EntrySheet';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { StatsScreen } from './screens/stats/StatsScreen';
import { InvitePanel } from './invite/InvitePanel';
import { JoinPage } from './invite/JoinPage';
import { LoginPage } from './invite/LoginPage';
import { buildInviteUrl, checkInvite } from './invite/inviteLink';
import { joinStateOf, type JoinState } from './invite/joinFlow';
import { routeOf } from './invite/route';
import { isConfigured, readConfig } from './sync/config';
import { joinedSid, setJoinedSid } from './sync/ledgerId';
import { completeSignIn, hasSession, startSignIn } from './auth/session';
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

  const route = routeOf(location.pathname, location.search);
  if (route.kind === 'join') return <Join search={route.search} />;
  if (route.kind === 'callback') return <Callback search={route.search} />;

  return <Gate />;
}

/**
 * 未設定 client id 時直接進主程式（純本機模式）；設定了但還沒登入就先給登入頁。
 */
function Gate() {
  const config = readConfig(
    import.meta.env as unknown as Record<string, string | undefined>,
    location.origin
  );
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isConfigured(config)) { setSignedIn(true); return; }
    let alive = true;
    void hasSession().then((v) => { if (alive) setSignedIn(v); });
    return () => { alive = false; };
  }, [config]);

  if (signedIn === null) return null;
  if (signedIn) return <Shell />;

  return (
    <LoginPage
      onSignIn={() => {
        void startSignIn({ clientId: config.clientId!, redirectUri: config.redirectUri });
      }}
    />
  );
}

/** §14.2 的 redirect 回程。成功或失敗都導回首頁，不留在這個中繼頁 */
function Callback({ search }: { search: string }) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const config = readConfig(
      import.meta.env as unknown as Record<string, string | undefined>,
      location.origin
    );
    if (!isConfigured(config)) { location.replace('/'); return; }

    void completeSignIn({ clientId: config.clientId!, redirectUri: config.redirectUri }, search)
      .then((r) => {
        if (r.kind === 'error') setError(r.error);
        else location.replace('/');
      });
  }, [search]);

  return (
    <div data-testid="auth-callback">
      {error ? `登入失敗：${error}` : '登入中…'}
    </div>
  );
}

/** §8.1 接受邀請頁。連結檢查與本機帳本 id 都是 async，所以先給 null 再補上 */
function Join({ search }: { search: string }) {
  const [state, setState] = useState<JoinState | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([checkInvite(search), joinedSid()]).then(([check, sid]) => {
      if (alive) setState(joinStateOf({ check, joinedSid: sid }));
    });
    return () => { alive = false; };
  }, [search]);

  if (!state) return null;

  return (
    <JoinPage
      state={state}
      // 加入＝把帳本 id 記在這台裝置上。權限本身是 Google 那邊給的，這裡
      // 只是記下「我加入的是哪一本」，下次再點同一條連結才認得出已是成員
      onJoin={() => {
        const go = () => { location.href = '/'; };
        if (state.kind === 'invite' || state.kind === 'already') {
          void setJoinedSid(state.sid).then(go);
        } else go();
      }}
      onBrowse={() => setState({ kind: 'browsing' })}
      onHome={() => { location.href = '/'; }}
    />
  );
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
  const syncState = useLedger((s) => s.syncState);
  const lastSyncAt = useLedger((s) => s.lastSyncAt);

  // null = 面板關著；'new' = 新增；Txn = 編輯那一筆
  const [entry, setEntry] = useState<'new' | Txn | null>(null);
  // null = 面板關著。開著時 url 可能仍是 null——那代表這台裝置還沒有雲端帳本
  const [invite, setInvite] = useState<{ url: string | null } | null>(null);
  // MOTION #37：刪除後那一列先收合再消失
  const removeTxn = useCallback((id: string) => { void deleteTxn(id); }, [deleteTxn]);
  const txnRemoval = useRowRemoval(removeTxn);

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
      <ShellHeader syncState={syncState} lastSyncAt={lastSyncAt} onRetrySync={() => {}} />

      {/* key 帶著 tab：換頁就重掛，CSS 進場動畫才會重播（MOTION #8） */}
      <div
        key={tab}
        className={`${styles.page} ${dir > 0 ? styles.fromRight : styles.fromLeft}`}
        style={{ ['--slide' as string]: `${DUR.slide}ms` }}
        data-testid={`page-${tab}`}
      >
        {/* 統計頁與配置頁是 Plan 06／07，先留位子讓分頁列可以切 */}
        {ready && tab === 'daily' && (
          <DailyScreen
            onEdit={(t) => setEntry(t)}
            onAdd={() => setEntry('new')}
            collapsingTxns={txnRemoval.collapsing}
          />
        )}
        {ready && tab === 'stats' && <StatsScreen />}
        {ready && tab === 'settings' && (
          <SettingsScreen
            onInvite={() => {
              void joinedSid().then(async (sid) => {
                setInvite({ url: sid ? await buildInviteUrl(location.origin, sid) : null });
              });
            }}
            syncState={syncState}
            lastSyncAt={lastSyncAt}
            onRetrySync={() => {}}
          />
        )}
      </div>

      <TabBar tab={tab} onChange={setTab} />

      {/*
        面板掛在外殼而不是日常頁裡：它要蓋過分頁列，且編輯入口之後會不只一個。
        key 讓每次開啟都重新初始化 draft——同一個面板連開兩筆不同的紀錄時，
        少了它第二筆會沿用第一筆的 useState 初值。
      */}
      {invite && (
        <InvitePanel
          url={invite.url}
          onClose={() => setInvite(null)}
          onPreview={() => {
            if (!invite.url) return;
            const u = new global.URL(invite.url);
            location.href = u.pathname + u.search;
          }}
        />
      )}

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
          onDelete={(id) => txnRemoval.remove(id)}
          onClose={() => setEntry(null)}
          onAddMain={addMain}
          onAddSub={addSubTo}
        />
      )}
    </div>
  );
}
