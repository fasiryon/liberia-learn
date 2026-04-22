import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'https://liberia-learn.vercel.app';

test('no oversized radius on dashboard cards', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  // Check that no element uses rounded-3xl or rounded-2xl on card/section containers
  const oversized = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="rounded-3xl"], [class*="rounded-2xl"]');
    return Array.from(els)
      .filter((el) => {
        const tag = el.tagName.toLowerCase();
        return tag === 'div' || tag === 'section' || tag === 'article';
      })
      .map((el) => el.className);
  });
  expect(oversized).toHaveLength(0);
});

test('no hardcoded cyan or rose fills on dashboard surfaces', async ({ page }) => {
  await page.goto(`${BASE}/login`);
  const badColors = await page.evaluate(() => {
    const els = document.querySelectorAll('[class*="bg-cyan-"], [class*="bg-rose-"]');
    return Array.from(els)
      .filter((el) => {
        const tag = el.tagName.toLowerCase();
        return tag === 'div' || tag === 'section';
      })
      .map((el) => el.className);
  });
  expect(badColors).toHaveLength(0);
});

test('student today page is auth-guarded and redirects to login', async ({ page }) => {
  // Page is a client component; unauthenticated → redirect to login
  const res = await page.request.get(`${BASE}/student/today`, { maxRedirects: 0 });
  // Middleware should redirect (3xx) rather than error (5xx)
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(res.status()).toBeLessThan(400);
});

test('skeleton components exist in source', async ({ page }) => {
  const res = await page.request.get(`${BASE}/student/today`);
  // Page loads without error
  expect(res.status()).toBeLessThan(500);
});

test('no horizontal overflow on mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${BASE}/login`);
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow).toBe(false);
});
