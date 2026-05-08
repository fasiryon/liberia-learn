import { test } from '@playwright/test'

const BASE = 'https://liberia-learn.vercel.app'
const SLOW = 3000
const MEDIUM = 2000
const FAST = 1000

const STUDENT_EMAIL = process.env.E2E_DEMO_STUDENT_EMAIL ?? 'student1@cha.edu.lr'
const STUDENT_PASS  = process.env.E2E_DEMO_STUDENT_PASSWORD ?? 'DemoSeed2026!'
const TEACHER_EMAIL = process.env.E2E_DEMO_TEACHER_EMAIL ?? 'teacher1@cha.edu.lr'
const TEACHER_PASS  = process.env.E2E_DEMO_TEACHER_PASSWORD ?? 'DemoSeed2026!'
const MOE_EMAIL     = process.env.E2E_DEMO_MOE_EMAIL ?? 'official1@moe.gov.lr'
const MOE_PASS      = process.env.E2E_DEMO_MOE_PASSWORD ?? 'DemoSeed2026!'

async function smoothScroll(page: any, amount: number) {
  await page.evaluate((px: number) => {
    window.scrollBy({ top: px, behavior: 'smooth' })
  }, amount)
  await page.waitForTimeout(900)
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

test.setTimeout(300_000)

test('LiberiaLearn — 13-Act Platform Story (0:00-2:30)', async ({ page }) => {

  await page.setViewportSize({ width: 1280, height: 800 })
  // Maximize the window
  await page.evaluate(() => {
    window.moveTo(0, 0)
    window.resizeTo(screen.width, screen.height)
  })

  // ACT 1 (0:00-0:10): Homepage — the problem and the platform
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 1 (homepage) skipped:', (e as Error).message)
  }

  // ACT 2 (0:10-0:20): Student login
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.waitForTimeout(500)
    await page.fill('input[type="password"]', STUDENT_PASS)
    await page.waitForTimeout(600)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/student|\/dashboard/, { timeout: 30000 })
    await page.waitForTimeout(SLOW)
  } catch (e) {
    console.log('Act 2 (student login) skipped:', (e as Error).message)
  }

  // ACT 3 (0:20-0:32): Student dashboard → Today page — schedule, greeting, KPIs
  try {
    await page.goto(`${BASE}/student/today`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 200)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 200)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 3 (today page) skipped:', (e as Error).message)
  }

  // ACT 4 (0:32-0:47): Open a lesson from Today or lessons library
  let lessonOpened = false
  try {
    const openBtn  = page.getByRole('button', { name: /open/i }).first()
    const openLink = page.getByRole('link', { name: /open|start|continue/i }).first()

    if (await openBtn.isVisible().catch(() => false)) {
      await openBtn.click()
      lessonOpened = true
    } else if (await openLink.isVisible().catch(() => false)) {
      await openLink.click()
      lessonOpened = true
    }

    if (lessonOpened) {
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(MEDIUM)
    } else {
      // Fallback: go to lessons library
      await page.goto(`${BASE}/student/lessons`, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForTimeout(MEDIUM)
      const firstLesson = page.getByRole('link').filter({ hasText: /grade|math|science|english/i }).first()
      if (await firstLesson.isVisible().catch(() => false)) {
        await firstLesson.click()
        await page.waitForLoadState('domcontentloaded')
        lessonOpened = true
      }
      await page.waitForTimeout(MEDIUM)
    }
  } catch (e) {
    console.log('Act 4 (open lesson) skipped:', (e as Error).message)
  }

  // ACT 5 (0:47-1:02): Scroll lesson content — Liberian context, worked examples, slides tab
  try {
    if (lessonOpened) {
      await scrollTop(page)
      await page.waitForTimeout(FAST)
      await smoothScroll(page, 300)
      await page.waitForTimeout(SLOW)
      await smoothScroll(page, 300)
      await page.waitForTimeout(SLOW)
      await smoothScroll(page, 300)
      await page.waitForTimeout(MEDIUM)

      // Try switching to Slides tab
      const slidesTab = page.getByRole('tab', { name: /slides/i }).first()
      if (await slidesTab.isVisible().catch(() => false)) {
        await slidesTab.click()
        await page.waitForTimeout(SLOW)
      }

      await scrollTop(page)
      await page.waitForTimeout(FAST)
    } else {
      await page.goto(`${BASE}/student/lessons`, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForTimeout(MEDIUM)
      await smoothScroll(page, 400)
      await page.waitForTimeout(SLOW)
      await smoothScroll(page, 400)
      await page.waitForTimeout(SLOW)
    }
  } catch (e) {
    console.log('Act 5 (lesson content scroll) skipped:', (e as Error).message)
  }

  // ACT 6 (1:02-1:12): AI Tutor — student asks a question, sees grounded response + trust badge
  try {
    if (lessonOpened) {
      const tutorBtn = page.locator(
        'button:has-text("Ask AI"), button:has-text("Tutor"), [data-testid="ai-tutor-button"]'
      ).first()

      if (await tutorBtn.isVisible().catch(() => false)) {
        await tutorBtn.click()
        await page.waitForTimeout(MEDIUM)

        const tutorInput = page.locator('textarea, input[placeholder*="question"]').last()
        if (await tutorInput.isVisible().catch(() => false)) {
          await tutorInput.fill('Can you explain this concept in a simple way?')
          await page.waitForTimeout(FAST)
          const sendBtn = page.getByRole('button', { name: /send|ask|submit/i }).last()
          if (await sendBtn.isVisible().catch(() => false)) {
            await sendBtn.click()
            await page.waitForTimeout(SLOW + 1000)
          }
        }
      } else {
        await page.waitForTimeout(SLOW)
      }
    }
  } catch (e) {
    console.log('Act 6 (AI tutor) skipped:', (e as Error).message)
  }

  // ACT 7 (1:12-1:22): Student certificates — earned automatically, View Certificate link
  try {
    await page.goto(`${BASE}/student/certificates`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 7 (certificates) skipped:', (e as Error).message)
  }

  // ACT 8 (1:22-1:35): Teacher login → dashboard + alert bell
  await signOut(page)
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    // Click Teacher tab
    const teacherTab = page.getByRole('button', { name: /teacher/i }).first()
    if (await teacherTab.isVisible().catch(() => false)) {
      await teacherTab.click()
      await page.waitForTimeout(500)
    }
    await page.fill('input[type="email"]', TEACHER_EMAIL)
    await page.waitForTimeout(400)
    await page.fill('input[type="password"]', TEACHER_PASS)
    await page.waitForTimeout(500)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/teacher|\/dashboard/, { timeout: 30000 })
    await page.waitForTimeout(SLOW)

    await page.goto(`${BASE}/teacher/dashboard`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 8 (teacher login + dashboard) skipped:', (e as Error).message)
  }

  // ACT 9 (1:35-1:47): Teacher students list → click a student → see progress + quiz scores
  try {
    await page.goto(`${BASE}/teacher/students`, { waitUntil: 'domcontentloaded', timeout: 25000 })
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
    } else {
      // Fallback: click the first student link
      const anyStudent = page.getByRole('link').filter({ hasText: /view|profile|student/i }).first()
      if (await anyStudent.isVisible().catch(() => false)) {
        await anyStudent.click()
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(MEDIUM)
        await smoothScroll(page, 400)
        await page.waitForTimeout(SLOW)
      }
    }
  } catch (e) {
    console.log('Act 9 (teacher students) skipped:', (e as Error).message)
  }

  // ACT 10 (1:47-1:57): Teacher alerts — immediate attention panel, class intelligence
  try {
    await page.goto(`${BASE}/teacher/dashboard`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)

    // Scroll to alerts / class intelligence section
    const alertsPanel = page.locator('[data-testid="immediate-attention-panel"]').first()
    if (await alertsPanel.isVisible().catch(() => false)) {
      await alertsPanel.scrollIntoViewIfNeeded()
      await page.waitForTimeout(SLOW)
    } else {
      await smoothScroll(page, 500)
      await page.waitForTimeout(SLOW)
    }
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
  } catch (e) {
    console.log('Act 10 (teacher alerts) skipped:', (e as Error).message)
  }

  // ACT 11 (1:57-2:08): MOE login → national dashboard — KPIs, county breakdown
  await signOut(page)
  try {
    await page.goto(`${BASE}/moe/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    // MOE login has different field selectors than the main login page
    await page.fill('input[type="email"]', MOE_EMAIL)
    await page.waitForTimeout(500)
    await page.fill('input[type="password"]', MOE_PASS)
    await page.waitForTimeout(500)
    // Find submit button on MOE login specifically
    const moeSubmit = page.getByRole('button', { name: /sign in|log in|continue/i }).first()
    await moeSubmit.click()
    await page.waitForURL(/\/moe\/dashboard/, { timeout: 15000 })
    await page.waitForTimeout(SLOW)

    // Show national KPIs
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
  } catch (e) {
    console.log('Act 11 (MOE login) skipped:', (e as Error).message.substring(0, 80))
  }

  // ACT 12 (2:08-2:22): MOE — district data, curriculum intelligence, no individual PII
  try {
    // Continue scrolling from where Act 11 left off
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)

    // Try curriculum health page
    await page.goto(`${BASE}/moe/curriculum`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 12 (MOE district/curriculum) skipped:', (e as Error).message)
  }

  // ACT 13 (2:22-2:30): Homepage CTA — the close
  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    const cta = page.getByRole('link', { name: /access the platform/i }).first()
    if (await cta.isVisible().catch(() => false)) {
      await cta.scrollIntoViewIfNeeded()
      await page.waitForTimeout(MEDIUM)
    }
    await smoothScroll(page, 200)
    await page.waitForTimeout(SLOW + 500)
  } catch (e) {
    console.log('Act 13 (homepage CTA) skipped:', (e as Error).message)
  }
})
