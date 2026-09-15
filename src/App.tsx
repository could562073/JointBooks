import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { ShellHeader } from './components/ShellHeader';
import { TabBar } from './components/TabBar';
import { Toast } from './components/Toast';
import { useTabDirection } from './components/useTabDirection';
import { appPath, appRoot, BASE_URL } from './lib/basePath';
import type { Txn } from './domain/types';
import { InvitePanel } from './invite/InvitePanel';
import { buildInviteUrl, checkInvite, isPreview, previewHref } from './invite/inviteLink';
import { JoinPage } from './invite/JoinPage';
import { joinStateOf, type JoinState } from './invite/joinFlow';
import { LoginPage } from './invite/LoginPage';
import { routeOf } from './invite/route';
import { arrivedByHistory, replaceLocation } from './lib/navigation';
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
import { joinedSid, setJoinedSid, setSelfPerson } from './sync/ledgerId';
import { membersSync, resetLocalMembers } from './sync/members';
import { categoriesSync, migrateCategorySync } from './sync/categoriesSync';
import { findInvitee, removeInvitees } from './sync/invitee';
import { DEFAULT_MEMBERS } from './domain/members';
import { otherPerson } from './domain/people';
import { createArrivalWatcher, partnerToastText } from './sync/partnerArrivals';
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
    cloudOnce = isConfigured(config) ? createCloud(config.clientId!, config.ledgerEnv) : null;
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
  const route = routeOf(location.pathname, location.search, BASE_URL);
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
            replaceCategories: (cs) => ledgerRepo.replaceCategories(cs),
            year: new Date().getFullYear(),
            env: cloud.env,
          }))
          .then((id) => setSid(id))
          .catch((e) => setError(connectErrorText(e)))
          .finally(() => setBusy(false));
      }}
      onJoinLink={(link) => {
        try {
          const u = new URL(link);
          location.assign(`${appPath('join')}${u.search}`);
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
      if (!alive) return;
      // 已經在帳本裡的手機按上一頁（iPhone 右滑）回到舊的邀請頁：直接回主程式（使用者回報右滑跳回邀請頁）
      if (sid && arrivedByHistory()) { replaceLocation(appPath()); return; }
      setState(joinStateOf({ check, joinedSid: sid, preview: isPreview(search) }));
    });
    cloud?.tokens.preload().catch(() => {});
    return () => { alive = false; };
  }, [search, cloud]);

  useEffect(() => {
    // 從返回快取還原的頁面不會重跑上面那段，右滑回來時在這裡再判斷一次
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) void joinedSid().then((sid) => { if (sid) replaceLocation(appPath()); });
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  if (!state) return null;

  // 用 replace 不用 href：接受邀請頁不留在歷史紀錄裡，iPhone 右滑（上一頁）才不會跳回邀請頁
  const goHome = () => { location.replace(appPath()); };

  return (
    <JoinPage
      state={state}
      busy={busy}
      error={error}
      onJoin={() => {
        // 預覽只是給邀請的人看畫面，按下去就回主程式，不加入任何東西
        if (state.kind !== 'invite' || state.preview) { goHome(); return; }
        const sid = state.sid;
        // 這台原本記的是另一本帳：加入成功才清掉那本的紀錄，免得被推進對方的帳本
        const switching = state.switching === true;
        const forgetOldLedger = async () => {
          if (!switching) return;
          await ledgerRepo.clearTxns();
          await resetLocalMembers();
        };

        // 純本機模式（沒設定 Google）：只記下帳本 id
        // 用邀請連結加入的人：這台裝置之後記帳都記成「妻」
        if (!cloud) {
          void forgetOldLedger()
            .then(() => Promise.all([setJoinedSid(sid), setSelfPerson('妻')]))
            .then(goHome);
          return;
        }

        setError(null);
        setBusy(true);
        // 已連線就不再叫視窗；沒連線時 connect 要在這個點擊事件裡同步呼叫
        const ready = cloud.tokens.isConnected() ? Promise.resolve() : cloud.tokens.connect();
        ready
          .then(() => joinLedger(cloud.client, sid, cloud.env, {
            replaceCategories: (cs) => ledgerRepo.replaceCategories(cs),
            setJoinedSid: async (id) => { await forgetOldLedger(); await setJoinedSid(id); },
          }))
          .then((r) => {
            const msg = joinOutcomeText(r);
            if (msg) setError(msg);
            else void setSelfPerson('妻').then(goHome);
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
  const members = useLedger((s) => s.members);
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
  // 帳本分享給了誰（受邀者）。先用本機記下的，連上 Google 後以雲端的共用設定為準
  const [invitee, setInvitee] = useState<string | null>(null);
  // 「對方記帳時通知我」：App 開著時對方剛記的帳跳出來（key 讓連續兩次通知各自重新計時）
  const [partnerToast, setPartnerToast] = useState<{ key: number; text: string } | null>(null);
  const clearPartnerToast = useCallback(() => setPartnerToast(null), []);
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
    // 記一筆面板就地新增的分類也要推上雲端
    pushSoon();
    return r.id;
  }, [categories, entry, saveCategory, pushSoon]);

  const addSubTo = useCallback(async (mainId: string, name: string) => {
    const r = createSub(categories, mainId, name);
    if (!r) return '';
    await saveCategory(r.category);
    // 記一筆面板就地新增的分類也要推上雲端
    pushSoon();
    return r.id;
  }, [categories, saveCategory, pushSoon]);

  // MOTION #8 的進場方向：只在換頁那次決定，之後的重繪沿用（見 useTabDirection）
  const dir = useTabDirection(tab);

  useEffect(() => {
    void load();
  }, [load]);

  // App 開著跨過午夜：回到前景時、以及每分鐘檢查一次換日沒（store 的 refreshToday）
  useEffect(() => {
    const check = () => useLedger.getState().refreshToday();
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const tick = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // 雲端同步：每 5 秒輪詢、上線或回到前景就補一輪、記帳後推送
  useEffect(() => {
    if (!cloud) return;
    let sidNow: string | null = null;
    let stop = () => {};
    let alive = true;
    let arrivals = createArrivalWatcher([]);

    const ctl = createSyncController({
      client: cloud.client,
      tokens: cloud.tokens,
      spreadsheetId: () => sidNow,
      localTxns: () => ledgerRepo.allTxnsForSync(),
      saveTxns: (ts) => ledgerRepo.saveSyncedTxns(ts),
      onPulled: async () => {
        await useLedger.getState().load();
        const s = useLedger.getState();
        const fresh = arrivals.next(s.txns, s.self);
        if (fresh.length > 0 && s.notifyOnPartnerEntry) {
          const partner = s.members[otherPerson(s.self)].name;
          setPartnerToast({ key: Date.now(), text: partnerToastText(fresh, partner, s.categories) });
        }
      },
      onState: (s) => useLedger.getState().setSyncState(s),
      onSynced: (at) => useLedger.getState().markSynced(at),
      // 成員名稱與饅頭顏色：配置頁改了就推，對方改了就拉
      members: membersSync,
      // 分類與月預算：任一邊改了就推，對方改了就拉
      categories: categoriesSync,
    });
    syncRef.current = ctl;

    void joinedSid().then(async (v) => {
      if (!alive) return;
      sidNow = v;
      // 升到逐一合併分類的版本時跑一次：受邀者之前改的分類第一次合併時以本機為準（見 migrateCategorySync）
      await migrateCategorySync();
      // 打開 App 時本機已經有的紀錄不算對方新記的
      arrivals = createArrivalWatcher((await ledgerRepo.allTxnsForSync()).map((t) => t.id));
      if (!alive) return;
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
      .then(() => ledgerRepo.setMeta(SHARED_WITH_KEY, email))
      .then(() => setInvitee(email));
  }, [cloud]);

  // 移除受邀者：拿掉試算表的共用權限，那個位置的名稱與饅頭顏色回到預設，之後可以邀請別人
  const removeInvitee = useCallback(async (): Promise<void> => {
    if (!cloud) throw new Error('no_cloud');
    // connect 要在使用者按下「確定移除」的同一個事件裡叫，Google 視窗才不會被擋
    if (!cloud.tokens.isConnected()) await cloud.tokens.connect();
    const sid = await joinedSid();
    if (!sid) throw new Error('no_ledger');
    await removeInvitees(cloud.client, sid);
    await ledgerRepo.setMeta(SHARED_WITH_KEY, null);
    setInvitee(null);
    await useLedger.getState().setMember('妻', DEFAULT_MEMBERS.妻);
    pushSoon();
  }, [cloud, pushSoon]);

  // 受邀者：本機記的先顯示；連上 Google 後問雲端這本帳共用給了誰，換手機也對得上
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      const local = await ledgerRepo.getMeta<string | null>(SHARED_WITH_KEY);
      if (alive) setInvitee(local ?? null);
      if (!cloud || !cloud.tokens.isConnected()) return;
      const sid = await joinedSid();
      if (!sid) return;
      try {
        const remote = await findInvitee(cloud.client, sid);
        if (!alive) return;
        setInvitee(remote);
        await ledgerRepo.setMeta(SHARED_WITH_KEY, remote);
      } catch {
        // 讀不到共用設定（離線、權限不夠）就維持本機記的
      }
    };
    void refresh();
    const unsubscribe = cloud ? cloud.tokens.subscribe((connected) => { if (connected) void refresh(); }) : () => {};
    return () => { alive = false; unsubscribe(); };
  }, [cloud]);

  return (
    <div className={styles.shell} data-testid="app-root">
      <ShellHeader syncState={syncState} lastSyncAt={lastSyncAt} onRetrySync={retrySync} members={members} />

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
                    url: sid ? await buildInviteUrl(appRoot(location.origin), sid) : null,
                    sharedWith: shared ?? null,
                  });
                });
            }}
            syncState={syncState}
            lastSyncAt={lastSyncAt}
            onRetrySync={retrySync}
            onMembersChanged={pushSoon}
            onCategoriesChanged={pushSoon}
            invitee={invitee}
            {...(cloud ? { onRemoveInvitee: removeInvitee } : {})}
          />
        )}
      </div>

      <TabBar tab={tab} onChange={setTab} />

      {partnerToast && (
        <Toast key={partnerToast.key} message={partnerToast.text} onDone={clearPartnerToast} />
      )}

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
            // 帶 preview=1：這台裝置本來就在帳本裡，不帶的話接受邀請頁會顯示「你已在這本帳裡」
            // 用 replace：預覽頁不留在歷史紀錄裡，右滑不會滑回預覽
            if (invite.url) location.replace(previewHref(invite.url));
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
