import { expect, test } from "@playwright/test";
import { expectPageOk } from "./helpers";

test("Track 1 public site", async ({ page }) => {
  await expectPageOk(page, "/");
  await expect(page).toHaveURL(/liberia-learn\.vercel\.app\/?$/);
  await expect(page.locator("body")).not.toContainText(/password|DemoSeed|test@/i);
  await expect(page.getByRole("link", { name: /privacy/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /terms/i })).toBeVisible();

  const pilotResponse = await page.goto("/pilot-preview");
  expect(pilotResponse?.status()).not.toBe(404);
  await expect(page).not.toHaveURL(/\/login$/);

  await page.goto("/");
  await page.getByRole("link", { name: /moe|ministry/i }).first().click();
  await expect(page).toHaveURL(/\/moe\/login/);

  await expectPageOk(page, "/privacy");
  await expectPageOk(page, "/terms");
});
