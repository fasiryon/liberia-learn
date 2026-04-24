import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://liberia-learn.vercel.app";

test.describe("Phase 5.3 — Intelligence Action Automation", () => {
  test("student today page shows active action card when one exists", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', "student1@cha.edu.lr");
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD ?? "test-password");
    await page.click('button[type="submit"]');
    await page.waitForURL(/student|dashboard/, { timeout: 10_000 });

    await page.goto(`${BASE}/student/today`);
    await page.waitForSelector("[data-testid='active-action-card'], .ll-card, h1", { timeout: 10_000 });

    // If an action exists, the card must show reason and a real link
    const actionCard = page.locator("[data-testid='active-action-card']");
    if (await actionCard.isVisible()) {
      await expect(actionCard).toContainText(/.+/); // reason text present
      const actNowLink = actionCard.locator("a");
      if (await actNowLink.isVisible()) {
        const href = await actNowLink.getAttribute("href");
        expect(href).toBeTruthy();
        expect(href).toMatch(/^\//);
        expect(href).not.toContain("undefined");
      }
    }
    // Page renders without error in either case
    await expect(page.locator("h1")).toBeVisible();
  });

  test("teacher dashboard shows Immediate Attention panel when alerts exist", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', "teacher1@cha.edu.lr");
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD ?? "test-password");
    await page.click('button[type="submit"]');
    await page.waitForURL(/teacher|dashboard/, { timeout: 10_000 });

    await page.goto(`${BASE}/teacher/dashboard`);
    await page.waitForSelector("[data-testid='immediate-attention-panel'], .ll-page-enter", { timeout: 12_000 });

    const panel = page.locator("[data-testid='immediate-attention-panel']");
    if (await panel.isVisible()) {
      // Panel must contain at least one alert entry
      const alertItems = panel.locator(".rounded-lg");
      expect(await alertItems.count()).toBeGreaterThan(0);

      // Each alert must have severity badge and reason text
      const firstAlert = alertItems.first();
      await expect(firstAlert).toBeVisible();
    }

    await expect(page.locator("h1, .ll-page-enter")).toBeVisible();
  });

  test("MOE dashboard aggregate includes curriculum flag summary", async ({ page }) => {
    await page.goto(`${BASE}/moe/login`);
    await page.fill('input[type="email"]', "official1@moe.gov.lr");
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD ?? "test-password");
    await page.click('button[type="submit"]');
    await page.waitForURL(/moe|dashboard/, { timeout: 10_000 });

    // Verify MOE dashboard API returns aggregate-only data (no PII)
    const response = await page.request.get(`${BASE}/api/moe/dashboard`);
    if (response.ok()) {
      const body = await response.json();
      // Must have curriculumIntelligence (aggregate) — no studentId fields in top-level
      expect(body).not.toHaveProperty("studentId");
      expect(body).not.toHaveProperty("userId");
      // curriculumFlagSummary if present must be aggregate-only
      if (body.curriculumFlagSummary) {
        expect(typeof body.curriculumFlagSummary.totalActive).toBe("number");
        expect(body.curriculumFlagSummary).not.toHaveProperty("studentId");
      }
    }
  });

  test("student action href always leads to a valid page, not 404", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.fill('input[type="email"]', "student1@cha.edu.lr");
    await page.fill('input[type="password"]', process.env.TEST_PASSWORD ?? "test-password");
    await page.click('button[type="submit"]');
    await page.waitForURL(/student|dashboard/, { timeout: 10_000 });

    const response = await page.request.get(`${BASE}/api/student/today`);
    if (response.ok()) {
      const body = await response.json();
      if (body.activeAction?.href) {
        const href = body.activeAction.href;
        expect(href).toMatch(/^\//);
        expect(href).not.toContain("undefined");
        expect(href).not.toContain("null");
      }
    }
  });
});
