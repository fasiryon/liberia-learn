import { test } from '@playwright/test'

const BASE = 'https://liberia-learn.vercel.app'
const SLOW = 2500
const MEDIUM = 1500
const FAST = 1000

async function smoothScroll(page: any, amount: number) {
  await page.evaluate((px: number) => {
    window.scrollBy({ top: px, behavior: 'smooth' })
  }, amount)
  await page.waitForTimeout(1200)
}

async function scrollTop(page: any) {
  await page.evaluate(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
  await page.waitForTimeout(800)
}

test('LiberiaLearn VSL platform walkthrough',
async ({ page }) => {
  // Full recording walkthrough needs more time than a normal smoke test.
  test.setTimeout(240000)

  // Set viewport to match launch args
  await page.setViewportSize({ width: 1920, height: 1080 })
  // Ensure page is not in a narrow container
  await page.evaluate(() => {
    document.documentElement.style.zoom = '1'
  })

  // SCENE 1 — HOMEPAGE (0:00 – 0:08)
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(SLOW)
  await smoothScroll(page, 300)
  await page.waitForTimeout(MEDIUM)
  await scrollTop(page)
  await page.waitForTimeout(SLOW)

  // SCENE 2 — STUDENT LOGIN (0:08 – 0:15)
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(MEDIUM)
  await page.click('input[type="email"]')
  await page.waitForTimeout(FAST)
  await page.type('input[type="email"]',
    'student1@cha.edu.lr', { delay: 80 })
  await page.waitForTimeout(600)
  await page.click('input[type="password"]')
  await page.waitForTimeout(400)
  await page.type('input[type="password"]',
    'DemoSeed2026!', { delay: 60 })
  await page.waitForTimeout(800)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/student|\/dashboard/,
    { timeout: 15000 })
  await page.waitForTimeout(SLOW)

  // SCENE 3 — STUDENT DASHBOARD (0:15 – 0:25)
  await page.waitForTimeout(SLOW + 500)
  await smoothScroll(page, 250)
  await page.waitForTimeout(MEDIUM)
  await smoothScroll(page, 200)
  await page.waitForTimeout(SLOW)
  await scrollTop(page)
  await page.waitForTimeout(FAST)

  // SCENE 4 — STUDENT TODAY PAGE (0:25 – 0:35)
  await page.goto(`${BASE}/student/today`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(SLOW)
  await smoothScroll(page, 300)
  await page.waitForTimeout(MEDIUM)

  const lessonLinks = page.getByRole('link', {
    name: /open|continue|lesson|start/i
  })
  const firstLesson = lessonLinks.first()
  let lessonLoaded = false
  if (await firstLesson.isVisible().catch(() => false)) {
    await firstLesson.click()
    await page.waitForTimeout(SLOW)
    lessonLoaded = true
  }

  if (!lessonLoaded) {
    await page.goto(`${BASE}/student/curriculum`)
    await page.waitForTimeout(MEDIUM)
    const currLink = page.getByRole('link').first()
    if (await currLink.isVisible().catch(() => false)) {
      await currLink.click()
      await page.waitForTimeout(SLOW)
    }
  }

  // SCENE 5 — LESSON READ MODE (0:35 – 0:45)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(SLOW)
  await smoothScroll(page, 200)
  await page.waitForTimeout(MEDIUM)
  await smoothScroll(page, 200)
  await page.waitForTimeout(MEDIUM)
  await scrollTop(page)
  await page.waitForTimeout(FAST)

  // SCENE 6 — SLIDES MODE (0:45 – 0:50)
  const slidesTab = page.getByRole('button',
    { name: /slides/i }).first()
  if (await slidesTab.isVisible().catch(() => false)) {
    await slidesTab.click()
    await page.waitForTimeout(SLOW)
    const nextBtn = page.getByRole('button',
      { name: /next/i }).first()
    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click()
      await page.waitForTimeout(MEDIUM)
      await nextBtn.click()
      await page.waitForTimeout(MEDIUM)
    }
  }

  // SCENE 7  AI TUTOR
  await scrollTop(page)
  await page.waitForTimeout(FAST)

  try {
    page.setDefaultTimeout(15000)

    // First dismiss any overlay/modal that
    // may be blocking interactions
    const overlay = page.locator(
      '[aria-label="Close lesson help"], ' +
      '[aria-label="Close"], ' +
      '.backdrop-blur-sm button'
    ).first()

    if (await overlay.isVisible().catch(() => false)) {
      // Press Escape to dismiss overlay
      await page.keyboard.press('Escape')
      await page.waitForTimeout(800)
    }

    const tutorBtn = page.locator(
      '[aria-label="Ask the tutor"], ' +
      'button:has-text("Ask the tutor")'
    ).first()

    if (await tutorBtn.isVisible().catch(() => false)) {
      await tutorBtn.click()
      await page.waitForTimeout(SLOW)

      // Wait for overlay to clear after tutor opens
      await page.waitForTimeout(500)

      // Dismiss backdrop if it appeared
      const backdrop = page.locator(
        '.backdrop-blur-sm'
      ).first()
      if (await backdrop.isVisible()
        .catch(() => false)) {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(500)
      }

      // Find tutor input  try multiple selectors
      const tutorInput = page.locator(
        '[data-testid="tutor-input"], ' +
        'textarea[placeholder*="question"], ' +
        'textarea[placeholder*="ask"], ' +
        'textarea'
      ).first()

      if (await tutorInput.isVisible()
        .catch(() => false)) {
        await tutorInput.click()
        await page.waitForTimeout(400)
        await tutorInput.fill(
          'Can you explain this in simpler terms?'
        )
        await page.waitForTimeout(600)

        // Use keyboard submit instead of button click
        // to avoid overlay interception
        await page.keyboard.press('Enter')
        await page.waitForTimeout(5000)
      }
    }

    await page.waitForTimeout(SLOW)

  } catch (e) {
    console.log('Tutor scene skipped:',
      (e as Error).message.substring(0, 100))
    await page.waitForTimeout(500)
  }

  // SCENE 8 — TEACHER LOGIN (1:00 – 1:08)
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(MEDIUM)
  await page.click('input[type="email"]')
  await page.waitForTimeout(400)
  await page.type('input[type="email"]',
    'teacher1@cha.edu.lr', { delay: 80 })
  await page.waitForTimeout(500)
  await page.click('input[type="password"]')
  await page.waitForTimeout(400)
  await page.type('input[type="password"]',
    'DemoSeed2026!', { delay: 60 })
  await page.waitForTimeout(600)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/teacher/, { timeout: 15000 })
  await page.waitForTimeout(SLOW)

  // SCENE 9 — TEACHER DASHBOARD (1:08 – 1:20)
  await page.waitForTimeout(SLOW + 500)
  const alertBell = page.locator(
    '[aria-label*="alert"], [data-testid="alert-bell"]'
  ).first()
  if (await alertBell.isVisible().catch(() => false)) {
    await alertBell.click()
    await page.waitForTimeout(SLOW)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(FAST)
  }
  await smoothScroll(page, 300)
  await page.waitForTimeout(MEDIUM)

  // SCENE 10 — MY STUDENTS (1:20 – 1:30)
  await page.goto(`${BASE}/teacher/students`)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(SLOW)
  const studentRow = page.locator(
    'tbody tr, [data-testid="student-row"]'
  ).first()
  if (await studentRow.isVisible().catch(() => false)) {
    await studentRow.click()
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    const reviewBtn = page.getByRole('link',
      { name: /review/i }).first()
    if (await reviewBtn.isVisible().catch(() => false)) {
      await reviewBtn.click()
      await page.waitForTimeout(SLOW)
      await page.waitForTimeout(MEDIUM)
    }
  }

  // SCENE 11-12 — MOE (optional, graceful fallback)
  try {
    await page.goto(`${BASE}/moe/login`)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(MEDIUM)
    await page.fill('input[type="email"]',
      'official1@moe.gov.lr')
    await page.waitForTimeout(500)
    await page.fill('input[type="password"]',
      'DemoSeed2026!')
    await page.waitForTimeout(600)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/moe\/dashboard|\/moe/,
      { timeout: 10000 })
    await page.waitForTimeout(SLOW)

    await page.waitForTimeout(SLOW + 500)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(SLOW)

  } catch (e) {
    console.log('MOE scene skipped:',
      (e as Error).message)
    // Continue to closing scene
  }

  // SCENE 13 — HOMEPAGE CLOSING (1:55 – 2:00)
  await page.goto(BASE)
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(SLOW)
  const ctaBtn = page.getByRole('link',
    { name: /access the platform/i }).first()
  if (await ctaBtn.isVisible().catch(() => false)) {
    await ctaBtn.scrollIntoViewIfNeeded()
    await page.waitForTimeout(MEDIUM)
  }
  await page.waitForTimeout(SLOW + 1000)

})
