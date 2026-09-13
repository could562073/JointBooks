import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ShellHeader } from './components/ShellHeader';
import { TabBar, tabDirection } from './components/TabBar';
import type { Txn } from './domain/types';
import { InvitePanel } from './invite/InvitePanel';
import { buildInviteUrl, checkInvite } from './invite/inviteLink';
import { JoinPage } from './invite/JoinPage';
import { joinStateOf, type JoinState } from './invite/joinFlow';
import { LoginPage } from './invite/LoginPage';
import { routeOf } from './invite/route';
import { DUR } from './lib/motion';
import { useRowRemoval } from './lib/useRowRemoval';
import { ledgerRepo } from './repo/ledgerRepo';
import { DailyScreen } from './screens/daily/DailyScreen';
import { createMain, createSub } from './screens/entry/entryCategories';
import { EntrySheet } from './screens/entry/EntrySheet';
import { SettingsScreen } from './screens/settings/SettingsScreen';
import { StatsScreen } from './screens/stats/StatsScreen';
import { selectedDate as selectedDateOf, useLedger } from './store/useLedger';
import { connectErrorText, createCloud, ensureLedger, type Cloud } from './sync/cloud';
import { isConfigured, readConfig } from './sync/config';
import { createSyncController, type SyncController } from './sync/controller';
import { joinLedger, joinOutcomeText } from './sync/joinLedger';
import { joinedSid, setJoinedSid } from './sync/ledgerId';
import styles from './App.module.css';

// 只在 dev 模式下才會走到這裡；production 建置時 import.meta.env.DEV 會被
// 靜態替換成 false，這整個分支連同 lazy import 都不會被送到使用者手上。
// DebugGallery 用 dynamic import，就算沒被消掉也只會落在獨立的 chunk，
// 不會混進一直被下載的正式進入點 chunk 裡。
const DebugGallery = lazy(() => import('./debug/DebugGallery'));

/** 邀請面板上「已經分享給誰」，重開面板時照樣顯示 */
const SHARED_WITH_KEY = 'invite.sharedWith';

/**
 * 雲端（Google 登入＋試算表）只在設定了用戶端 ID 時存在；沒設定就是純本機模式。
 * 整頁只建一次：access token 只放在它的記憶體裡，重建就等於登出。
 */
let cloudOnce: Cloud | null | undefined;
function getCloud(): Cloud | null {
  if (cloudOnce === undefined) {
    const config = readConfig(import.meta.env as unknown as Record<string, string | undefined>);
    cloudOnce = isConfigured(config) ? createCloud(config.clientId!) : null;
  }
  return cloudOnce;
}

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

  const cloud = getCloud();
  const route = routeOf(location.pathname, location.search);
  if (route.kind === 'join') return <Join search={route.search} cloud={cloud} />;

  return <Gate cloud={cloud} />;
}

/**
 * 未設定 client id：直接進主程式（純本機模式）。
 * 設定了：這台裝置已經有帳本就進主程式（同步狀態會提示點一下連線）；
 * 還沒有就先給登入頁，登入後建立帳本。
 */
function Gate({ cloud }: { cloud: Cloud | null }) {
  // undefined＝還在讀；null＝這台裝置還沒有帳本
  const [sid, setSid] = useState<string | null | undefined>(cloud ? undefined : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    void joinedSid().then((v) => { if (alive) setSid(v); });
    // 先把 Google 的 script 載好：之後按登入時才能在同一個點擊事件裡叫出視窗
    cloud.tokens.preload().catch(() => {});
    return () => { alive = false; };
  }, [cloud]);

  if (!cloud) return <Shell cloud={null} />;
  if (sid === undefined) return null;
  if (sid) return <Shell cloud={cloud} />;

  return (
    <LoginPage
      busy={busy}
      error={error}
      onSignIn={() => {
        setError(null);
        setBusy(true);
        // connect 必須在這個點擊事件裡同步呼叫，瀏覽器才不會擋掉 Google 視窗
        cloud.tokens.connect()
          .then(() => ensureLedger(cloud.client, {
            joinedSid,
            setJoinedSid,
            categories: async () => { await ledgerRepo.bootstrap(); return ledgerRepo.listCategories(); },
            year: new Date().getFullYear(),
          }))
          .then((id) => setSid(id))
          .catch((e) => setError(connectErrorText(e)))
          .finally(() => setBusy(false));
      }}
      onJoinLink={(link) => {
        try {
          const u = new URL(link);
          location.assign(`/join${u.search}`);
        } catch {
          setError('這不是有效的邀請連結，請整條複製後再貼一次。');
        }
      }}
    />
  );
}

/**
 * §8.1 接受邀請頁。連結檢查與本機帳本 id 都是 async，所以先給 null 再補上。
 *
 * 加入＝連線 Google → 確認這個帳號讀得到那本帳 → 搬對方的分類 → 記下帳本。
 * 讀不到（對方還沒分享）就停在這頁說明原因，不記下一本打不開的帳。
 */
function Join({ search, cloud }: { search: string; cloud: Cloud | null }) {
  const [state, setState] = useState<JoinState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void Promise.all([checkInvite(search), joinedSid()]).then(([check, sid]) => {
      if (alive) setState(joinStateOf({ check, joinedSid: sid }));
    });
    cloud?.tokens.preload().catch(() => {});
    return () => { alive = false; };
  }, [search, cloud]);

  if (!state) return null;

  const goHome = () => { location.href = '/'; };

  return (
    <JoinPage
      state={state}
      busy={busy}
      error={error}
      onJoin={() => {
        if (state.kind !== 'invite') { goHome(); return; }
        const sid = state.sid;

        // 純本機模式（沒設定 Google）：只記下帳本 id
        if (!cloud) { void setJoinedSid(sid).then(goHome); return; }

        setError(null);
        setBusy(true);
        // 已連線就不再叫視窗；沒連線時 connect 要在這個點擊事件裡同步呼叫
        const ready = cloud.tokens.isConnected() ? Promise.resolve() : cloud.tokens.connect();
        ready
          .then(() => joinLedger(cloud.client, sid, {
            replaceCategories: (cs) => ledgerRepo.replaceCategories(cs),
            setJoinedSid,
          }))
          .then((r) => {
            const msg = joinOutcomeText(r);
            if (msg) setError(msg);
            else goHome();
          })
          .catch((e) => setError(connectErrorText(e)))
          .finally(() => setBusy(false));
      }}
      onBrowse={() => setState({ kind: 'browsing' })}
      onHome={goHome}
    />
  );
}

function Shell({ cloud }: { cloud: Cloud | null }) {
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
  const [invite, setInvite] = useState<{ url: string | null; sharedWith: string | null } | null>(null);
  const syncRef = useRef<SyncController | null>(null);

  // 本機改了帳：請同步控制器稍等一下（合併連續幾筆）再推上去
  const pushSoon = useCallback(() => { syncRef.current?.requestPush(); }, []);

  // MOTION #37：刪除後那一列先收合再消失
  const removeTxn = useCallback((id: string) => { void deleteTxn(id).then(pushSoon); }, [deleteTxn, pushSoon]);
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

  // 雲端同步：每 5 秒輪詢、上線或回到前景就補一輪、記帳後推送
  useEffect(() => {
    if (!cloud) return;
    let sidNow: string | null = null;
    let stop = () => {};
    let alive = true;

    const ctl = createSyncController({
      client: cloud.client,
      tokens: cloud.tokens,
      spreadsheetId: () => sidNow,
      localTxns: () => ledgerRepo.allTxnsForSync(),
      saveTxns: (ts) => ledgerRepo.saveSyncedTxns(ts),
      onPulled: () => useLedger.getState().load(),
      onState: (s) => useLedger.getState().setSyncState(s),
      onSynced: (at) => useLedger.getState().markSynced(at),
    });
    syncRef.current = ctl;

    void joinedSid().then((v) => {
      if (!alive) return;
      sidNow = v;
      stop = ctl.start();
    });
    // 使用者點「連線 Google」成功後立刻補同步，不必等下一次輪詢
    const unsubscribe = cloud.tokens.subscribe((connected) => { if (connected) void ctl.syncNow(); });

    return () => {
      alive = false;
      stop();
      unsubscribe();
      syncRef.current = null;
    };
  }, [cloud]);

  // 點同步狀態：連著就立刻同步；token 過期就在這個點擊裡叫出 Google 視窗
  const retrySync = useCallback(() => {
    if (!cloud) return;
    if (cloud.tokens.isConnected()) { void syncRef.current?.syncNow(); return; }
    cloud.tokens.connect().catch(() => useLedger.getState().setSyncState('needs-auth'));
  }, [cloud]);

  // 邀請面板：把帳本分享給她的 Google 帳號（Drive 權限：可編輯）
  const shareWithHer = useCallback((email: string): Promise<void> => {
    if (!cloud) return Promise.reject(new Error('no_cloud'));
    const ready = cloud.tokens.isConnected() ? Promise.resolve() : cloud.tokens.connect();
    return ready
      .then(() => joinedSid())
      .then((sid) => {
        if (!sid) throw new Error('no_ledger');
        return cloud.client.shareWith(sid, email);
      })
      .then(() => ledgerRepo.setMeta(SHARED_WITH_KEY, email));
  }, [cloud]);

  return (
    <div className={styles.shell} data-testid="app-root">
      <ShellHeader syncState={syncState} lastSyncAt={lastSyncAt} onRetrySync={retrySync} />

      {/* key 帶著 tab：換頁就重掛，CSS 進場動畫才會重播（MOTION #8） */}
      <div
        key={tab}
        className={`${styles.page} ${dir > 0 ? styles.fromRight : styles.fromLeft}`}
        style={{ ['--slide' as string]: `${DUR.slide}ms` }}
        data-testid={`page-${tab}`}
      >
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
              void Promise.all([joinedSid(), ledgerRepo.getMeta<string>(SHARED_WITH_KEY)])
                .then(async ([sid, shared]) => {
                  setInvite({
                    url: sid ? await buildInviteUrl(location.origin, sid) : null,
                    sharedWith: shared ?? null,
                  });
                });
            }}
            syncState={syncState}
            lastSyncAt={lastSyncAt}
            onRetrySync={retrySync}
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
          sharedWith={invite.sharedWith}
          {...(cloud ? { onShareEmail: shareWithHer } : {})}
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
            if (entry === 'new') void addTxn(input).then(pushSoon);
            else void updateTxn(entry.id, input).then(pushSoon);
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
