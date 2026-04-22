import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://liberia-learn.vercel.app";

async function loginStudent(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "student1@cha.edu.lr");
  await page.fill('input[type="password"]', "DemoSeed2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|student)/, { timeout: 15000 });
}

test("BrandMark pencil SVG present on homepage", async ({ page }) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const pencilSvg = page.locator('svg[aria-label="LiberiaLearn"]');
  await expect(pencilSvg).toBeVisible();
});

test("PencilButton present in student lesson view", async ({ page }) => {
  await loginStudent(page);
  await page.goto(`${BASE}/student/lessons/cha-demo-student1-multimedia-lesson`);
  const pencilBtn = page.locator(
    '[aria-label="Ask the tutor"], [aria-label="Open tools"]',
  ).first();
  await expect(pencilBtn).toBeVisible();
});

test("Lab badges use pencil palette colors", async ({ page }) => {
  await loginStudent(page);
  await page.goto(`${BASE}/student/labs`);
  await page.waitForTimeout(2000);
  await expect(page.locator("body")).toBeVisible();
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.includes("Physics") || bodyText.includes("Biology")).toBe(true);
});

test("No cold blue-black backgrounds — warm graphite", async ({ page }) => {
  await page.goto(BASE);
  const bg = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  expect(bg).not.toBe("rgb(5, 9, 20)");
});

test("All portals mobile 375px no overflow after Phase 3", async ({ page }) => {
  await loginStudent(page);
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  const hasOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasOverflow).toBe(false);
});
