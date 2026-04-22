import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://liberia-learn.vercel.app";

async function gotoWithRetry(page: Page, url: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      return;
    } catch (error) {
      if (attempt === 0 && error instanceof Error && error.message.includes("ERR_NETWORK_CHANGED")) {
        continue;
      }
      throw error;
    }
  }
}

async function login(page: Page, email: string, password: string, role: "student") {
  await gotoWithRetry(page, `${BASE}/login?role=${role}`);
  await page.getByRole("button", { name: role, exact: true }).click();
  await page.fill('input[type="email"], input[type="text"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20000 });
}

test("student Today CTAs route to the structured daily flow", async ({ page }) => {
  await login(page, "student1@cha.edu.lr", "DemoSeed2026!", "student");
  await expect(page.getByRole("heading", { name: /Ready to learn/i })).toBeVisible();

  await page.getByRole("link", { name: /Open today's lesson/i }).click();
  await page.waitForURL(/\/student\/today/, { timeout: 15000 });
  await expect(page).not.toHaveURL(/\/student\/lessons$/);
  await expect(page.getByRole("heading", { name: "Today's Lessons" })).toBeVisible();
  await expect(page.getByText("Today's subjects")).toBeVisible();
  await expect(page.getByText("Current lesson")).toBeVisible();
  await expect(page.getByText("Full day plan")).toBeVisible();

  await page.getByRole("link", { name: "Continue lesson" }).first().click();
  await page.waitForURL(/\/student\/lessons\//, { timeout: 15000 });
  if (await page.getByText("Something went wrong").isVisible().catch(() => false)) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }
  await expect(page.locator("h1").first()).toBeVisible();
});

test("student progress and certificate pages return to dashboard", async ({ page }) => {
  await login(page, "student1@cha.edu.lr", "DemoSeed2026!", "student");

  await page.getByRole("link", { name: /View my progress/i }).click();
  await page.waitForURL(/\/student\/progress/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "My Progress" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Back to Dashboard/i })).toBeVisible();

  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("link", { name: /My certificates/i }).click();
  await page.waitForURL(/\/student\/certificates/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: "My Certificates" })).toBeVisible();
  await page.getByRole("link", { name: /Back to Dashboard/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await expect(page.getByRole("heading", { name: /Ready to learn/i })).toBeVisible();
});

test("homepage communicates capabilities without the old metric block", async ({ page }) => {
  await gotoWithRetry(page, BASE);
  await expect(page.getByRole("heading", { name: /Education infrastructure/i })).toBeVisible();

  for (const capability of [
    "Curriculum delivery",
    "AI tutoring",
    "Offline-first access",
    "National oversight",
    "Teacher tools",
    "Student outcomes",
  ]) {
    await expect(page.getByRole("heading", { name: capability })).toBeVisible();
  }

  await expect(page.getByText("counties supported")).toHaveCount(0);
  await expect(page.getByText("lesson modes")).toHaveCount(0);
  await expect(page.getByText("reviewer roles")).toHaveCount(0);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(500);
  const hasOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasOverflow).toBe(false);
});
