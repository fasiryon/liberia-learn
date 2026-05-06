import { test } from '@playwright/test'

const BASE = 'https://liberia-learn.vercel.app'
const SLOW = 3000
const MEDIUM = 2000
const FAST = 1000

async function smoothScroll(
  page: any, amount: number
) {
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

test('LiberiaLearn  End to End Story',
async ({ page }) => {

  await page.setViewportSize({
    width: 1280, height: 800
  })

  // ACT 1  HOMEPAGE (0:00-0:08)
  // Show the problem and the platform
  await page.goto(BASE, {
    waitUntil: 'networkidle'
  })
  await page.waitForTimeout(SLOW)
  await smoothScroll(page, 200)
  await page.waitForTimeout(MEDIUM)
  await scrollTop(page)
  await page.waitForTimeout(MEDIUM)

  // ACT 2  STUDENT LOGS IN (0:08-0:20)
  await page.goto(`${BASE}/login`, {
    waitUntil: 'networkidle'
  })
  await page.waitForTimeout(MEDIUM)
  await page.click('input[type="email"]')
  await page.type('input[type="email"]',
    'student1@cha.edu.lr', { delay: 80 })
  await page.waitForTimeout(500)
  await page.click('input[type="password"]')
  await page.type('input[type="password"]',
    'DemoSeed2026!', { delay: 60 })
  await page.waitForTimeout(600)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/student|\/dashboard/,
    { timeout: 15000 })
  await page.waitForTimeout(SLOW)

  // ACT 3  TODAY PAGE WITH SCHEDULE (0:20-0:35)
  // Show the real school day timetable
  await page.goto(`${BASE}/student/today`, {
    waitUntil: 'networkidle'
  })
  await page.waitForTimeout(SLOW)
  // Hold on schedule  let viewer read the periods
  await page.waitForTimeout(MEDIUM)
  await smoothScroll(page, 200)
  await page.waitForTimeout(MEDIUM)
  await scrollTop(page)
  await page.waitForTimeout(FAST)

  // ACT 4  OPEN A LESSON (0:35-0:50)
  // Find and open the first period lesson
  const openBtn = page.getByRole('button', {
    name: /open/i
  }).first()
  const lessonLink = page.getByRole('link', {
    name: /open|start|continue/i
  }).first()

  let lessonOpened = false
  if (await openBtn.isVisible().catch(() => false)) {
    await openBtn.click()
    lessonOpened = true
  } else if (await lessonLink.isVisible()
    .catch(() => false)) {
    await lessonLink.click()
    lessonOpened = true
  }

  if (lessonOpened) {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(SLOW)
    // Scroll through lesson content slowly
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  }

  // ACT 5  AI LAB (0:50-1:10)
  // Navigate to a science lab
  await page.goto(`${BASE}/student/labs`, {
    waitUntil: 'networkidle'
  })
  await page.waitForTimeout(SLOW)

  // Click the first available lab
  const labLink = page.getByRole('link').first()
  if (await labLink.isVisible().catch(() => false)) {
    await labLink.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(SLOW + 500)
    // Show the interactive lab
    await smoothScroll(page, 200)
    await page.waitForTimeout(MEDIUM)
    // Interact with lab controls if visible
    const labControl = page.locator(
      'button, input[type="range"], canvas'
    ).first()
    if (await labControl.isVisible()
      .catch(() => false)) {
      await labControl.click()
      await page.waitForTimeout(MEDIUM)
    }
    await page.waitForTimeout(SLOW)
  }

  // ACT 6  TEACHER SEES THE ACTIVITY (1:10-1:30)
  await page.goto(`${BASE}/login`, {
    waitUntil: 'networkidle'
  })
  await page.waitForTimeout(MEDIUM)
  await page.fill('input[type="email"]',
    'teacher1@cha.edu.lr')
  await page.fill('input[type="password"]',
    'DemoSeed2026!')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/teacher/, {
    timeout: 15000
  })
  await page.waitForTimeout(SLOW)

  // Show teacher dashboard with alerts
  await page.waitForTimeout(MEDIUM)
  await smoothScroll(page, 200)
  await page.waitForTimeout(MEDIUM)

  // Navigate to student detail
  await page.goto(`${BASE}/teacher/students`, {
    waitUntil: 'networkidle'
  })
  await page.waitForTimeout(SLOW)

  // Click first student  now clickable link
  const studentLink = page.getByRole('link', {
    name: /Pewu|Gongloe|student/i
  }).first()
  if (await studentLink.isVisible()
    .catch(() => false)) {
    await studentLink.click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)

    // Click review on a submission
    const reviewBtn = page.getByRole('link', {
      name: /review/i
    }).first()
    if (await reviewBtn.isVisible()
      .catch(() => false)) {
      await reviewBtn.click()
      await page.waitForTimeout(SLOW)
    }
  }

  // ACT 7  MOE SEES NATIONAL DATA (1:30-1:50)
  await page.goto(`${BASE}/moe/login`, {
    waitUntil: 'networkidle'
  })
  await page.waitForTimeout(MEDIUM)
  await page.fill('input[type="email"]',
    'official1@moe.gov.lr')
  await page.fill('input[type="password"]',
    'MOESeed2026!')
  await page.click('button[type="submit"]')

  try {
    await page.waitForURL(/\/moe\/dashboard/, {
      timeout: 12000
    })
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
    console.log('MOE scene skipped')
  }

  // ACT 8  CLOSING HOMEPAGE (1:50-2:00)
  await page.goto(BASE, {
    waitUntil: 'networkidle'
  })
  await page.waitForTimeout(SLOW)
  const cta = page.getByRole('link', {
    name: /access the platform/i
  }).first()
  if (await cta.isVisible().catch(() => false)) {
    await cta.scrollIntoViewIfNeeded()
    await page.waitForTimeout(MEDIUM)
  }
  await page.waitForTimeout(SLOW + 500)

})
