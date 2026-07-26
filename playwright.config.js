import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.spec.js',
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    headless: true,
    trace: 'on-first-retry'
  }
});
