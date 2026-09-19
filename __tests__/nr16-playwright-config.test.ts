import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const nextConfig = require("../next.config.js") as {
  headers: () => Promise<Array<{ headers: Array<{ key: string; value: string }> }>>;
};

describe("NR-16 production Playwright authority", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("PLAYWRIGHT_PRODUCTION", "1");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://liberia-learn.vercel.app");
    vi.stubEnv("PLAYWRIGHT_EXPECTED_SHA", "a".repeat(40));
    vi.stubEnv("E2E_DEMO_STUDENT_EMAIL", "approved@example.org");
    vi.stubEnv("E2E_DEMO_STUDENT_PASSWORD", "test-fixture-only");
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each(["", "http://localhost:3100", "https://localhost", "https://production.example.org", "https://liberia-learn.vercel.app/preview", "https://user:password@liberia-learn.vercel.app"])(
    "rejects an absent or unsafe production origin: %s", async (target) => {
      vi.stubEnv("PLAYWRIGHT_BASE_URL", target);
      await expect(import("../playwright.config")).rejects.toThrow(/NR-16 infrastructure/);
    },
  );
  it.each(["E2E_DEMO_STUDENT_EMAIL", "E2E_DEMO_STUDENT_PASSWORD", "PLAYWRIGHT_EXPECTED_SHA"])(
    "fails instead of skipping when %s is absent", async (name) => {
      vi.stubEnv(name, "");
      await expect(import("../playwright.config")).rejects.toThrow(`missing ${name}`);
    },
  );
  it("selects only the safe smoke, disables sensitive artifacts and never starts localhost", async () => {
    const { default: config } = await import("../playwright.config");
    const matcher = config.testMatch as RegExp;
    expect(matcher.test("nr16-production-smoke.spec.ts")).toBe(true);
    for (const file of ["full-review-flow.spec.ts", "p5c-pwa-lifecycle.spec.ts", "final-audit.spec.ts", "messaging.spec.ts"]) {
      expect(matcher.test(file)).toBe(false);
    }
    expect(config.projects?.map((project) => project.name)).toEqual(["chromium"]);
    expect(config.webServer).toBeUndefined();
    expect(config.use?.video).toEqual({ mode: "off", size: { width: 1280, height: 800 } });
    expect(config.use?.trace).toBe("off");
    expect(config.use?.screenshot).toBe("off");
    expect(config.use?.serviceWorkers).toBe("block");
    expect(config.preserveOutput).toBe("never");
    expect(config.retries).toBe(0);
  });

  it("has one Playwright configuration authority", () => {
    const configs = readdirSync(resolve(process.cwd()))
      .filter((name) => /^playwright(?:-[^.]+)?\.config\.(?:ts|js|mjs|cjs)$/.test(name));
    expect(configs).toEqual(["playwright.config.ts"]);
    expect(existsSync(resolve(process.cwd(), "playwright-audit.config.ts"))).toBe(false);
  });

  it("gates every main push with bounded, exact-deployment production Playwright", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/playwright-production.yml"),
      "utf8",
    );
    expect(workflow).toMatch(/push:\s*\n\s+branches: \[main\]/);
    expect(workflow).toContain("timeout-minutes: 20");
    expect(workflow).toContain("cancel-in-progress: true");
    expect(workflow).toContain("PLAYWRIGHT_PRODUCTION: '1'");
    expect(workflow).toContain("PLAYWRIGHT_BASE_URL: ${{ vars.PLAYWRIGHT_BASE_URL }}");
    expect(workflow).toContain("PLAYWRIGHT_EXPECTED_SHA: ${{ github.sha }}");
    const browserStep = workflow.slice(workflow.indexOf("- name: Enforce production browser smoke"));
    expect(browserStep).toContain("E2E_DEMO_STUDENT_EMAIL: ${{ secrets.E2E_DEMO_STUDENT_EMAIL }}");
    expect(browserStep).toContain("E2E_DEMO_STUDENT_PASSWORD: ${{ secrets.E2E_DEMO_STUDENT_PASSWORD }}");
    expect(workflow.slice(0, workflow.indexOf("- name: Enforce production browser smoke")))
      .not.toContain("secrets.E2E_DEMO_STUDENT");
    expect(workflow).toContain("node scripts/wait-for-production.mjs");
    expect(workflow).toContain("run: npx playwright test");
    expect(workflow).not.toContain("continue-on-error");
    expect(workflow).not.toContain("upload-artifact");
  });

  it("emits deployment identity only for a Vercel production build", async () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "b".repeat(40));
    vi.stubEnv("VERCEL_ENV", "preview");
    const preview = (await nextConfig.headers()).flatMap((entry) => entry.headers);
    expect(preview.some((header) => header.key === "X-Deployment-Sha")).toBe(false);
    expect(preview.some((header) => header.key === "X-Deployment-Environment")).toBe(false);

    vi.stubEnv("VERCEL_ENV", "production");
    const production = (await nextConfig.headers()).flatMap((entry) => entry.headers);
    expect(production).toContainEqual({ key: "X-Deployment-Environment", value: "production" });
    expect(production).toContainEqual({ key: "X-Deployment-Sha", value: "b".repeat(40) });
  });
});
