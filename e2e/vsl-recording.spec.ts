import { test } from '@playwright/test'

const BASE       = 'https://liberia-learn.vercel.app'
const SLOW       = 3000
const VERY_SLOW  = 4000
const MEDIUM     = 2000
const FAST       = 1000

const STUDENT_EMAIL   = process.env.E2E_DEMO_STUDENT_EMAIL      ?? 'student1@cha.edu.lr'
const STUDENT_PASS    = process.env.E2E_DEMO_STUDENT_PASSWORD   ?? 'DemoSeed2026!'
const TEACHER_EMAIL   = process.env.E2E_DEMO_TEACHER_EMAIL      ?? 'teacher1@cha.edu.lr'
const TEACHER_PASS    = process.env.E2E_DEMO_TEACHER_PASSWORD   ?? 'DemoSeed2026!'
const ADMIN_EMAIL     = process.env.E2E_DEMO_ADMIN_EMAIL        ?? 'admin@cha.edu.lr'
const ADMIN_PASS      = process.env.E2E_DEMO_ADMIN_PASSWORD     ?? 'DemoSeed2026!'
const MOE_EMAIL       = process.env.E2E_DEMO_MOE_EMAIL          ?? 'official1@moe.gov.lr'
const MOE_PASS        = process.env.E2E_DEMO_MOE_PASSWORD       ?? 'DemoSeed2026!'
const GUARDIAN_EMAIL  = process.env.E2E_DEMO_GUARDIAN_EMAIL     ?? 'guardian1@cha.family.lr'
const GUARDIAN_PASS   = process.env.E2E_DEMO_GUARDIAN_PASSWORD  ?? 'DemoSeed2026!'

async function nav(page: any, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(1500)
}

async function smoothScroll(page: any, amount: number) {
  await page.evaluate((px: number) => {
    window.scrollBy({ top: px, behavior: 'smooth' })
  }, amount)
  await page.waitForTimeout(1500)
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

test.setTimeout(600_000)

test('LiberiaLearn — 22-Act Platform Story', async ({ page }) => {

  await page.setViewportSize({ width: 1280, height: 800 })

  // ACT 1: Homepage — the problem and the platform
  try {
    await nav(page, BASE)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 1 (homepage) skipped:', (e as Error).message)
  }

  // ACT 2: Student login → navigates to /student or /dashboard
  try {
    await nav(page, `${BASE}/login`)
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.waitForTimeout(500)
    await page.fill('input[type="password"]', STUDENT_PASS)
    await page.waitForTimeout(600)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/student|\/dashboard/, { timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(VERY_SLOW)
  } catch (e) {
    console.log('Act 2 (student login) skipped:', (e as Error).message)
  }

  // ACT 3: Student Today page — schedule, greeting, KPIs
  try {
    await nav(page, `${BASE}/student/today`)
    await page.waitForTimeout(VERY_SLOW)
    await smoothScroll(page, 200)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 200)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 3 (today page) skipped:', (e as Error).message)
  }

  // ACT 4: Open a Science lesson that has a visible lab button
  let lessonOpened = false
  let labVisible = false
  try {
    await nav(page, `${BASE}/student/today`)
    await page.waitForTimeout(VERY_SLOW)

    const scienceOpen = page.locator('text=SCIENCE').first()
    if (await scienceOpen.isVisible().catch(() => false)) {
      const scienceRow = scienceOpen.locator('../..')
      const openBtn = scienceRow.getByRole('button', { name: /open/i }).first()
      if (await openBtn.isVisible().catch(() => false)) {
        await openBtn.click()
        await page.waitForURL(/\/lesson\//, { timeout: 10000 })
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(SLOW)
        lessonOpened = true
      }
    }

    if (!lessonOpened) {
      await nav(page, `${BASE}/student/lessons`)
      await page.waitForTimeout(MEDIUM)

      const scienceFilter = page.locator('select, [data-testid="subject-filter"]').first()
      if (await scienceFilter.isVisible().catch(() => false)) {
        await scienceFilter.selectOption({ label: 'SCIENCE' }).catch(async () => {
          await scienceFilter.selectOption({ label: 'Science' }).catch(() => {})
        })
        await page.waitForTimeout(MEDIUM)
      }

      const scienceLink = page.getByRole('link').filter({ hasText: /science|grade 7|g7/i }).first()
      if (await scienceLink.isVisible().catch(() => false)) {
        await scienceLink.click()
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(SLOW)
        lessonOpened = true
      } else {
        const anyLesson = page.getByRole('link').filter({ hasText: /open|start|view|lesson/i }).first()
        if (await anyLesson.isVisible().catch(() => false)) {
          await anyLesson.click()
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
          await page.waitForTimeout(SLOW)
          lessonOpened = true
        }
      }
    }

    if (lessonOpened) {
      const labButton = page.locator(
        'button:has-text("Open Lab"), button:has-text("Lab"), a:has-text("Open Lab"), [data-testid*="lab"]'
      ).first()
      if (await labButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        labVisible = true
        await labButton.scrollIntoViewIfNeeded()
        await page.waitForTimeout(MEDIUM)
        await labButton.click()
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
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

  // ACT 5: Certificates page — pending cards visible
  try {
    await nav(page, `${BASE}/student/certificates`)
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

  // ACT 6: Scroll lesson content — Liberian context, worked examples, slides tab
  try {
    if (lessonOpened) {
      await nav(page, `${BASE}/student/lessons`)
      await page.waitForTimeout(MEDIUM)
      const firstLesson = page.getByRole('link').filter({ hasText: /open|start|view|lesson|grade/i }).first()
      if (await firstLesson.isVisible().catch(() => false)) {
        await firstLesson.click()
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(SLOW)
      }
    }
    await scrollTop(page)
    await page.waitForTimeout(FAST)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)

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

  // ACT 7: AI Tutor — student asks a question, sees grounded response + trust badge
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

  // ACT 8: Teacher login → teacher dashboard + alert bell
  await signOut(page)
  try {
    await nav(page, `${BASE}/login`)
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
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(VERY_SLOW)
    await nav(page, `${BASE}/teacher/dashboard`)
    await page.waitForTimeout(VERY_SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 8 (teacher login + dashboard) skipped:', (e as Error).message)
  }

  // ACT 9: Teacher students list → student profile → progress + quiz scores
  try {
    await nav(page, `${BASE}/teacher/students`)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 200)
    await page.waitForTimeout(MEDIUM)
    const studentLink = page.getByRole('link', { name: /Pewu|Gongloe|student/i }).first()
    if (await studentLink.isVisible().catch(() => false)) {
      await studentLink.click()
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(MEDIUM)
      await smoothScroll(page, 300)
      await page.waitForTimeout(SLOW)
      await smoothScroll(page, 300)
      await page.waitForTimeout(MEDIUM)
    } else {
      const anyStudent = page.getByRole('link').filter({ hasText: /view|profile|student/i }).first()
      if (await anyStudent.isVisible().catch(() => false)) {
        await anyStudent.click()
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
        await page.waitForTimeout(MEDIUM)
        await smoothScroll(page, 400)
        await page.waitForTimeout(SLOW)
      }
    }
  } catch (e) {
    console.log('Act 9 (teacher students) skipped:', (e as Error).message)
  }

  // ACT 10: Teacher alerts — immediate attention panel, class intelligence
  try {
    await nav(page, `${BASE}/teacher/dashboard`)
    await page.waitForTimeout(VERY_SLOW)
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

  // ACT 11: Admin login → admin dashboard — curriculum + school management
  await signOut(page)
  try {
    await nav(page, `${BASE}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.waitForTimeout(400)
    await page.fill('input[type="password"]', ADMIN_PASS)
    await page.waitForTimeout(500)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/admin|\/dashboard/, { timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(VERY_SLOW)
    await nav(page, `${BASE}/admin`)
    await page.waitForTimeout(VERY_SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 11 (admin login + dashboard) skipped:', (e as Error).message)
  }

  // ACT 12: MOE login → national dashboard — KPIs, county breakdown
  await signOut(page)
  try {
    await nav(page, `${BASE}/moe/login`)
    await page.fill('input[type="email"]', MOE_EMAIL)
    await page.waitForTimeout(500)
    await page.fill('input[type="password"]', MOE_PASS)
    await page.waitForTimeout(500)
    const moeSubmit = page.getByRole('button', { name: /sign in|log in|continue/i }).first()
    await moeSubmit.click()
    await page.waitForURL(/\/moe\/dashboard/, { timeout: 15000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(VERY_SLOW)
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
  } catch (e) {
    console.log('Act 12 (MOE login) skipped:', (e as Error).message.substring(0, 80))
  }

  // ACT 13: MOE — district data, curriculum intelligence, no individual PII
  try {
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
    await nav(page, `${BASE}/moe/curriculum`)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 13 (MOE district/curriculum) skipped:', (e as Error).message)
  }

  // ACT 14: Homepage CTA — the close
  try {
    await nav(page, BASE)
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

  // ACT 15: Discussion Board — class threads, collaborative learning
  await signOut(page)
  try {
    await nav(page, `${BASE}/login`)
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.waitForTimeout(500)
    await page.fill('input[type="password"]', STUDENT_PASS)
    await page.waitForTimeout(600)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/student|\/dashboard/, { timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(VERY_SLOW)
    await nav(page, `${BASE}/student/discussion`)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 200)
    await page.waitForTimeout(SLOW)
    const boardLink = page.getByRole('link').filter({ hasText: /class|board|discussion/i }).first()
    if (await boardLink.isVisible().catch(() => false)) {
      await boardLink.click()
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(MEDIUM)
      await smoothScroll(page, 300)
      await page.waitForTimeout(SLOW)
      await smoothScroll(page, 300)
      await page.waitForTimeout(MEDIUM)
    }
  } catch (e) {
    console.log('Act 15 (discussion board) skipped:', (e as Error).message)
  }

  // ACT 16: School Calendar — monthly view and upcoming events
  try {
    await nav(page, `${BASE}/student/events`)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 16 (school calendar) skipped:', (e as Error).message)
  }

  // ACT 17: Student Portfolio — stats grid, badges, certificates
  try {
    await nav(page, `${BASE}/student/portfolio`)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 250)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 250)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 250)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 17 (student portfolio) skipped:', (e as Error).message)
  }

  // ACT 18: Live Session (teacher side) — schedule view + Start Live Session hover
  await signOut(page)
  try {
    await nav(page, `${BASE}/login`)
    const teacherTab2 = page.getByRole('button', { name: /teacher/i }).first()
    if (await teacherTab2.isVisible().catch(() => false)) {
      await teacherTab2.click()
      await page.waitForTimeout(500)
    }
    await page.fill('input[type="email"]', TEACHER_EMAIL)
    await page.waitForTimeout(400)
    await page.fill('input[type="password"]', TEACHER_PASS)
    await page.waitForTimeout(500)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/teacher|\/dashboard/, { timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(VERY_SLOW)
    await nav(page, `${BASE}/teacher/schedule`)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    const startLiveBtn = page.getByRole('button', { name: /start live session/i }).first()
    if (await startLiveBtn.isVisible().catch(() => false)) {
      await startLiveBtn.hover()
      await page.waitForTimeout(SLOW)
    } else {
      await smoothScroll(page, 300)
      await page.waitForTimeout(SLOW)
    }
  } catch (e) {
    console.log('Act 18 (live session teacher) skipped:', (e as Error).message)
  }

  // ACT 19: Report Card — student views and previews print layout
  await signOut(page)
  try {
    await nav(page, `${BASE}/login`)
    await page.fill('input[type="email"]', STUDENT_EMAIL)
    await page.waitForTimeout(500)
    await page.fill('input[type="password"]', STUDENT_PASS)
    await page.waitForTimeout(600)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/student|\/dashboard/, { timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(VERY_SLOW)
    await nav(page, `${BASE}/student/report-cards`)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    const printBtn = page.getByRole('button', { name: /print|download/i }).first()
    if (await printBtn.isVisible().catch(() => false)) {
      await printBtn.scrollIntoViewIfNeeded()
      await page.waitForTimeout(SLOW)
    }
  } catch (e) {
    console.log('Act 19 (report card) skipped:', (e as Error).message)
  }

  // ACT 20: Guardian Dashboard — attendance rate, grades, upcoming events, messages
  await signOut(page)
  try {
    await nav(page, `${BASE}/login`)
    await page.fill('input[type="email"]', GUARDIAN_EMAIL)
    await page.waitForTimeout(500)
    await page.fill('input[type="password"]', GUARDIAN_PASS)
    await page.waitForTimeout(600)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/guardian|\/dashboard/, { timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(VERY_SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 300)
    await page.waitForTimeout(MEDIUM)
    await scrollTop(page)
    await page.waitForTimeout(FAST)
  } catch (e) {
    console.log('Act 20 (guardian dashboard) skipped:', (e as Error).message)
  }

  // ACT 21: Admin Documents — Canva Connected banner, ID Cards tab, Certificates tab
  await signOut(page)
  try {
    await nav(page, `${BASE}/login`)
    await page.fill('input[type="email"]', ADMIN_EMAIL)
    await page.waitForTimeout(400)
    await page.fill('input[type="password"]', ADMIN_PASS)
    await page.waitForTimeout(500)
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/admin|\/dashboard/, { timeout: 30000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(VERY_SLOW)
    await nav(page, `${BASE}/admin/documents`)
    await page.waitForTimeout(MEDIUM)
    await smoothScroll(page, 200)
    await page.waitForTimeout(SLOW)
    const idCardsTab = page.getByRole('tab', { name: /id cards/i }).first()
    if (await idCardsTab.isVisible().catch(() => false)) {
      await idCardsTab.click()
      await page.waitForTimeout(SLOW)
      await smoothScroll(page, 300)
      await page.waitForTimeout(MEDIUM)
    }
    const certsTab = page.getByRole('tab', { name: /certificates/i }).first()
    if (await certsTab.isVisible().catch(() => false)) {
      await certsTab.click()
      await page.waitForTimeout(SLOW)
      await smoothScroll(page, 300)
      await page.waitForTimeout(MEDIUM)
    }
  } catch (e) {
    console.log('Act 21 (admin documents) skipped:', (e as Error).message)
  }

  // ACT 22: MOE Dashboard — national stats + School Submissions tab
  await signOut(page)
  try {
    await nav(page, `${BASE}/moe/login`)
    await page.fill('input[type="email"]', MOE_EMAIL)
    await page.waitForTimeout(500)
    await page.fill('input[type="password"]', MOE_PASS)
    await page.waitForTimeout(500)
    const moeSubmit2 = page.getByRole('button', { name: /sign in|log in|continue/i }).first()
    await moeSubmit2.click()
    await page.waitForURL(/\/moe\/dashboard/, { timeout: 15000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await page.waitForTimeout(VERY_SLOW)
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
    await smoothScroll(page, 350)
    await page.waitForTimeout(SLOW)
    const submissionsTab = page.getByRole('tab', { name: /submissions/i }).first()
    if (await submissionsTab.isVisible().catch(() => false)) {
      await submissionsTab.click()
      await page.waitForTimeout(SLOW)
      await smoothScroll(page, 300)
      await page.waitForTimeout(MEDIUM)
    } else {
      await smoothScroll(page, 350)
      await page.waitForTimeout(SLOW)
    }
  } catch (e) {
    console.log('Act 22 (MOE dashboard) skipped:', (e as Error).message.substring(0, 80))
  }
})
