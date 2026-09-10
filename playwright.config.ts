import { defineConfig, devices } from "@playwright/test";

const productionProof = process.env.PLAYWRIGHT_PRODUCTION === "1";
const auditOnly = process.env.PLAYWRIGHT_AUDIT === "1";
const pwaProof = process.env.PLAYWRIGHT_PWA === "1";
const canonicalProductionHostname = "liberia-learn.vercel.app";
if (productionProof) {
  const target = new URL(process.env.PLAYWRIGHT_BASE_URL?.trim() || "missing-production-url:");
  if (target.protocol !== "https:" || target.username || target.password ||
      target.hostname !== canonicalProductionHostname || target.port ||
      target.pathname !== "/" || target.search || target.hash) {
    throw new Error(`NR-16 infrastructure: PLAYWRIGHT_BASE_URL must be https://${canonicalProductionHostname}`);
  }
  for (const name of ["E2E_DEMO_STUDENT_EMAIL", "E2E_DEMO_STUDENT_PASSWORD", "PLAYWRIGHT_EXPECTED_SHA"]) {
    if (!process.env[name]?.trim()) throw new Error(`NR-16 infrastructure: missing ${name}`);
  }
  if (!/^[a-f0-9]{40}$/i.test(process.env.PLAYWRIGHT_EXPECTED_SHA!)) {
    throw new Error("NR-16 infrastructure: PLAYWRIGHT_EXPECTED_SHA must be a full commit SHA");
  }
}
process.env.PLAYWRIGHT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL?.trim() || "http://127.0.0.1:3100";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
const useRemoteBaseUrl = /^https?:\/\/(?!127\.0\.0\.1(?::\d+)?\/?$)(?!localhost(?::\d+)?\/?$)/i.test(baseUrl);

export default defineConfig({
  testDir: "./e2e",
  testMatch: productionProof ? /nr16-production-smoke\.spec\.ts/ : auditOnly ? /final-audit\.spec\.ts/ : /(full-review-flow|flow-integrity|phase5-3-intelligence-actions|offline-sync|p5c-pwa-lifecycle|day1-simulation|vsl-recording|messaging|wave3-verification|pre-vsl-admin|pre-vsl-student-walkthrough)\.spec\.ts/,
  forbidOnly: !!process.env.CI,
  retries: 0,
  preserveOutput: productionProof || pwaProof ? "never" : "always",
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: "list",
  use: {
    baseURL: baseUrl,
    video: {
      mode: productionProof || pwaProof ? 'off' : 'on',
      size: { width: 1280, height: 800 },
    },
    viewport: { width: 1280, height: 800 },
    trace: "off",
    screenshot: "off",
    // Production request interception must cover every page network request.
    // Actual worker lifecycle is exercised separately by the local PWA gate.
    serviceWorkers: productionProof ? "block" : "allow",
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
    ...(productionProof || auditOnly ? [] : [{
      name: "mobile-chromium",
      testMatch: /p5c-pwa-lifecycle\.spec\.ts/,
      use: { ...devices["Pixel 5"] },
    }]),
  ],
});
