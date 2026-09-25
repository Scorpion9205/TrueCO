import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack: the API (pnpm run docker:up) and this app's
 * production build, which Playwright starts on port 3000 (the origin the API allows) unless E2E_BASE_URL points elsewhere.
 * Run `pnpm build` first, then `pnpm test:e2e`.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  // One institute is created per run and shared; tests that use it run in order
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /auth\.setup\.ts/,
      dependencies: ['setup'],
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm exec next start --port 3000',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
