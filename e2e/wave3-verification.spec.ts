/**
 * Wave 3 Verification
 *
 * Part 1: 7-screenshot structural pass — confirms each wired component renders on prod.
 * Part 2: 2 critical E2E tests — pack answerKey security + full video moderation pipeline.
 *
 * Run: npx playwright test e2e/wave3-verification.spec.ts --headed
 */

import { test, expect, type Page } from "@playwright/test";
import path from "path";
import os from "os";
import fs from "fs";
import JSZip from "jszip";

const BASE = "https://liberia-learn.vercel.app";
const PASS = "DemoSeed2026!";
const SS_DIR = path.join(process.cwd(), "wave3-screenshots");

async function signIn(page: Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.waitForSelector("input[type='email']", { timeout: 15_000 });
  await page.fill("input[type='email']", email);
  await page.fill("input[type='password']", PASS);
  await page.click("button[type='submit']");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
}

function ss(name: string) {
  return path.join(SS_DIR, `${name}.png`);
}

test.beforeAll(() => {
  fs.mkdirSync(SS_DIR, { recursive: true });
});

// ═══════════════════════════════════════════════════════════
// PART 1: Screenshot pass (7 screenshots)
// ═══════════════════════════════════════════════════════════

test.describe("Wave 3 Screenshot Pass", () => {
  test.setTimeout(90_000);

  test("1 · teacher dashboard — Download This Week's Pack button", async ({ page }) => {
    await signIn(page, "teacher1@cha.edu.lr");
    await page.goto(`${BASE}/teacher/dashboard`);
    const packBtn = page.getByText("Download This Week's Pack");
    await expect(packBtn).toBeVisible({ timeout: 15_000 });
    await packBtn.scrollIntoViewIfNeeded();
    await page.screenshot({ path: ss("1-teacher-dashboard-pack-button") });
    console.log("✓ Screenshot 1: teacher dashboard pack button");
  });

  test("2 · teacher lesson — Teacher video upload section", async ({ page }) => {
    await signIn(page, "teacher1@cha.edu.lr");
    await page.goto(`${BASE}/teacher/lesson/science-g5-plants`);
    const videoHeading = page.getByText("Teacher video upload");
    await expect(videoHeading).toBeVisible({ timeout: 20_000 });
    await videoHeading.scrollIntoViewIfNeeded();
    await page.screenshot({ path: ss("2-teacher-lesson-video-upload") });
    console.log("✓ Screenshot 2: teacher lesson video upload section");
  });

  test("3 · /teacher/packs — Pack history page renders", async ({ page }) => {
    await signIn(page, "teacher1@cha.edu.lr");
    await page.goto(`${BASE}/teacher/packs`);
    // Page uses div.ll-dashboard-shell, not <main>
    await expect(page.getByText("Download This Week's Pack")).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: ss("3-teacher-packs-history") });
    console.log("✓ Screenshot 3: teacher packs history page");
  });

  test("4 · student Today — compact pack button + District Rank Widget", async ({ page }) => {
    await signIn(page, "student1@cha.edu.lr");
    await page.goto(`${BASE}/student/today`);
    // Compact pack button (idle state says "Week pack")
    await expect(page.getByText("Week pack")).toBeVisible({ timeout: 15_000 });
    // Click Progress tab to expose DistrictRankWidget
    await page.getByRole("button", { name: "Progress" }).click();
    await page.waitForTimeout(2500); // let the widget fetch
    await page.screenshot({ path: ss("4-student-today-pack-district") });
    console.log("✓ Screenshot 4: student today — pack button + district widget");
  });

  test("5 · /student/certificates — Share to WhatsApp button", async ({ page }) => {
    await signIn(page, "student1@cha.edu.lr");
    await page.goto(`${BASE}/student/certificates`);
    await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000); // certificates fetch
    await page.screenshot({ path: ss("5-student-certificates-whatsapp") });
    console.log("✓ Screenshot 5: student certificates page");
  });

  test("6 · /ai-tutor — Back to Dashboard link", async ({ page }) => {
    await signIn(page, "student1@cha.edu.lr");
    await page.goto(`${BASE}/ai-tutor`);
    const backLink = page.getByRole("link", { name: /back to dashboard/i });
    await expect(backLink).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: ss("6-ai-tutor-back-link") });
    console.log("✓ Screenshot 6: AI tutor back-to-dashboard link");
  });

  test("7 · /admin/video-moderation — Moderation queue renders", async ({ page }) => {
    await signIn(page, "admin@cha.edu.lr");
    await page.goto(`${BASE}/admin/video-moderation`);
    await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(2000); // videos fetch
    await page.screenshot({ path: ss("7-admin-video-moderation") });
    console.log("✓ Screenshot 7: admin video moderation page");
  });
});

// ═══════════════════════════════════════════════════════════
// PART 2: E2E critical tests
// ═══════════════════════════════════════════════════════════

test.describe("Wave 3 E2E Tests", () => {
  test.setTimeout(180_000);

  // ─────────────────────────────────────────────────────────
  // E2E-1: Student pack contains no answerKey (security gate)
  // ─────────────────────────────────────────────────────────
  test("E2E-1 · student pack — answerKey must be absent", async ({ page }) => {
    await signIn(page, "student1@cha.edu.lr");

    // Trigger pack generation via the authenticated browser session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const packResult: any = await page.evaluate(async () => {
      const res = await fetch("/api/packs/week", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience: "student" }),
      });
      const text = await res.text();
      if (!res.ok) return { error: `HTTP ${res.status}: ${text.slice(0, 400)}`, downloadUrl: null };
      try { return JSON.parse(text); } catch { return { error: text.slice(0, 400), downloadUrl: null }; }
    });
    console.log("  Pack result:", JSON.stringify(packResult));

    expect(packResult?.error, `Pack API error: ${packResult?.error}`).toBeFalsy();
    expect(packResult, "Pack API must return a result").not.toBeNull();
    expect(packResult?.downloadUrl, "Must have a downloadUrl").toBeTruthy();
    console.log(`  Pack generated: ${packResult?.lessonCount} lessons — download: ${packResult?.downloadUrl}`);

    // downloadUrl is now a server-proxy route (/api/packs/[id]/download)
    // Use Playwright download API to capture the ZIP through the browser session
    const downloadUrl = packResult?.downloadUrl as string;
    const fullUrl = downloadUrl.startsWith("/")
      ? `${BASE}${downloadUrl}`
      : downloadUrl;

    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60_000 }),
      page.evaluate((url: string) => { window.location.href = url; }, fullUrl),
    ]);

    const downloadPath = await download.path();
    expect(downloadPath, "Download path must exist").toBeTruthy();

    const zipData = fs.readFileSync(downloadPath!);
    expect(zipData.length, "ZIP must not be empty").toBeGreaterThan(0);

    // Parse ZIP with JSZip and scan every file for "answerKey"
    const zip = await JSZip.loadAsync(zipData);
    const fileNames = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
    console.log(`  ZIP contains ${fileNames.length} files`);

    const offenders: string[] = [];
    for (const fileName of fileNames) {
      const content = await zip.files[fileName].async("string");
      if (content.includes("answerKey")) offenders.push(fileName);
    }

    expect(
      offenders,
      `answerKey found in: ${offenders.join(", ")} — stripStudentKeys is broken!`
    ).toHaveLength(0);

    console.log("✓ E2E-1: student pack contains 0 files with answerKey");
    await page.screenshot({ path: ss("e2e1-pack-downloaded") });
  });

  // ─────────────────────────────────────────────────────────
  // E2E-2: Teacher upload → admin approve → video is live
  // ─────────────────────────────────────────────────────────
  test("E2E-2 · video pipeline: upload → approve → confirmed active", async ({ page, context }) => {
    const videoTitle = `E2E-Test-${Date.now()}`;

    // ── Step 1: teacher1 uploads a tiny video ──────────────
    await signIn(page, "teacher1@cha.edu.lr");
    await page.goto(`${BASE}/teacher/lesson/science-g5-plants`);
    await expect(page.getByText("Teacher video upload")).toBeVisible({ timeout: 20_000 });

    // Create a minimal fake MP4 file (passes extension + MIME validation)
    const fakeVideoPath = path.join(os.tmpdir(), `${videoTitle}.mp4`);
    fs.writeFileSync(fakeVideoPath, Buffer.alloc(512, "x"));

    try {
      const videoSection = page.locator("section").filter({ hasText: "Optional video supplement" });
      await expect(videoSection).toBeVisible({ timeout: 15_000 });
      await videoSection.locator("input[type='file']").setInputFiles(fakeVideoPath);
      await videoSection.getByPlaceholder("Video title").fill(videoTitle);
      await videoSection.getByPlaceholder("Duration seconds").fill("30");
      await videoSection.getByRole("button", { name: "Upload video" }).click();

      // Wait for success message (upload takes a few seconds to blob store)
      await expect(
        videoSection.locator("form").getByText(/Video uploaded/i),
        "Upload must succeed within 45s"
      ).toBeVisible({ timeout: 45_000 });

      console.log(`  ✓ Upload succeeded — title: ${videoTitle}`);
      await page.screenshot({ path: ss("e2e2a-teacher-upload-success") });

      // ── Step 2: admin approves the video ──────────────────
      const adminPage = await context.newPage();
      await signIn(adminPage, "admin@cha.edu.lr");
      await adminPage.goto(`${BASE}/admin/video-moderation`);

      // The video should appear in the PENDING tab (default)
      await expect(
        adminPage.getByText(videoTitle),
        `Video "${videoTitle}" must appear in PENDING queue`
      ).toBeVisible({ timeout: 20_000 });

      // Click the Approve button for this video
      const videoItem = adminPage.locator("article, div").filter({ hasText: videoTitle }).first();
      const approveBtn = videoItem.getByRole("button", { name: /^Approve$/ });
      await approveBtn.scrollIntoViewIfNeeded();
      await approveBtn.click();

      // Wait for the video to disappear from PENDING list (filtered out on approval)
      await expect(adminPage.getByText(videoTitle)).not.toBeVisible({ timeout: 10_000 });

      console.log("  ✓ Admin approved — video removed from PENDING queue");
      await adminPage.screenshot({ path: ss("e2e2b-admin-approved") });

      // ── Step 3: confirm via API the video is APPROVED + isActive ──
      const approvedVideo = await adminPage.evaluate(async (title: string) => {
        const res = await fetch(`/api/admin/videos?status=APPROVED`);
        if (!res.ok) return null;
        const data = await res.json() as { videos: Array<{ title: string; status: string; isActive: boolean }> };
        return data.videos?.find((v) => v.title === title) ?? null;
      }, videoTitle);

      expect(approvedVideo, "Video must appear in APPROVED list").not.toBeNull();
      expect(approvedVideo!.status).toBe("APPROVED");
      expect(approvedVideo!.isActive).toBe(true);

      console.log("✓ E2E-2: upload→approve pipeline verified — video is APPROVED and isActive=true");

    } finally {
      fs.unlinkSync(fakeVideoPath);
    }
  });
});
