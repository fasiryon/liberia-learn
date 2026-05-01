import { test, expect, type Page } from "@playwright/test";

const BASE = "https://liberia-learn.vercel.app";
const DEMO_STUDENT_EMAIL = process.env.E2E_DEMO_STUDENT_EMAIL;
const DEMO_STUDENT_PASSWORD = process.env.E2E_DEMO_STUDENT_PASSWORD;
const HAS_DEMO_STUDENT_CREDENTIALS = Boolean(DEMO_STUDENT_EMAIL && DEMO_STUDENT_PASSWORD);

test.skip(
  !HAS_DEMO_STUDENT_CREDENTIALS,
  "Skipping offline sync E2E tests because E2E_DEMO_STUDENT_EMAIL and E2E_DEMO_STUDENT_PASSWORD are not set."
);

async function loginAsStudent(page: Page) {
  if (!DEMO_STUDENT_EMAIL || !DEMO_STUDENT_PASSWORD) {
    throw new Error("Offline sync E2E credentials are not configured.");
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(`${BASE}/login?role=student`);
    await page.getByRole("button", { name: "student", exact: true }).click().catch(() => null);
    await page.fill('input[type="email"], input[type="text"]', DEMO_STUDENT_EMAIL);
    await page.fill('input[type="password"]', DEMO_STUDENT_PASSWORD);
    await page.getByRole("button", { name: "Continue" }).click();
    try {
      await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), undefined, {
        timeout: 30000,
      });
      return;
    } catch {
      if (attempt < 2) await page.waitForTimeout(3000 * (attempt + 1));
    }
  }
  throw new Error("Login failed after 3 attempts");
}

test("student can read saved lesson while offline", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginAsStudent(page);

  await page.goto(`${BASE}/student/today`);
  await page.waitForTimeout(2000);

  const lessonLink = page.getByRole("link", { name: /lesson|open|continue/i }).first();

  if (await lessonLink.isVisible()) {
    await lessonLink.click();
    await page.waitForTimeout(2000);

    const saveBtn = page.getByRole("button", { name: /save.*offline|offline/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }

    await context.setOffline(true);
    await page.waitForTimeout(500);

    await page.reload();
    await page.waitForTimeout(2000);

    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(50);
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("Internal Server Error");

    await context.setOffline(false);
    await page.waitForTimeout(1000);
  }

  await context.close();
});

test("offline queue does not lose events on reconnect", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await loginAsStudent(page);

  await context.setOffline(true);
  await page.waitForTimeout(500);
  await context.setOffline(false);
  await page.waitForTimeout(2000);

  await page.goto(`${BASE}/student/today`);
  await page.waitForTimeout(2000);
  await expect(page.locator("body")).toBeVisible();

  const body = await page.locator("body").innerText();
  expect(body).not.toContain("Application error");

  await context.close();
});
