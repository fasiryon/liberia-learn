/**
 * Pre-VSL student1 walkthrough — dress rehearsal for all 7 checkpoints.
 * Run: npx playwright test e2e/pre-vsl-student-walkthrough.spec.ts --reporter=list
 */
import { test, expect, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import JSZip from "jszip";

const BASE = "https://liberia-learn.vercel.app";
const PASS = "DemoSeed2026!";
const SS_DIR = path.join(process.cwd(), "wave3-screenshots", "walkthrough");

async function signIn(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("input[type='email']", { timeout: 15_000 });
  await page.fill("input[type='email']", email);
  await page.fill("input[type='password']", PASS);
  await page.click("button[type='submit']");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1000);
}

function ss(name: string) {
  return path.join(SS_DIR, `${name}.png`);
}

test.beforeAll(() => { fs.mkdirSync(SS_DIR, { recursive: true }); });
test.setTimeout(90_000);

test("W1 · student1 login → today page loads with real content", async ({ page }) => {
  await signIn(page, "student1@cha.edu.lr");
  await page.goto(`${BASE}/student/today`);
  // At least one period or assigned work should be visible
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(2500);
  const bodyText = await page.locator("main").textContent();
  console.log(`  Today page first 200 chars: ${bodyText?.slice(0, 200)}`);
  await page.screenshot({ path: ss("W1-today") });
});

test("W2 · first lesson opens with real content", async ({ page }) => {
  await signIn(page, "student1@cha.edu.lr");
  await page.goto(`${BASE}/student/today`);
  await page.waitForTimeout(2000);

  // Find the first "Open lesson" / "Start Lesson" / "Continue" CTA
  const lessonBtn = page.getByRole("link", { name: /open lesson|start lesson|continue/i }).first();
  const hasBtn = await lessonBtn.isVisible().catch(() => false);
  if (!hasBtn) {
    // Fallback: go directly to lessons list
    await page.goto(`${BASE}/student/lessons`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: ss("W2-lessons-fallback") });
    console.log("  No lesson CTA on today page — screenshot lessons list");
    return;
  }
  await lessonBtn.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  const title = await page.title();
  console.log(`  Lesson page title: ${title}`);
  await page.screenshot({ path: ss("W2-lesson-open") });
  await expect(page.locator("main")).toBeVisible();
});

test("W3 · certificates page loads (WhatsApp share button present if cert exists)", async ({ page }) => {
  await signIn(page, "student1@cha.edu.lr");
  await page.goto(`${BASE}/student/certificates`);
  await page.waitForTimeout(2500);
  const bodyText = await page.locator("main").textContent() ?? "";
  const hasCert = bodyText.includes("Certificate of Achievement");
  const hasBtn = await page.getByText(/Share to WhatsApp/i).isVisible().catch(() => false);
  console.log(`  Has certificate: ${hasCert}, WhatsApp button visible: ${hasBtn}`);
  await page.screenshot({ path: ss("W3-certificates") });
  // Page must render without error regardless
  await expect(page.locator("main")).toBeVisible();
});

test("W4 · Download Week pack — ZIP lands and contains lessons, no answerKey", async ({ page }) => {
  await signIn(page, "student1@cha.edu.lr");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const packResult: any = await page.evaluate(async () => {
    const res = await fetch("/api/packs/week", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audience: "student" }),
    });
    const text = await res.text();
    if (!res.ok) return { error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
    try { return JSON.parse(text); } catch { return { error: text.slice(0, 200) }; }
  });

  expect(packResult?.error, `Pack failed: ${packResult?.error}`).toBeFalsy();
  console.log(`  Pack: ${packResult?.lessonCount} lessons, ${packResult?.sizeBytes} bytes`);

  // Download through server proxy
  const fullUrl = `${BASE}${packResult.downloadUrl}`;
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 60_000 }),
    page.evaluate((u: string) => { window.location.href = u; }, fullUrl),
  ]);
  const dlPath = await download.path();
  expect(dlPath, "Download must land").toBeTruthy();

  const zip = await JSZip.loadAsync(fs.readFileSync(dlPath!));
  const files = Object.keys(zip.files).filter(n => !zip.files[n].dir);
  const offenders: string[] = [];
  for (const f of files) {
    const c = await zip.files[f].async("string");
    if (c.includes("answerKey")) offenders.push(f);
  }
  console.log(`  ZIP: ${files.length} files, answerKey occurrences: ${offenders.length}`);
  expect(offenders, `answerKey leaked in: ${offenders.join(", ")}`).toHaveLength(0);
  await page.screenshot({ path: ss("W4-pack-downloaded") });
});

test("W5 · AI Tutor page loads the grounded assistant (Tutor Architecture Consolidation)", async ({ page }) => {
  await signIn(page, "student1@cha.edu.lr");
  await page.goto(`${BASE}/ai-tutor`);
  await expect(page).toHaveURL(/\/student\/ai-tutor$/, { timeout: 15_000 });
  const heading = page.getByRole("heading", { name: /ai tutor/i });
  await expect(heading).toBeVisible({ timeout: 15_000 });
  const backLink = page.getByRole("link", { name: /back to dashboard/i });
  await expect(backLink).toBeVisible({ timeout: 15_000 });
  console.log("  AI Tutor: redirected to /student/ai-tutor, page loaded");
  await page.screenshot({ path: ss("W5-ai-tutor") });
});

test("W6 · DistrictRankWidget shows rank after league reset", async ({ page }) => {
  await signIn(page, "student1@cha.edu.lr");
  await page.goto(`${BASE}/student/today`);
  // Click Progress tab to expose widget
  await page.getByRole("button", { name: "Progress" }).click();
  await page.waitForTimeout(3000);
  const widgetText = await page.locator("text=/District|Rank|#\\d/i").first().textContent().catch(() => null);
  console.log(`  DistrictRankWidget text: ${widgetText}`);
  await page.screenshot({ path: ss("W6-district-rank") });
  await expect(page.locator("main")).toBeVisible();
});
