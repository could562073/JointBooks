import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // 開發者自己的 .env.local 會填 Google 用戶端 ID；測試一律跑純本機模式，
    // 否則 App 測試會走進登入頁、去載 Google 的 script
    env: { VITE_GOOGLE_CLIENT_ID: '' },
  },
  // Vitest 透過 Vite 的轉換流程解析資源，所以這不是只給正式建置用的死設定。
  // 沒有這行，SVG 會被內嵌成 data URI，Icon.test.tsx 的路徑斷言就會失敗。
  // vite.config.ts 另外有一份相同設定，用於正式建置。
  build: {
    assetsInlineLimit: 0,
  },
});
