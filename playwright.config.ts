import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: 'http://localhost:5173' },
  projects: [
    { name: 'se',    use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 } } },
    { name: 'ip13',  use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'ipmax', use: { ...devices['Desktop Chrome'], viewport: { width: 430, height: 932 } } },
  ],
});
