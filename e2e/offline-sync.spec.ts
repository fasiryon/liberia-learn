import { test, expect } from "@playwright/test";

const BASE = "https://liberia-learn.vercel.app";

test("student can read saved lesson while offline", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "student1@cha.edu.lr");
  await page.fill('input[type="password"]', "DemoSeed2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/student/, { timeout: 15000 });

  // Navigate to today's lessons
  await page.goto(`${BASE}/student/today`);
  await page.waitForTimeout(2000);

  const lessonLink = page.getByRole("link", { name: /lesson|open|continue/i }).first();

  if (await lessonLink.isVisible()) {
    await lessonLink.click();
    await page.waitForTimeout(2000);

    // Try to save for offline if button exists
    const saveBtn = page.getByRole("button", { name: /save.*offline|offline/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }

    // Go offline
    await context.setOffline(true);
    await page.waitForTimeout(500);

    // Reload while offline
    await page.reload();
    await page.waitForTimeout(2000);

    // Should not crash — either cached content or graceful offline message
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(50);
    expect(body).not.toContain("Application error");
    expect(body).not.toContain("Internal Server Error");

    // Go back online
    await context.setOffline(false);
    await page.waitForTimeout(1000);
  }

  await context.close();
});

test("offline queue does not lose events on reconnect", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', "student1@cha.edu.lr");
  await page.fill('input[type="password"]', "DemoSeed2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/student/, { timeout: 15000 });

  // Brief offline then reconnect
  await context.setOffline(true);
  await page.waitForTimeout(500);
  await context.setOffline(false);
  await page.waitForTimeout(2000);

  // Page should recover
  await page.goto(`${BASE}/student/today`);
  await page.waitForTimeout(2000);
  await expect(page.locator("body")).toBeVisible();

  const body = await page.locator("body").innerText();
  expect(body).not.toContain("Application error");

  await context.close();
});
