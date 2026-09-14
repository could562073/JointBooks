import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';

// 像原生 App 一樣不讓整頁縮放（使用者要求）。Safari 分頁裡會忽略 user-scalable=no，
// 另外擋掉 iOS 的雙指縮放手勢；雙擊放大由 global.css 的 touch-action 處理
document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
