import { defineConfig, devices } from '@playwright/test';

// build.spec.ts 只跑正式建置產物（npm run build && npm run preview，port
// 4173），其餘三個 breakpoint project 都跑 dev server（npm run dev，port
// 5173）。兩顆 webServer 各自獨立啟動、各自的 project 只打各自的 baseURL，
// 不會互相碰撞。見 build.spec.ts 開頭註解說明為什麼需要這第二顆。
export default defineConfig({
  testDir: './e2e',
  // Important 6 把 ?debug= 展示櫃改成 lazy import，dev 模式下第一次打開它會
  // 多一趟「等 chunk 抓回來」的路程。單一測試不會感覺到，但這裡預設用高並行
  // workers 打同一顆 dev server（見 vite.config.ts 的 server.warmup 註解），
  // 5000ms 的預設值在滿載時偶爾不夠、會誤判成真的壞掉。量過：暖機後單一
  // 冷啟動約 1.1s，這裡給到 10s 純粹是吃滿載排隊的餘裕，不是在蓋掉真的壞掉。
  expect: { timeout: 10_000 },
  // 預設 workers 是 CPU 核心數的一半（這台 32 核就開 16 個），全部同時打同一顆 WSL 上的 dev server，
  // 第一波頁面等不到模組轉譯、App 十秒內掛不上來，二十幾條一起失敗（2026-09-15 實測）。
  // 限制並行數，換來穩定；CI 的機器只有幾核，再少一點
  workers: process.env.CI ? 2 : 4,
  webServer: [
    {
      // 純本機模式（不帶 Google 用戶端 ID）：開發者的 .env.local 設了 ID 時 App 會停在登入頁，
      // 畫面測試全部跑不到。用自己的 port，不去沿用開發者手上開著的 5173
      command: 'VITE_GOOGLE_CLIENT_ID= npm run dev -- --port 5174 --strictPort',
      url: 'http://localhost:5174',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'VITE_GOOGLE_CLIENT_ID= npm run build && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  use: { baseURL: 'http://localhost:5174' },
  projects: [
    { name: 'se',    testIgnore: 'build.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 } } },
    { name: 'ip13',  testIgnore: 'build.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'ipmax', testIgnore: 'build.spec.ts',
      use: { ...devices['Desktop Chrome'], viewport: { width: 430, height: 932 } } },
    { name: 'build', testMatch: 'build.spec.ts',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4173' } },
  ],
});
