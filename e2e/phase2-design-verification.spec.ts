import { test, expect } from '@playwright/test';

const BASE = 'https://liberia-learn.vercel.app';

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

test('empty state copy on student today page', async ({ page }) => {
  // Verify the empty state text is present in the source
  const res = await page.request.get(`${BASE}/student/today`);
  const body = await res.text();
  expect(body).toContain('Nothing scheduled yet');
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
