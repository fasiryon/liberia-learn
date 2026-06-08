import { defineConfig, devices } from "@playwright/test";

process.env.PLAYWRIGHT_BASE_URL ??= "http://127.0.0.1:3100";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
const useRemoteBaseUrl = /^https?:\/\/(?!127\.0\.0\.1(?::\d+)?\/?$)(?!localhost(?::\d+)?\/?$)/i.test(baseUrl);

export default defineConfig({
  testDir: "./e2e",
  testMatch: /(full-review-flow|flow-integrity|phase5-3-intelligence-actions|offline-sync|day1-simulation|vsl-recording|messaging|wave3-verification)\.spec\.ts/,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: "list",
  use: {
    baseURL: 'https://liberia-learn.vercel.app',
    video: {
      mode: 'on',
      size: { width: 1280, height: 800 },
    },
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      args: [
        '--window-size=1280,800',
        '--window-position=0,0',
        '--disable-infobars',
        '--no-sandbox',
        '--force-device-scale-factor=1',
        '--kiosk',
        '--start-fullscreen',
        '--start-maximized',
      ],
    },
  },
  webServer: useRemoteBaseUrl
    ? undefined
    : {
        command: "node scripts/playwright-standalone-server.mjs",
        url: baseUrl,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          PORT: "3100",
          HOSTNAME: "127.0.0.1",
          NEXTAUTH_URL: "http://127.0.0.1:3100",
          UPSTASH_REDIS_REST_URL: "",
          UPSTASH_REDIS_REST_TOKEN: "",
        },
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
