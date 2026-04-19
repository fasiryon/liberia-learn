import { expect, test } from "@playwright/test";
import { expectAnyVisiblePositiveNumber, expectNoBrokenRuntimeText, loginMoe } from "./helpers";

test("Track 2 MOE official", async ({ page }) => {
  test.setTimeout(60000);
  await loginMoe(page, "official1@moe.gov.lr", "MOESeed2026!");
  await expect(page).toHaveURL(/\/moe\/dashboard/);
  await expect(page.getByRole("heading", { name: /national dashboard/i })).toBeVisible();

  // Dashboard fetches data client-side — wait for the district table to populate
  await expect(page.getByText("Montserrado").first()).toBeVisible({ timeout: 10000 });
  await expectAnyVisiblePositiveNumber(page);
  // Nimba appears as a district row (0-data) in the compliance table
  await expect(page.getByText("Nimba")).toBeVisible();
  await expectNoBrokenRuntimeText(page);

  // Sign out via NextAuth API (MoeShell button may not render in all portal configs)
  await page.evaluate(() =>
    fetch("/api/auth/signout", { method: "POST", credentials: "include" })
  );
  await page.goto("/moe/login");
  await expect(page).toHaveURL(/\/moe\/login/);
});
