import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://liberia-learn.vercel.app";
const SEEDED_LESSON_PATH = "/student/lessons/cha-demo-student1-multimedia-lesson";
const E2E_DEMO_STUDENT_EMAIL = process.env.E2E_DEMO_STUDENT_EMAIL || "student1@cha.edu.lr";
const E2E_DEMO_STUDENT_PASSWORD = process.env.E2E_DEMO_STUDENT_PASSWORD;

test.skip(
  !E2E_DEMO_STUDENT_PASSWORD,
  "Skipping multimedia lesson E2E tests because E2E_DEMO_STUDENT_PASSWORD is not set."
);

async function loginStudent(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', E2E_DEMO_STUDENT_EMAIL);
  await page.fill('input[type="password"]', E2E_DEMO_STUDENT_PASSWORD!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|student)/, { timeout: 15000 });
}

test("seeded lesson supports Read, Slides, and Listen modes", async ({ page }) => {
  await loginStudent(page);
  await page.goto(`${BASE}${SEEDED_LESSON_PATH}`);
  await expect(page.getByRole("heading", { name: /Ratios in Market Prices/i })).toBeVisible();

  await page.getByRole("button", { name: "Read" }).click();
  await expect(page.locator("text=Ratios help us compare")).toBeVisible();

  await page.getByRole("button", { name: "Slides" }).click();
  await expect(page.locator("text=/Slide 1 of/")).toBeVisible();
  await page.getByRole("button", { name: /Next slide/i }).click();
  await expect(page.getByRole("heading", { name: "What a Ratio Means" })).toBeVisible();

  await page.getByRole("button", { name: "Listen" }).click();
  await expect(page.locator("text=/Audio being prepared|Audio is not generated yet|Download audio/")).toBeVisible();
  await expect(page.getByRole("button", { name: /Ask the tutor/i }).first()).toBeVisible();
  await expect(page.locator("text=/Exit Ticket|Quiz/").first()).toBeVisible();
});

test("seeded lesson appears from student today", async ({ page }) => {
  await loginStudent(page);
  await page.goto(`${BASE}/student/today`);
  await expect(page.getByRole("link", { name: /Ratios in Market Prices/i })).toBeVisible();
});
