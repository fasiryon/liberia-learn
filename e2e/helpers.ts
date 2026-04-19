import { expect, type Page } from "@playwright/test";

export async function login(page: Page, role: "student" | "teacher" | "admin", email: string, password: string) {
  await page.goto(`/login?role=${role}`);
  await page.getByRole("button", { name: new RegExp(`^${role}$`, "i") }).click();
  await page.locator('input[type="email"], input[type="text"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: /continue/i }).click();
}

export async function loginMoe(page: Page, email: string, password: string) {
  await page.goto("/moe/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /sign in to moe portal/i }).click();
}

export async function expectNoBrokenRuntimeText(page: Page) {
  await expect(page.locator("body")).not.toContainText(/\[object|undefined|null|NaN/);
}

export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

export async function expectAnyVisiblePositiveNumber(page: Page) {
  const values = await page.locator("body").evaluate((body) =>
    Array.from((body as HTMLElement).innerText.matchAll(/\b\d+(?:\.\d+)?\b/g)).map((match) => Number(match[0]))
  );
  expect(values.some((value) => value > 0)).toBe(true);
}

export async function expectPageOk(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `${path} should not return 404`).not.toBe(404);
  expect(response?.ok(), `${path} should load successfully`).toBeTruthy();
}
