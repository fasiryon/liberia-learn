import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("Track 5 admin", async ({ page, context }) => {
  await login(page, "admin", "admin@cha.edu.lr", "DemoSeed2026!");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: /admin console/i })).toBeVisible();
  await expect(page.getByText(/total students|total teachers|lessons delivered/i).first()).toBeVisible();

  await page.goto("/admin/schools");
  const schoolRows = page.locator("a[href^='/admin/schools/']");
  await expect(schoolRows.first()).toBeVisible();

  await page.goto("/admin/audit");
  await expect(page.getByRole("heading", { name: /audit/i })).toBeVisible();
  await expect(page.locator("tbody tr, [data-audit-entry]").first()).toBeVisible();

  await context.clearCookies();
  await page.goto("/login?role=admin");
  await page.getByRole("button", { name: /^admin$/i }).click();
  await page.getByRole("button", { name: /continue/i }).click();
  await expect(page.locator(":invalid")).toHaveCount(3);

  await login(page, "admin", "admin@cha.edu.lr", "DemoSeed2026!");
  // login() uses async signIn + router.push — wait for the redirect to complete
  await page.waitForURL(/\/admin/, { timeout: 15000 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: /admin console/i })).toBeVisible({ timeout: 15000 });
  const navHrefs = await page.locator("a[href^='/admin']").evaluateAll((links) =>
    Array.from(new Set(links.map((link) => (link as HTMLAnchorElement).getAttribute("href")).filter(Boolean))).slice(0, 25)
  );
  expect(navHrefs.length).toBeGreaterThan(0);
  for (const href of navHrefs) {
    const response = await context.request.get(href!);
    expect(response.status(), `${href} returned 404`).not.toBe(404);
  }
});
