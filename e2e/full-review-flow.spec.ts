import { expect, test, type Page } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://liberia-learn.vercel.app";
const SEEDED_LESSON = "/student/lessons/cha-demo-student1-multimedia-lesson";
const SEEDED_CONTENT_ID = "cha-g9-math-multimedia-demo";

async function login(page: Page, email: string, password: string, role?: "student" | "teacher" | "admin" | "guardian") {
  await page.goto(`${BASE}/login${role ? `?role=${role}` : ""}`);
  if (role) {
    await page.getByRole("button", { name: role, exact: true }).click();
  }
  await page.fill('input[type="email"], input[type="text"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForLoadState("networkidle");
}

async function loginMoe(page: Page) {
  await page.goto(`${BASE}/moe/login`);
  await page.fill('input[type="email"]', "official1@moe.gov.lr");
  await page.fill('input[type="password"]', "MOESeed2026!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/moe\/dashboard/, { timeout: 20000 });
}

async function makeWebmBuffer(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1a1a18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#E8B84B";
    ctx.fillRect(24, 30, 112, 20);
    const stream = canvas.captureStream(5);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 600));
    recorder.stop();
    await new Promise((resolve) => (recorder.onstop = resolve));
    const blob = new Blob(chunks, { type: "video/webm" });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return Buffer.from(bytes);
}

test("student reviewer flow has no dead navigation", async ({ page }) => {
  await login(page, "student1@cha.edu.lr", "DemoSeed2026!", "student");
  await page.goto(`${BASE}${SEEDED_LESSON}`);
  await expect(page.getByRole("heading", { name: /Ratios in Market Prices/i })).toBeVisible();
  await page.getByRole("button", { name: "Slides" }).click();
  await expect(page.locator("text=/Slide 1 of/")).toBeVisible();
  await page.getByRole("button", { name: "Listen" }).click();
  await expect(page.locator("text=/Audio being prepared|Audio is not generated yet|Download audio/")).toBeVisible();

  await page.goto(`${BASE}/student/exams`);
  await expect(page.getByRole("heading", { name: /My Exams/i })).toBeVisible();
  await page.goto(`${BASE}/student/certificates`);
  await expect(page.getByRole("heading", { name: /My Certificates/i })).toBeVisible();
  await page.goto(`${BASE}/student/textbooks`);
  await expect(page.getByRole("heading", { name: /My Textbooks/i })).toBeVisible();
});

test("teacher uploads and activates a real video supplement", async ({ page }) => {
  await login(page, "teacher1@cha.edu.lr", "DemoSeed2026!", "teacher");
  await page.goto(`${BASE}/teacher/lesson/${SEEDED_CONTENT_ID}`);
  await expect(page.getByRole("heading", { name: /Ratios in Market Prices/i })).toBeVisible();
  const buffer = await makeWebmBuffer(page);
  await page.setInputFiles('input[type="file"]', {
    name: `review-${Date.now()}.webm`,
    mimeType: "video/webm",
    buffer,
  });
  await page.fill('input[placeholder="Video title"]', "Review walkthrough introduction");
  await page.fill('input[placeholder="Duration seconds"]', "1");
  await page.getByRole("button", { name: /upload video/i }).click();
  await expect(page.getByText(/Video uploaded/)).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: /^Activate$/i }).first().click();
  await expect(page.getByRole("button", { name: /^Deactivate$/i }).first()).toBeVisible({ timeout: 15000 });
});

test("student sees active teacher video after upload", async ({ page }) => {
  await login(page, "student1@cha.edu.lr", "DemoSeed2026!", "student");
  await page.goto(`${BASE}${SEEDED_LESSON}`);
  await expect(page.locator("video").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("text=/Lesson introduction by/i")).toBeVisible();
});

test("admin audio batch controls and analytics are visible", async ({ page }) => {
  await login(page, "admin@cha.edu.lr", "DemoSeed2026!", "admin");
  await page.goto(`${BASE}/admin/curriculum`);
  await expect(page.getByRole("button", { name: /Batch generate audio/i })).toBeVisible();
  await page.getByRole("button", { name: /Batch generate audio/i }).click();
  await expect(page.locator("text=/Queued|reused|Batch queue/")).toBeVisible({ timeout: 20000 });
  await page.goto(`${BASE}/admin/analytics`);
  await expect(page.getByRole("heading", { name: "Lesson Mode Usage" })).toBeVisible();
});

test("MOE and guardian review surfaces show real data", async ({ page }) => {
  await loginMoe(page);
  await expect(page.locator("text=Lesson Mode Usage")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Audio Starts")).toBeVisible();
  await expect(page.getByText("Active Videos")).toBeVisible();

  await page.context().clearCookies();
  await login(page, "guardian1@cha.family.lr", "DemoSeed2026!", "guardian");
  await page.goto(`${BASE}/guardian`);
  await expect(page.locator("text=/Fatu Kollie|student/i")).toBeVisible({ timeout: 20000 });
});

test("platform admin demo account lands in platform console", async ({ page }) => {
  await login(page, "platform.admin@liberialearn.org", "DemoSeed2026!", "admin");
  await page.goto(`${BASE}/platform`);
  await expect(page.getByRole("heading", { name: "Platform Dashboard" })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("link", { name: "Schools", exact: true })).toBeVisible();
});
