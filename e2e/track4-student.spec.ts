import { expect, test } from "@playwright/test";
import { expectAnyVisiblePositiveNumber, expectNoHorizontalOverflow, login } from "./helpers";

test("Track 4 student", async ({ page }) => {
  await login(page, "student", "student1@cha.edu.lr", "DemoSeed2026!");
  await expect(page).toHaveURL(/\/dashboard|\/student/);
  await expect(page.getByRole("heading", { name: /welcome back|student dashboard/i })).toBeVisible();
  await expect(page.getByText(/lesson|activity|today's work/i).first()).toBeVisible();

  await page.goto("/student/today");
  const lessonLink = page.getByRole("link", { name: /lesson|open|continue/i }).first();
  await expect(lessonLink).toBeVisible();
  await lessonLink.click();
  await expect(page.locator("h1").first()).toBeVisible();
  const title = (await page.locator("h1").first().innerText()).trim();
  expect(title).not.toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

  await expect(page.getByRole("button", { name: /help me understand/i }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /test yourself|quiz/i }).first()).toBeVisible();

  await page.goto("/student/progress");
  await expect(page.getByRole("heading", { name: /progress/i })).toBeVisible();
  // Progress data fetches client-side — wait for lesson count before checking numbers
  await expect(page.getByText(/assigned lessons/i)).toBeVisible({ timeout: 10000 });
  await expectAnyVisiblePositiveNumber(page);

  await page.goto("/student/certificates");
  await expect(page.locator("body")).not.toContainText(/error|not found/i);

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/student/dashboard");
  await expectNoHorizontalOverflow(page);
});
