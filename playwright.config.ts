import { defineConfig, devices } from "@playwright/test";

process.env.PLAYWRIGHT_BASE_URL ??= "http://127.0.0.1:3100";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
const useRemoteBaseUrl = /^https?:\/\/(?!127\.0\.0\.1(?::\d+)?\/?$)(?!localhost(?::\d+)?\/?$)/i.test(baseUrl);

export default defineConfig({
  testDir: "./e2e",
  testMatch: /(full-review-flow|flow-integrity|phase5-3-intelligence-actions)\.spec\.ts/,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: "list",
  use: {
    trace: "retain-on-failure",
    baseURL: baseUrl,
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
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
