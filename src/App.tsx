import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AccountSwitchDialog } from './components/AccountSwitchDialog';
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
import { useSignIn } from './invite/useSignIn';
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
import {
  finishLink, planJoin, recordAccountIfMissing, resolveAsk, signInErrorText, signOut, type AskPlan,
} from './sync/account';
import { enterLocalMode, lastAccount, lastLedger, localFacts, readLink, type Account, type Link } from './sync/accountState';
import { createCloudWithProxy, type Cloud } from './sync/cloud';
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
    // 有設定登入端點就走授權碼流程（登入一次就不用再點），沒有就維持 token model
    cloudOnce = isConfigured(config)
      ? createCloudWithProxy(config.clientId!, config.ledgerEnv, config.authProxyUrl)
      : null;
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
 * 未設定 client id：直接進主程式（純本機模式，開發用）。
 * 設定了：接著帳本就進那一本；選過「先不登入」或登出過就進本機模式；都沒有才給開始畫面。
 * 接上的帳本是這裡的狀態：登入、登出之後 Shell 跟著換，同步控制器依 sid 重新啟動。
 */
export function Gate({ cloud }: { cloud: Cloud | null }) {
  // undefined＝還在讀
  const [link, setLink] = useState<Link | undefined>(cloud ? undefined : { sid: null });
  const [email, setEmail] = useState<string | null>(null);
  // 開始畫面貼錯的邀請連結
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!cloud) return;
    let alive = true;
    void readLink().then(async (l) => {
      const a = typeof l === 'object' && l.sid ? await lastAccount() : null;
      if (!alive) return;
      setEmail(a?.email ?? null);
      setLink(l);
    });
    // 先把 Google 的 script 載好：之後按登入時才能在同一個點擊事件裡叫出視窗
    cloud.tokens.preload().catch(() => {});
    return () => { alive = false; };
  }, [cloud]);

  // 接上帳本之後：本機資料可能換過（合併、改用雲端），重讀一次再進那本帳
  const onLinked = useCallback((sid: string) => {
    void Promise.all([lastAccount(), useLedger.getState().load()]).then(([a]) => {
      setEmail(a?.email ?? null);
      setLink({ sid });
    });
  }, []);
  const signin = useSignIn(cloud, onLinked);

  if (!cloud) return <Shell cloud={null} sid={null} />;
  if (link === undefined) return null;

  const dialog = signin.ask && (
    <AccountSwitchDialog plan={signin.ask} busy={signin.busy} error={signin.error} onChoose={signin.choose} />
  );
  // 確認視窗開著時錯誤寫在視窗裡，外面不重複
  const error = signin.ask ? null : signin.error;

  if (link === 'login') {
    return (
      <>
        <LoginPage
          busy={signin.busy}
          error={error ?? linkError}
          onSignIn={() => { setLinkError(null); signin.start(); }}
          onJoinLink={(raw) => {
            try {
              const u = new URL(raw);
              location.assign(`${appPath('join')}${u.search}`);
            } catch {
              setLinkError('這不是有效的邀請連結，請整條複製後再貼一次。');
            }
          }}
          onUseLocally={() => { void enterLocalMode().then(() => setLink({ sid: null })); }}
        />
        {dialog}
      </>
    );
  }

  return (
    <>
      <Shell
        cloud={cloud}
        sid={link.sid}
        account={{
          email,
          busy: signin.busy,
          error,
          onSignIn: signin.start,
          onSignedOut: () => { setEmail(null); setLink({ sid: null }); },
          onAccountKnown: (a) => setEmail(a.email),
        }}
      />
      {dialog}
    </>
  );
}

/**
 * §8.1 接受邀請頁。連結檢查與本機帳本 id 都是 async，所以先給 null 再補上。
 *
 * 加入＝連線 Google → 確認這個帳號讀得到那本帳 → 搬對方的分類 → 記下帳本。
 * 讀不到（對方還沒分享）就停在這頁說明原因，不記下一本打不開的帳。
 * 手機上有帳、又沒接著別本帳（訪客或登出後）時，先問要合併、清掉還是取消。
 */
function Join({ search, cloud }: { search: string; cloud: Cloud | null }) {
  const [state, setState] = useState<JoinState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<AskPlan | null>(null);

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

  const join = () => {
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
      .then(async () => {
        const account: Account = await cloud.client.aboutUser();
        // 已經接著別本帳的走原本的切換流程（先提醒、加入成功才清掉）；沒接著又有帳就先問
        if (!switching) {
          const plan = planJoin({
            account, lastAccount: await lastAccount(), inviteSid: sid,
            local: await localFacts(), lastLedger: await lastLedger(),
          });
          if (plan.kind === 'ask') { setAsk(plan); return; }
          if (plan.kind === 'rejoin') {
            // 這條邀請連結正是登出前接著的那本：手機上混著兩人的帳，不能合併也不該被清掉，
            // 直接接回去，分類不換，交給同步逐一合併（跟 signIn 的 rejoin 一樣）
            const r = await joinLedger(cloud.client, sid, cloud.env, {
              replaceCategories: async () => {},
              setJoinedSid: async () => {},
            });
            const msg = joinOutcomeText(r);
            if (msg) { setError(msg); return; }
            await finishLink(account, sid, plan.self);
            goHome();
            return;
          }
        }
        const r = await joinLedger(cloud.client, sid, cloud.env, {
          replaceCategories: (cs) => ledgerRepo.replaceCategories(cs),
          setJoinedSid: async (id) => { await forgetOldLedger(); await setJoinedSid(id); },
        });
        const msg = joinOutcomeText(r);
        if (msg) { setError(msg); return; }
        // 記成「妻」，順便記下帳號、離開本機模式
        await finishLink(account, sid, '妻');
        goHome();
      })
      .catch((e) => setError(signInErrorText(e)))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <JoinPage
        state={state}
        busy={busy}
        error={ask ? null : error}
        onJoin={join}
        onBrowse={() => setState({ kind: 'browsing' })}
        onHome={goHome}
      />
      {ask && cloud && (
        <AccountSwitchDialog
          plan={ask}
          busy={busy}
          error={error}
          onChoose={(c) => {
            setError(null);
            setBusy(true);
            resolveAsk(ask, c, { client: cloud.client, tokens: cloud.tokens, env: cloud.env })
              .then((r) => { setAsk(null); if (r.kind === 'linked') goHome(); })
              .catch((e) => setError(signInErrorText(e)))
              .finally(() => setBusy(false));
          }}
        />
      )}
    </>
  );
}

/** Gate 交給 Shell 的帳號操作（有設定 Google 時才有） */
type ShellAccount = {
  email: string | null;
  busy: boolean;
  error: string | null;
  /** 在點擊事件裡呼叫：會同步叫出 Google 視窗 */
  onSignIn(): void;
  /** 登出完成、本機已經是本機模式之後通知外層 */
  onSignedOut(): void;
  /** 這個功能上線前就登入的手機第一次連上 Google 時補記到帳號 */
  onAccountKnown(a: Account): void;
};

function Shell({ cloud, sid, account }: { cloud: Cloud | null; sid: string | null; account?: ShellAccount }) {
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
  // account 每次重繪都是新物件；放進 effect 的依賴會讓同步一直重啟，所以經由 ref 讀
  const accountRef = useRef(account);
  accountRef.current = account;

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
    // 距離過期剩這麼久就開始找機會換新的 token
    const RENEW_BEFORE_MS = 10 * 60_000;
    if (!cloud) return;
    // 本機模式：沒有帳本可以同步，狀態寫「只存在這台手機」，點它就登入
    if (!sid) { useLedger.getState().setSyncState('local'); return; }
    const sidNow = sid;
    let stop = () => {};
    let alive = true;
    let arrivals = createArrivalWatcher([]);

    const ctl = createSyncController({
      client: cloud.client,
      tokens: cloud.tokens,
      spreadsheetId: () => sidNow,
      localTxns: () => ledgerRepo.allTxnsForSync(),
      // 這幾個 callback 都要看 alive：登出、換帳號之後這個 effect 已經清乾淨，
      // 但舊的同步循環可能還飛在半路，回來時不能再把畫面狀態蓋回去（I3）
      saveTxns: (ts) => (alive ? ledgerRepo.saveSyncedTxns(ts) : Promise.resolve()),
      onPulled: async () => {
        if (!alive) return;
        await useLedger.getState().load();
        const s = useLedger.getState();
        const fresh = arrivals.next(s.txns, s.self);
        if (fresh.length > 0 && s.notifyOnPartnerEntry) {
          const partner = s.members[otherPerson(s.self)].name;
          setPartnerToast({ key: Date.now(), text: partnerToastText(fresh, partner, s.categories) });
        }
      },
      onState: (s) => { if (alive) useLedger.getState().setSyncState(s); },
      onSynced: (at) => { if (alive) useLedger.getState().markSynced(at); },
      // 成員名稱與饅頭顏色：配置頁改了就推，對方改了就拉
      members: membersSync,
      // 分類與月預算：任一邊改了就推，對方改了就拉
      categories: categoriesSync,
    });
    syncRef.current = ctl;

    void (async () => {
      // 升到逐一合併分類的版本時跑一次：受邀者之前改的分類第一次合併時以本機為準（見 migrateCategorySync）
      await migrateCategorySync();
      // 打開 App 時本機已經有的紀錄不算對方新記的
      arrivals = createArrivalWatcher((await ledgerRepo.allTxnsForSync()).map((t) => t.id));
      if (!alive) return;
      stop = ctl.start();
    })();
    // 這個功能上線前就登入的手機沒記過帳號：第一次連上時補記，之後換帳號登入才比得出來
    const noteAccount = () => {
      void recordAccountIfMissing(cloud.client).then((a) => { if (a) accountRef.current?.onAccountKnown(a); });
    };
    if (cloud.tokens.isConnected()) noteAccount();
    // 使用者點「連線 Google」成功後立刻補同步，不必等下一次輪詢
    const unsubscribe = cloud.tokens.subscribe((connected) => {
      if (!connected) return;
      void ctl.syncNow();
      noteAccount();
    });

    /*
     * token 約一小時就過期（token model 沒有 refresh token，見 auth/gis.ts 開頭）。
     * 同意紀錄還在 Google 帳號上時多半可以不打擾使用者就換到新的：打開、回到前景、每 5 分鐘各試一次。
     * 成功時 subscribe 會補一輪同步；失敗就安靜維持「點一下連線 Google」。
     */
    const renew = () => {
      const t = cloud.tokens;
      // 快過期就先換，不要等真的過期：過期後才換的話，那一刻沒有使用者的點擊可以搭
      if (t.isConnected() && t.expiresInMs() > RENEW_BEFORE_MS) return;
      void t.renewSilently(true);
    };
    const onVisibleRenew = () => { if (document.visibilityState === 'visible') renew(); };
    renew();
    const renewTimer = setInterval(renew, 5 * 60_000);
    document.addEventListener('visibilitychange', onVisibleRenew);
    /*
     * 搭著使用者的點擊換（使用者回報過一小時還是要點一次）：Safari 只在點過畫面之後的短時間內
     * 允許 Google 的視窗，背景自己換會被擋掉。點哪裡都算，不必特地去點同步狀態；
     * 真的要打 Google 時 provider 自己節流一分鐘
     */
    window.addEventListener('pointerdown', renew, { capture: true, passive: true });

    return () => {
      alive = false;
      stop();
      unsubscribe();
      clearInterval(renewTimer);
      document.removeEventListener('visibilitychange', onVisibleRenew);
      window.removeEventListener('pointerdown', renew, { capture: true });
      syncRef.current = null;
    };
  }, [cloud, sid]);

  // 點同步狀態：本機模式就是登入；連著就立刻同步；token 過期就在這個點擊裡叫出 Google 視窗
  const retrySync = useCallback(() => {
    if (!cloud) return;
    if (!sid) { accountRef.current?.onSignIn(); return; }
    if (cloud.tokens.isConnected()) { void syncRef.current?.syncNow(); return; }
    cloud.tokens.connect().catch(() => useLedger.getState().setSyncState('needs-auth'));
  }, [cloud, sid]);

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

  // 登出：先同步、記下這本帳，回到本機模式；帳留在手機上
  const signOutHere = useCallback(async (): Promise<void> => {
    if (!cloud) return;
    await signOut({ tokens: cloud.tokens, syncNow: () => syncRef.current?.syncNow() ?? Promise.resolve() });
    await useLedger.getState().load();
    accountRef.current?.onSignedOut();
  }, [cloud]);

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
  }, [cloud, sid]);

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
              // 本機模式沒有帳本可以分享：先登入（在這個點擊裡叫出 Google 視窗）
              if (cloud && !sid) { accountRef.current?.onSignIn(); return; }
              void Promise.all([joinedSid(), ledgerRepo.getMeta<string>(SHARED_WITH_KEY)])
                .then(async ([s, shared]) => {
                  setInvite({
                    url: s ? await buildInviteUrl(appRoot(location.origin), s) : null,
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
            {...(cloud && sid ? { onRemoveInvitee: removeInvitee } : {})}
            {...(cloud && account ? {
              account: {
                email: account.email,
                // 登入中看這台手機有沒有接著帳本（sid），不是看記不記得信箱：
                // 舊安裝升級後 lastAccount 還是空的，直到第一次連上 Google 才補記
                linked: sid !== null,
                busy: account.busy,
                error: account.error,
                onSignIn: account.onSignIn,
                onSignOut: signOutHere,
              },
            } : {})}
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
