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
  webServer: [
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run build && npm run preview',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  use: { baseURL: 'http://localhost:5173' },
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
