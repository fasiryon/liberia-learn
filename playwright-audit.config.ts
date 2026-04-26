import { defineConfig, devices } from "@playwright/test";

process.env.PLAYWRIGHT_BASE_URL ??= "https://liberia-learn.vercel.app";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  testMatch: /final-audit\.spec\.ts/,
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
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
