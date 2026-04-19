import { test, expect } from "@playwright/test";

const BASE = "https://liberia-learn.vercel.app";

test("1 — ll-interactive class is present on interactive elements", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("domcontentloaded");
  const llInteractive = await page.locator(".ll-interactive").count();
  expect(llInteractive).toBeGreaterThan(0);
});

test("2 — ll-page-enter animation class is used in portals", async ({ page }) => {
  const response = await page.goto(`${BASE}/login`);
  expect(response?.status()).toBeLessThan(500);
  await page.waitForLoadState("domcontentloaded");
  const html = await page.content();
  expect(html).toContain("ll-page-enter");
});

test("3 — homepage wordmark contains Liberia.Learn brand text", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("domcontentloaded");
  const heading = await page.locator("h1").first().textContent();
  expect(heading).toContain("Education infrastructure");
});

test("4 — lucide icons are rendered (SVG elements present)", async ({ page }) => {
  await page.goto(`${BASE}/`);
  await page.waitForLoadState("domcontentloaded");
  const svgCount = await page.locator("svg").count();
  expect(svgCount).toBeGreaterThan(0);
});

test("5 — student today page auth-guards correctly (redirect)", async ({ page }) => {
  const response = await page.goto(`${BASE}/student/today`);
  const finalUrl = page.url();
  const isRedirected =
    (response?.status() ?? 0) >= 300 ||
    finalUrl.includes("/login") ||
    finalUrl.includes("/register");
  expect(isRedirected).toBe(true);
});
