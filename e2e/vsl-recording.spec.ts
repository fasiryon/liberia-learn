import { test } from '@playwright/test'

const BASE = 'https://liberia-learn.vercel.app'
const SLOW = 3000
const MEDIUM = 2000
const FAST = 1000

const STUDENT_EMAIL = process.env.E2E_DEMO_STUDENT_EMAIL ?? 'student1@cha.edu.lr'
const STUDENT_PASS  = process.env.E2E_DEMO_STUDENT_PASSWORD ?? 'DemoSeed2026!'
const TEACHER_EMAIL = process.env.E2E_DEMO_TEACHER_EMAIL ?? 'teacher1@cha.edu.lr'
const TEACHER_PASS  = process.env.E2E_DEMO_TEACHER_PASSWORD ?? 'DemoSeed2026!'
const ADMIN_EMAIL   = process.env.E2E_DEMO_ADMIN_EMAIL ?? 'admin@cha.edu.lr'
const ADMIN_PASS    = process.env.E2E_DEMO_ADMIN_PASSWORD ?? 'DemoSeed2026!'
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

test('LiberiaLearn — 14-Act Platform Story (0:00-2:45)', async ({ page }) => {

  await page.setViewportSize({ width: 1280, height: 800 })

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

  // ACT 2 (0:10-0:20): Student login → navigates to /student or /dashboard
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

  // ACT 3 (0:20-0:32): Student Today page — schedule, greeting, KPIs
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

  // ACT 4 (0:32-0:50): Open a Science lesson that has a visible lab button
  let lessonOpened = false
  let labVisible = false
  try {
    // First try Today page for a Science period
    await page.goto(`${BASE}/student/today`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(SLOW)

    const scienceOpen = page.locator('text=SCIENCE').first()
    if (await scienceOpen.isVisible().catch(() => false)) {
      const scienceRow = scienceOpen.locator('../..')
      const openBtn = scienceRow.getByRole('button', { name: /open/i }).first()
      if (await openBtn.isVisible().catch(() => false)) {
        await openBtn.click()
        await page.waitForURL(/\/lesson\//, { timeout: 10000 })
        await page.waitForTimeout(SLOW)
        lessonOpened = true
      }
    }

    if (!lessonOpened) {
      // Navigate directly to lessons library and filter by SCIENCE
      await page.goto(`${BASE}/student/lessons`, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForTimeout(MEDIUM)

      // Try subject filter for science
      const scienceFilter = page.locator('select, [data-testid="subject-filter"]').first()
      if (await scienceFilter.isVisible().catch(() => false)) {
        await scienceFilter.selectOption({ label: 'SCIENCE' }).catch(async () => {
          await scienceFilter.selectOption({ label: 'Science' }).catch(() => {})
        })
        await page.waitForTimeout(MEDIUM)
      }

      // Find first Grade 7 Science lesson
      const scienceLink = page.getByRole('link').filter({ hasText: /science|grade 7|g7/i }).first()
      if (await scienceLink.isVisible().catch(() => false)) {
        await scienceLink.click()
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(SLOW)
        lessonOpened = true
      } else {
        // Fallback: open any available lesson
        const anyLesson = page.getByRole('link').filter({ hasText: /open|start|view|lesson/i }).first()
        if (await anyLesson.isVisible().catch(() => false)) {
          await anyLesson.click()
          await page.waitForLoadState('domcontentloaded')
          await page.waitForTimeout(SLOW)
          lessonOpened = true
        }
      }
    }

    // Verify lab button is visible
    if (lessonOpened) {
      const labButton = page.locator(
        'button:has-text("Open Lab"), button:has-text("Lab"), a:has-text("Open Lab"), [data-testid*="lab"]'
      ).first()
      if (await labButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        labVisible = true
        await labButton.scrollIntoViewIfNeeded()
        await page.waitForTimeout(MEDIUM)
        // Click the lab and record it loading
        await labButton.click()
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(SLOW + 1000)
        await smoothScroll(page, 200)
        await page.waitForTimeout(MEDIUM)
        console.log('Act 4: Lab button was visible and clicked')
      } else {
        console.log('Act 4: Lesson opened but no lab button found')
      }
    }
  } catch (e) {
    console.log('Act 4 (open science lesson + lab) skipped:', (e as Error).message)
  }

  // ACT 5 (0:50-1:02): Certificates page — pending cards visible
  try {
    await page.goto(`${BASE}/student/certificates`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
    console.log(`Act 5: Certificates page loaded (labVisible=${labVisible})`)
  } catch (e) {
    console.log('Act 5 (certificates) skipped:', (e as Error).message)
  }

  // ACT 6 (1:02-1:15): Scroll lesson content — Liberian context, worked examples, slides tab
  try {
    if (lessonOpened) {
      // Navigate back to a lesson for content scrolling
      await page.goto(`${BASE}/student/lessons`, { waitUntil: 'domcontentloaded', timeout: 25000 })
      await page.waitForTimeout(MEDIUM)
      const firstLesson = page.getByRole('link').filter({ hasText: /open|start|view|lesson|grade/i }).first()
      if (await firstLesson.isVisible().catch(() => false)) {
        await firstLesson.click()
        await page.waitForLoadState('domcontentloaded')
        await page.waitForTimeout(SLOW)
      }
    }
    await scrollTop(page)
    await page.waitForTimeout(FAST)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)

    // Try switching to Slides tab
    const slidesTab = page.getByRole('tab', { name: /slides/i }).first()
    if (await slidesTab.isVisible().catch(() => false)) {
      await slidesTab.click()
      await page.waitForTimeout(SLOW)
    }
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 6 (lesson content scroll) skipped:', (e as Error).message)
  }

  // ACT 7 (1:15-1:25): AI Tutor — student asks a question, sees grounded response + trust badge
  try {
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
  } catch (e) {
    console.log('Act 7 (AI tutor) skipped:', (e as Error).message)
  }

  // ACT 8 (1:25-1:38): Teacher login → teacher dashboard + alert bell
  await signOut(page)
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
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

  // ACT 9 (1:38-1:50): Teacher students list → student profile → progress + quiz scores
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

  // ACT 10 (1:50-2:00): Teacher alerts — immediate attention panel, class intelligence
  try {
    await page.goto(`${BASE}/teacher/dashboard`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
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

  // ACT 11 (2:00-2:10): Admin login → admin dashboard — curriculum + school management
  await signOut(page)
  try {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.waitForTimeout(400)
    await page.fill('input[type="password"]', ADMIN_PASS)
    await page.waitForTimeout(500)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/admin|\/dashboard/, { timeout: 30000 })
    await page.waitForTimeout(SLOW)
    // Navigate to admin dashboard
    await page.goto(`${BASE}/admin`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 11 (admin login + dashboard) skipped:', (e as Error).message)
  }

  // ACT 12 (2:10-2:22): MOE login → national dashboard — KPIs, county breakdown
  await signOut(page)
  try {
    await page.goto(`${BASE}/moe/login`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    await page.fill('input[type="email"]', MOE_EMAIL)
    await page.waitForTimeout(500)
    await page.fill('input[type="password"]', MOE_PASS)
    await page.waitForTimeout(500)
    const moeSubmit = page.getByRole('button', { name: /sign in|log in|continue/i }).first()
    await moeSubmit.click()
    await page.waitForURL(/\/moe\/dashboard/, { timeout: 15000 })
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
  } catch (e) {
    console.log('Act 12 (MOE login) skipped:', (e as Error).message.substring(0, 80))
  }

  // ACT 13 (2:22-2:35): MOE — district data, curriculum intelligence, no individual PII
  try {
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
    await page.goto(`${BASE}/moe/curriculum`, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 13 (MOE district/curriculum) skipped:', (e as Error).message)
  }

  // ACT 14 (2:35-2:45): Homepage CTA — the close
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
    console.log('Act 14 (homepage CTA) skipped:', (e as Error).message)
  }
})
