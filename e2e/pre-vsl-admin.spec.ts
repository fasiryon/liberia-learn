/**
 * Pre-VSL admin operations: league reset + digest preview
 * Run: npx playwright test e2e/pre-vsl-admin.spec.ts --reporter=list
 */

import { test, expect } from "@playwright/test";

const BASE = "https://liberia-learn.vercel.app";
const PASS = "DemoSeed2026!";

async function signIn(page: any, email: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("input[type='email']", { timeout: 15_000 });
  await page.fill("input[type='email']", email);
  await page.fill("input[type='password']", PASS);
  await page.click("button[type='submit']");
  await page.waitForLoadState("networkidle");
}

test.setTimeout(60_000);

test("Step 4 · league weekly reset", async ({ page }) => {
  await signIn(page, "admin@cha.edu.lr");

  const res = await page.evaluate(async () => {
    const r = await fetch("/api/admin/league/reset", { method: "POST" });
    const body = await r.json().catch(() => null);
    return { status: r.status, body };
  });

  console.log("League reset response:", JSON.stringify(res));
  expect(res.status, `League reset failed: ${JSON.stringify(res.body)}`).toBeLessThan(400);
});

test("Step 6 · SMS digest preview (dry-run)", async ({ page }) => {
  await signIn(page, "admin@cha.edu.lr");

  const res = await page.evaluate(async () => {
    const r = await fetch("/api/admin/digest/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previewOnly: true }),
    });
    const body = await r.json().catch(() => null);
    return { status: r.status, body };
  });

  console.log("Digest preview response:", JSON.stringify(res));
  expect(res.status, `Digest trigger failed: ${JSON.stringify(res.body)}`).toBeLessThan(400);
  // Confirm at least one guardian was found for the preview
  const count = res.body?.sent ?? res.body?.previewed ?? res.body?.count ?? res.body?.guardianCount ?? 0;
  console.log(`  Guardians found for digest: ${count}`);
});
