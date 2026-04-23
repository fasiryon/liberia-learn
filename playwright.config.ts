import { defineConfig, devices } from "@playwright/test";

process.env.PLAYWRIGHT_BASE_URL ??= "http://127.0.0.1:3100";

export default defineConfig({
  testDir: "./e2e",
  testMatch: /(full-review-flow|flow-integrity)\.spec\.ts/,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: "list",
  use: {
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/playwright-standalone-server.mjs",
    url: process.env.PLAYWRIGHT_BASE_URL,
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
