import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    {
      // Node 的 http server 預設 keepAliveTimeout 是 5 秒。實測這台機器上跑 e2e
      // 時，dev server 的 event loop 每輪都會卡住約 5.5 秒（workers 開 2 時量到
      // 過 16.6 秒），一旦卡頓跨過 5 秒，一條「客戶端已經把下一個請求寫進去」
      // 的閒置 keep-alive socket 會在 loop 恢復時先處理到期的計時器而被銷毀，
      // 客戶端就收到 ECONNRESET。症狀是每次落在不同的 spec 上的隨機失敗。
      //
      // 這不是把逾時調大來遮掩失敗：被銷毀的是一條已經收到請求的連線，屬於
      // 傳輸層競態，不是斷言太嚴。真正該修的卡頓來源是 dev 模式下 567 個字型
      // subset（18 MB）的服務成本，那是 Plan 08 的 subset 任務。
      name: 'jointbooks:keep-alive-longer-than-dev-server-stalls',
      configureServer(server) {
        const http = server.httpServer;
        // Vite 的 HttpServer 是聯集型別，HTTP/2 那支沒有這個屬性，故需縮小。
        if (http && 'keepAliveTimeout' in http) {
          http.keepAliveTimeout = 30_000; // 遠大於觀測到的最長卡頓
        }
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: '加拿大共用記帳',
        short_name: '共用記帳',
        lang: 'zh-Hant',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#FFF6EC',
        background_color: '#FFF6EC',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512',
            type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // §12.1：App shell 與 15 個圖示走 cache-first。
        //
        // woff2 刻意排除在 precache 之外。Task 3 自架的三套字型被 Google Fonts 依
        // unicode-range 切成 567 個 subset、共 18 MB；把它們全部塞進 precache 會讓
        // service worker 在安裝時就要抓 18 MB，在 iOS 上是行不通的。改成 runtime
        // CacheFirst：使用者看過的字自然會被快取起來，之後離線可用。
        // 真正的解法是把 CJK 字型 subset 成 App 實際用到的字（約 200 字、~200 KB），
        // 那是獨立的最佳化任務。
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        runtimeCaching: [
          {
            urlPattern: /\/fonts\/.*\.woff2$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // App.tsx 只在 import.meta.env.DEV 時 lazy-import 這個 debug 展示櫃，
    // 所以它現在是一顆獨立 chunk，dev server 預設不會轉譯它，要等第一次真的
    // 打 ?debug= 才會現轉。平常單一使用者感覺不到；但 e2e 對 3 個 breakpoint
    // project 同時起跑、同時第一次打 ?debug=icons／?debug=mantou 時，會撞上
    // 同一個 dev server process 現轉譯的排隊延遲。開機就先暖機，把這個 race
    // 消掉，同時仍然保留 production 建置時它是獨立 chunk（見 Important 6）。
    warmup: { clientFiles: ['./src/debug/DebugGallery.tsx'] },
  },
  build: {
    assetsInlineLimit: 0, // Don't inline SVG icons; keep them as separate files
  },
});
