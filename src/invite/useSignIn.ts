import { useCallback, useRef, useState } from 'react';
import { resolveAsk, signIn, signInErrorText, type AskChoice, type AskPlan } from '../sync/account';
import type { Cloud } from '../sync/cloud';

export type SignInState = {
  busy: boolean;
  error: string | null;
  /** 要使用者選合併、改用雲端還是取消；null＝沒在問 */
  ask: AskPlan | null;
  /** 開始登入。要在點擊事件裡呼叫：connect 會在裡面同步叫出 Google 視窗 */
  start(): void;
  choose(c: AskChoice): void;
};

/** 開始畫面與配置頁共用的登入流程（設計見 docs/superpowers/specs/2026-09-18-guest-mode-and-account-design.md） */
export function useSignIn(cloud: Cloud | null, onLinked: (sid: string) => void): SignInState {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ask, setAsk] = useState<AskPlan | null>(null);
  // 擋連點：header 那顆藥丸、「邀請成員」在還沒忙完之前都點得到，連點兩下不能跑出兩本帳本
  const busyRef = useRef(false);

  const start = useCallback(() => {
    if (!cloud || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setBusy(true);
    // connect 必須在這個點擊事件裡同步呼叫，瀏覽器才不會擋掉 Google 視窗；
    // busyRef 的檢查要排在它前面，第二次點擊才不會又開一次視窗。
    // 帶 select_account：讓使用者選帳號，同意過的舊帳號才會再走一次同意畫面拿到續期憑證
    cloud.tokens.connect('select_account')
      .then(() => signIn({ client: cloud.client, tokens: cloud.tokens, env: cloud.env }))
      .then((r) => { if (r.kind === 'linked') onLinked(r.sid); else setAsk(r); })
      .catch((e) => {
        setError(signInErrorText(e));
        // 接不上帳本就不要留著半套連線：畫面還是本機模式，連著反而讓人以為登入了
        if (cloud.tokens.isConnected()) void cloud.tokens.disconnect();
      })
      .finally(() => { busyRef.current = false; setBusy(false); });
  }, [cloud, onLinked]);

  const choose = useCallback((c: AskChoice) => {
    if (!cloud || !ask || busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setBusy(true);
    resolveAsk(ask, c, { client: cloud.client, tokens: cloud.tokens, env: cloud.env })
      .then((r) => { setAsk(null); if (r.kind === 'linked') onLinked(r.sid); })
      .catch((e) => setError(signInErrorText(e)))
      .finally(() => { busyRef.current = false; setBusy(false); });
  }, [cloud, ask, onLinked]);

  return { busy, error, ask, start, choose };
}
