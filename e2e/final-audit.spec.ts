import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://liberia-learn.vercel.app";
const E2E_DEMO_STUDENT_EMAIL = process.env.E2E_DEMO_STUDENT_EMAIL;
const E2E_DEMO_STUDENT_PASSWORD = process.env.E2E_DEMO_STUDENT_PASSWORD;
const E2E_DEMO_TEACHER_EMAIL = process.env.E2E_DEMO_TEACHER_EMAIL;
const E2E_DEMO_TEACHER_PASSWORD = process.env.E2E_DEMO_TEACHER_PASSWORD;
const E2E_DEMO_ADMIN_EMAIL = process.env.E2E_DEMO_ADMIN_EMAIL;
const E2E_DEMO_ADMIN_PASSWORD = process.env.E2E_DEMO_ADMIN_PASSWORD;
const E2E_DEMO_GUARDIAN_EMAIL = process.env.E2E_DEMO_GUARDIAN_EMAIL;
const E2E_DEMO_GUARDIAN_PASSWORD = process.env.E2E_DEMO_GUARDIAN_PASSWORD;
const E2E_DEMO_MOE_EMAIL = process.env.E2E_DEMO_MOE_EMAIL;
const E2E_DEMO_MOE_PASSWORD = process.env.E2E_DEMO_MOE_PASSWORD;

test.skip(
  !E2E_DEMO_STUDENT_EMAIL ||
    !E2E_DEMO_STUDENT_PASSWORD ||
    !E2E_DEMO_TEACHER_EMAIL ||
    !E2E_DEMO_TEACHER_PASSWORD ||
    !E2E_DEMO_ADMIN_EMAIL ||
    !E2E_DEMO_ADMIN_PASSWORD ||
    !E2E_DEMO_GUARDIAN_EMAIL ||
    !E2E_DEMO_GUARDIAN_PASSWORD ||
    !E2E_DEMO_MOE_EMAIL ||
    !E2E_DEMO_MOE_PASSWORD,
  "Skipping final audit E2E tests because required E2E demo credential environment variables are not set."
);

test("homepage loads and all role links work", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator("h1").first()).toBeVisible();

  const studentLink = page.getByRole("link", { name: /student sign.?in/i }).first();
  const teacherLink = page.getByRole("link", { name: /teacher sign.?in/i }).first();
  await expect(studentLink).toBeVisible();
  await expect(teacherLink).toBeVisible();

  await page.goto(`${BASE}/legal/privacy`);
  await expect(page.locator("body")).toBeVisible();
  const privacy = await page.locator("body").innerText();
  expect(privacy.length).toBeGreaterThan(200);

  await page.goto(`${BASE}/legal/terms`);
  await expect(page.locator("body")).toBeVisible();
});

test("student full journey — login to lesson", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', E2E_DEMO_STUDENT_EMAIL!);
  await page.fill('input[type="password"]', E2E_DEMO_STUDENT_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/student|\/dashboard/, { timeout: 15000 });
  await page.waitForTimeout(2000);

  const body = await page.locator("body").innerText();
  expect(body.length).toBeGreaterThan(300);

  await page.goto(`${BASE}/student/today`);
  await page.waitForTimeout(2000);
  await expect(page.locator("body")).toBeVisible();

  await page.goto(`${BASE}/student/labs`);
  await page.waitForTimeout(2000);
  const labsBody = await page.locator("body").innerText();
  expect(labsBody).toContain("Physics");
  expect(labsBody).toContain("Biology");
  expect(labsBody).toContain("Chemistry");
  expect(labsBody).toContain("Earth Science");
});

test("teacher full journey — login to student review", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', E2E_DEMO_TEACHER_EMAIL!);
  await page.fill('input[type="password"]', E2E_DEMO_TEACHER_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/teacher/, { timeout: 15000 });
  await page.waitForTimeout(2000);

  await expect(page.locator("body")).toBeVisible();

  await page.goto(`${BASE}/teacher/students`);
  await page.waitForTimeout(2000);
  const studentsBody = await page.locator("body").innerText();
  expect(studentsBody).toContain("Students");

  await page.goto(`${BASE}/teacher/alerts`);
  await page.waitForTimeout(2000);
  await expect(page.locator("body")).toBeVisible();
});

test("admin dashboard loads with real data", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', E2E_DEMO_ADMIN_EMAIL!);
  await page.fill('input[type="password"]', E2E_DEMO_ADMIN_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 15000 });
  await page.waitForTimeout(2000);

  const body = await page.locator("body").innerText();
  expect(body.toLowerCase()).toMatch(/school operations|curriculum|communications/i);

  await page.goto(`${BASE}/admin/curriculum`);
  await page.waitForTimeout(2000);
  await expect(page.locator("body")).toBeVisible();
});

test("MOE dashboard shows national data", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(`${BASE}/moe/login`);
  await page.fill('input[type="email"]', E2E_DEMO_MOE_EMAIL!);
  await page.fill('input[type="password"]', E2E_DEMO_MOE_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/moe\/dashboard/, { timeout: 15000 });

  // Give the 4 parallel client-side API calls time to complete and render
  await page.waitForTimeout(8000);

  const body = await page.locator("body").innerText();
  expect(body).toContain("Montserrado");
  expect(body).not.toContain(E2E_DEMO_STUDENT_EMAIL!);
  expect(body).not.toMatch(/DemoSeed/);

  await page.goto(`${BASE}/moe/login`);
  const backLink = page.getByText(/back to/i).first();
  await expect(backLink).toBeVisible();
});

test("guardian journey — login to messages", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', E2E_DEMO_GUARDIAN_EMAIL!);
  await page.fill('input[type="password"]', E2E_DEMO_GUARDIAN_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/guardian|\/dashboard/, { timeout: 15000 });
  await page.waitForTimeout(2000);

  await expect(page.locator("body")).toBeVisible();

  await page.goto(`${BASE}/guardian/messages`);
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  expect(body.toLowerCase()).toMatch(/back|message|compose|teacher/i);
});

test("signout page is branded", async ({ page }) => {
  await page.goto(`${BASE}/signout`);
  await page.waitForTimeout(2000);
  const body = await page.locator("body").innerText();
  expect(body.toLowerCase()).toMatch(/sign.*out|liberia|cancel/i);
});

test("404 page handles gracefully", async ({ page }) => {
  await page.goto(`${BASE}/this-does-not-exist-xyz`);
  await page.waitForTimeout(1000);
  const body = await page.locator("body").innerText();
  expect(body).not.toContain("Application error");
  expect(body.length).toBeGreaterThan(10);
});

test("mobile 375px — no overflow on key pages", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });

  const pages = [
    BASE,
    `${BASE}/login`,
    `${BASE}/moe/login`,
    `${BASE}/enroll`,
    `${BASE}/legal/privacy`,
  ];

  for (const url of pages) {
    await page.goto(url);
    await page.waitForTimeout(1000);
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth
    );
    expect(hasOverflow, `Overflow detected at ${url}`).toBe(false);
  }
});

test("student progress and certificates have back nav", async ({ page }) => {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', E2E_DEMO_STUDENT_EMAIL!);
  await page.fill('input[type="password"]', E2E_DEMO_STUDENT_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/student|\/dashboard/, { timeout: 15000 });

  await page.goto(`${BASE}/student/progress`);
  await page.waitForTimeout(2000);
  const progBody = await page.locator("body").innerText();
  expect(progBody.toLowerCase()).toMatch(/back|dashboard/i);

  await page.goto(`${BASE}/student/certificates`);
  await page.waitForTimeout(2000);
  const certBody = await page.locator("body").innerText();
  expect(certBody.toLowerCase()).toMatch(/back|dashboard|certificate/i);
});

test("pilot-preview page is presentable", async ({ page }) => {
  await page.goto(`${BASE}/pilot-preview`);
  await page.waitForTimeout(1000);
  const body = await page.locator("body").innerText();
  expect(body.length).toBeGreaterThan(200);
  expect(body.toLowerCase()).toMatch(/ministry|moe|school|admin|liberia/i);
});

test("enroll page works without auth", async ({ page }) => {
  await page.goto(`${BASE}/enroll`);
  await page.waitForTimeout(1000);
  const body = await page.locator("body").innerText();
  expect(body.toLowerCase()).toMatch(/enroll|school|county|principal/i);
});

test("legal pages load completely", async ({ page }) => {
  for (const path of ["/legal/privacy", "/legal/terms", "/legal/data-for-minors", "/contact"]) {
    await page.goto(`${BASE}${path}`);
    await page.waitForTimeout(1000);
    const body = await page.locator("body").innerText();
    expect(body.length, `${path} content too short`).toBeGreaterThan(200);
  }
});
