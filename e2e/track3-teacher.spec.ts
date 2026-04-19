import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, login } from "./helpers";

test("Track 3 teacher", async ({ page }) => {
  test.setTimeout(60000);
  await login(page, "teacher", "teacher1@cha.edu.lr", "DemoSeed2026!");
  await expect(page).toHaveURL(/\/teacher/);
  await page.goto("/teacher/dashboard");
  await expect(page.getByRole("heading", { name: /teacher dashboard/i })).toBeVisible();
  await expect(page.getByText(/\d+\s+students/i).first()).toBeVisible();

  await page.getByRole("link", { name: /create with ai/i }).first().click();
  await expect(page.getByRole("heading", { name: /create with ai/i })).toBeVisible();
  const classSelect = page.locator("select").first();
  await expect(classSelect).toBeVisible({ timeout: 15000 });
  const options = await classSelect.locator("option").count();
  expect(options).toBeGreaterThan(1);
  await classSelect.selectOption({ index: 1 });
  // Label has no 'for' attribute — target by placeholder instead
  await page.getByPlaceholder(/students will/i).fill("Students will explain equivalent fractions using local market examples.");
  await expect(page.getByRole("button", { name: /generate lesson/i })).toBeEnabled();

  await page.goto("/teacher/assignments");
  await expect(page.getByRole("heading", { name: /assignment grading/i })).toBeVisible();

  const logout = page.getByRole("button", { name: /log out/i }).first();
  await expect(logout).toBeVisible();
  await logout.click();
  await expect(page).toHaveURL(/\/login/);

  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, "teacher", "teacher1@cha.edu.lr", "DemoSeed2026!");
  await page.goto("/teacher/dashboard");
  await expectNoHorizontalOverflow(page);
});
