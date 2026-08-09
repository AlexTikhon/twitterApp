import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command: 'npm --prefix ../BE run start:e2e',
      url: 'http://127.0.0.1:8080/health',
      reuseExistingServer: false,
      timeout: 120_000
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      env: { VITE_API_URL: 'http://127.0.0.1:8080' },
      url: 'http://127.0.0.1:3000',
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
