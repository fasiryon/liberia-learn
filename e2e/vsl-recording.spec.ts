import { test } from '@playwright/test'

const BASE = 'https://liberia-learn.vercel.app'
const SLOW = 3000
const MEDIUM = 2000
const FAST = 1000

const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL ?? 'student1@cha.edu.lr'
const STUDENT_PASS = process.env.E2E_STUDENT_PASS ?? 'DemoSeed2026!'
const TEACHER_EMAIL = process.env.E2E_TEACHER_EMAIL ?? 'teacher1@cha.edu.lr'
const TEACHER_PASS = process.env.E2E_TEACHER_PASS ?? 'DemoSeed2026!'
const MOE_EMAIL = process.env.E2E_MOE_EMAIL ?? 'official1@moe.gov.lr'
const MOE_PASS = process.env.E2E_MOE_PASS ?? 'DemoSeed2026!'

async function smoothScroll(page: any, amount: number) {
  await page.evaluate((px: number) => {
    window.scrollBy({ top: px, behavior: 'smooth' })
  }, amount)
  await page.waitForTimeout(1000)
}

async function scrollTop(page: any) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
  await page.waitForTimeout(600)
}

async function signOut(page: any) {
  try {
    await page.evaluate(async (base: string) => {
      try {
        const csrf = await fetch(`${base}/api/auth/csrf`).then(r => r.json())
        await fetch(`${base}/api/auth/signout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            csrfToken: csrf.csrfToken ?? '',
            callbackUrl: `${base}/login`,
          }).toString(),
        })
      } catch (_) { /* ignore */ }
    }, BASE)
    await page.context().clearCookies()
    await page.waitForTimeout(500)
  } catch (_) { /* ignore */ }
}

test('LiberiaLearn — End to End Story', async ({ page }) => {

  await page.setViewportSize({ width: 1280, height: 800 })

  // SCENE 1 (0:00-0:08): Homepage — show the problem and the platform
  await page.goto(BASE, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  })
  await page.waitForTimeout(MEDIUM)
  await smoothScroll(page, 200)
  await page.waitForTimeout(MEDIUM)
  await scrollTop(page)
  await page.waitForTimeout(MEDIUM)

  // SCENE 2 (0:08-0:18): Student login
  await page.goto(`${BASE}/login`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  })
  await page.waitForTimeout(MEDIUM)
  await page.fill('input[type="email"]', STUDENT_EMAIL)
  await page.waitForTimeout(500)
  await page.fill('input[type="password"]', STUDENT_PASS)
  await page.waitForTimeout(600)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/student|\/dashboard/, { timeout: 30000 })
  await page.waitForTimeout(SLOW)

  // SCENE 3 (0:18-0:30): Today page — show schedule
  await page.goto(`${BASE}/student/today`, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  })
  await page.waitForTimeout(MEDIUM)
  // Hold on schedule — let viewer read the periods
  await page.waitForTimeout(SLOW)
  await smoothScroll(page, 200)
  await page.waitForTimeout(MEDIUM)
  await scrollTop(page)
  await page.waitForTimeout(FAST)

  // SCENE 4 (0:30-0:45): Click first Open button → lesson opens
  const openBtn = page.getByRole('button', { name: /open/i }).first()
  const lessonLink = page.getByRole('link', { name: /open|start|continue/i }).first()

  let lessonOpened = false
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click()
    lessonOpened = true
  } else if (await lessonLink.isVisible().catch(() => false)) {
    await lessonLink.click()
    lessonOpened = true
  }

  if (lessonOpened) {
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(MEDIUM)
  }

  // SCENE 5 (0:45-1:05): Scroll lesson content slowly — show Liberian context, worked examples
  if (lessonOpened) {
    await scrollTop(page)
    await page.waitForTimeout(FAST)
    // Slow scroll to reveal the full lesson body
    await smoothScroll(page, 250)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 250)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 250)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 250)
    await page.waitForTimeout(MEDIUM)
  } else {
    // Fallback: browse the lessons library
    await page.goto(`${BASE}/student/lessons`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 400)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 400)
    await page.waitForTimeout(SLOW)
  }

  // SCENE 6 (1:05-1:20): If lab button is visible at bottom of lesson → click and show lab
  try {
    const labBtn = page.locator(
      'a[href*="/labs/"], a:has-text("Open Lab"), a:has-text("Try the Lab")'
    ).first()

    if (await labBtn.isVisible().catch(() => false)) {
      await labBtn.scrollIntoViewIfNeeded()
      await page.waitForTimeout(MEDIUM)
      await labBtn.click()
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(SLOW)

      // Show the lab — click Play if available
      const playBtn = page.getByRole('button', { name: /play/i }).first()
      if (await playBtn.isVisible().catch(() => false)) {
        await playBtn.click()
        await page.waitForTimeout(SLOW)
      }
      await smoothScroll(page, 200)
      await page.waitForTimeout(MEDIUM)
    }
  } catch (e) {
    console.log('Lab-from-lesson scene skipped:', (e as Error).message)
  }

  // SCENE 7 (1:20-1:35): Teacher login
  await signOut(page)
  try {
    await page.goto(`${BASE}/login`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })
    await page.waitForTimeout(MEDIUM)
    await page.fill('input[type="email"]', TEACHER_EMAIL)
    await page.waitForTimeout(400)
    await page.fill('input[type="password"]', TEACHER_PASS)
    await page.waitForTimeout(500)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/teacher/, { timeout: 30000 })
    await page.waitForTimeout(SLOW)

    // SCENE 8 (1:35-1:50): Teacher students list → click Pewu → show progress + trends
    await page.goto(`${BASE}/teacher/students`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 200)
    await page.waitForTimeout(MEDIUM)

    const studentLink = page.getByRole('link', { name: /Pewu|Gongloe|student/i }).first()
    if (await studentLink.isVisible().catch(() => false)) {
      await studentLink.click()
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(MEDIUM)
      await smoothScroll(page, 300)
      await page.waitForTimeout(SLOW)
      await smoothScroll(page, 300)
      await page.waitForTimeout(MEDIUM)
    }
  } catch (e) {
    console.log('Teacher scene skipped:', (e as Error).message)
  }

  // SCENE 9 (1:50-2:05): MOE login → dashboard — show Montserrado, district data
  await signOut(page)
  try {
    await page.goto(`${BASE}/login`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    })
    await page.waitForTimeout(MEDIUM)
    await page.fill('input[type="email"]', MOE_EMAIL)
    await page.waitForTimeout(400)
    await page.fill('input[type="password"]', MOE_PASS)
    await page.waitForTimeout(500)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/moe\/dashboard/, { timeout: 30000 })
    await page.waitForTimeout(SLOW + 500)
    // Show national KPIs
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
    // Show district data
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
    await scrollTop(page)
    await page.waitForTimeout(MEDIUM)
  } catch (e) {
    console.log('MOE scene skipped:', (e as Error).message)
  }

  // SCENE 10 (2:05-2:15): Homepage closing
  await page.goto(BASE, {
    waitUntil: 'domcontentloaded',
    timeout: 20000,
  })
  await page.waitForTimeout(MEDIUM)
  const cta = page.getByRole('link', { name: /access the platform/i }).first()
  if (await cta.isVisible().catch(() => false)) {
    await cta.scrollIntoViewIfNeeded()
    await page.waitForTimeout(MEDIUM)
  }
  await page.waitForTimeout(SLOW + 500)
})
