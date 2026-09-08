import { defineConfig, devices } from '@playwright/test';

// build.spec.ts 只跑正式建置產物（npm run build && npm run preview，port
// 4173），其餘三個 breakpoint project 都跑 dev server（npm run dev，port
// 5173）。兩顆 webServer 各自獨立啟動、各自的 project 只打各自的 baseURL，
// 不會互相碰撞。見 build.spec.ts 開頭註解說明為什麼需要這第二顆。
export default defineConfig({
  testDir: './e2e',
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
