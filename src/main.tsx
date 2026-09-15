import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles/global.css';

// 像原生 App 一樣不讓整頁縮放（使用者要求）。Safari 分頁裡會忽略 user-scalable=no，
// 另外擋掉 iOS 的雙指縮放手勢；雙擊放大由 global.css 的 touch-action 處理
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

/*
 * 手機上的 App 要自己換成新版（使用者回報：修好也部署了，手機跑的還是舊版）。
 * iPhone 的主畫面 App 多半是從背景叫回來、不會重新載入，service worker 也就很久才檢查一次更新。
 * 每次回到前景都問一次有沒有新版，新版裝好就重新整理；正在記帳（面板開著或正在打字）時先不打斷，
 * 等下一次回到前景再換。
 */
let reloadPending = false;
const busy = () => document.querySelector('[role="dialog"]') !== null
  || document.activeElement instanceof HTMLInputElement
  || document.activeElement instanceof HTMLTextAreaElement;
registerSW({
  immediate: true,
  onNeedReload() {
    if (busy()) reloadPending = true;
    else location.reload();
  },
  onRegisteredSW(_url, registration) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (reloadPending) {
        if (!busy()) location.reload();
        return;
      }
      registration?.update().catch(() => {});
    });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
