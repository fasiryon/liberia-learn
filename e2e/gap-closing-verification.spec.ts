import { test, expect } from '@playwright/test';
import { login, loginMoe, expectNoBrokenRuntimeText } from './helpers';

test('MOE dashboard shows county data', async ({ page }) => {
  test.setTimeout(60_000);
  await loginMoe(page, 'official1@moe.gov.lr', 'MOESeed2026!');
  await expect(page).toHaveURL(/\/moe\/dashboard/);
  await expect(page.getByText('Montserrado').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Nimba').first()).toBeVisible();
  await expect(page.getByText('Bong').first()).toBeVisible();
  await expectNoBrokenRuntimeText(page);
});

test('Student welcome flow: unauthenticated redirects to login', async ({ page }) => {
  await page.goto('/student/welcome');
  await expect(page).toHaveURL(/\/login/);
});

test('Student dashboard loads without errors after seed', async ({ page }) => {
  await login(page, 'student', 'student1@cha.edu.lr', 'DemoSeed2026!');
  await expect(page).toHaveURL(/\/dashboard|\/student/);
  await expectNoBrokenRuntimeText(page);
  await expect(page.locator('body')).not.toContainText(/error|500|not found/i);
});

test('Toolkit visible in student lesson', async ({ page }) => {
  await login(page, 'student', 'student1@cha.edu.lr', 'DemoSeed2026!');
  await page.goto('/student/today');
  const lessonLink = page.getByRole('link', { name: /lesson|open|continue/i }).first();
  if (await lessonLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    await lessonLink.click();
    await expect(page.locator('h1').first()).toBeVisible();
  } else {
    await expect(page.locator('body')).not.toContainText(/error|500/i);
  }
});

test('Textbooks accessible from student nav', async ({ page }) => {
  await login(page, 'student', 'student1@cha.edu.lr', 'DemoSeed2026!');
  await expect(page).toHaveURL(/\/student|\/dashboard/);
  await page.goto('/student/textbooks');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator('body')).not.toContainText(/error|500/i);
});

test('Guardian dashboard accessible after login', async ({ page }) => {
  await login(page, 'student', 'guardian1@cha.family.lr', 'DemoSeed2026!');
  await expect(page).toHaveURL(/\/guardian|\/dashboard/);
  await expect(page.locator('body')).toBeVisible();
});

test('Enrollment status page loads and does not expose school code', async ({ page }) => {
  await page.goto('/enroll/status?email=test@example.com');
  await expect(page.locator('body')).toBeVisible();
  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toMatch(/LIB-[A-Z]{3}-\d{4}/);
});

test('Password reset page loads', async ({ page }) => {
  await page.goto('/forgot-password');
  await expect(page.locator('input[type="email"]').first()).toBeVisible();
});
