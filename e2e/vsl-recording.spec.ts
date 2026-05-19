import { test, expect, Page } from "@playwright/test"

// ─── helpers ────────────────────────────────────────────────────────────────

async function load(page: Page, url: string) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
  await page.waitForTimeout(1200)
}

async function waitFor(page: Page, selector: string, timeout = 25000) {
  await page.waitForSelector(selector, { state: "visible", timeout })
  await page.waitForTimeout(600)
}

async function hold(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function signIn(page: Page, email: string, password = "DemoSeed2026!") {
  await load(page, "https://liberia-learn.vercel.app/login")
  await waitFor(page, "input[type='email']")
  await page.fill("input[type='email']", email)
  await page.fill("input[type='password']", password)
  await page.click("button[type='submit']")
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(2000)
}

// ─── VSL ────────────────────────────────────────────────────────────────────

test("LiberiaLearn VSL Recording", async ({ page }) => {
  test.setTimeout(900_000)

  // ── ACT 1: Landing page ───────────────────────────────────────────────────
  // "Imagine a classroom in Monrovia..."
  await load(page, "https://liberia-learn.vercel.app")
  await waitFor(page, "main")
  await hold(6000)

  // ── ACT 2: Login page ─────────────────────────────────────────────────────
  // "Now imagine something different."
  await load(page, "https://liberia-learn.vercel.app/login")
  await waitFor(page, "input[type='email']")
  await hold(3000)

  // ── ACT 3: Student — Today page ───────────────────────────────────────────
  // "For students, learning starts the moment you open the app."
  await signIn(page, "student1@cha.edu.lr")
  await waitFor(page, "main")
  await hold(5000)

  // ── ACT 4: Open a lesson ──────────────────────────────────────────────────
  // "Your Today page shows exactly what lesson comes next..."
  const firstLesson = page.locator("a[href*='/student/lessons/']").first()
  await firstLesson.waitFor({ state: "visible", timeout: 20000 })
  await hold(2000)
  await firstLesson.click()
  await page.waitForLoadState("networkidle")
  await waitFor(page, ".prose, article, [class*='lesson']")
  await hold(6000)

  // ── ACT 5: Audio player ───────────────────────────────────────────────────
  // "...narrated in clear, natural audio so you can listen while you read."
  const audioPlayer = page
    .locator("audio, [data-testid='audio-player'], button[aria-label*='play' i]")
    .first()
  const audioVisible = await audioPlayer
    .isVisible({ timeout: 5000 })
    .catch(() => false)
  if (audioVisible) await hold(3000)
  await hold(3000)

  // ── ACT 6: Assignment / quiz ──────────────────────────────────────────────
  // "When you finish, take a quiz."
  await load(page, "https://liberia-learn.vercel.app/student/today")
  await waitFor(page, "main")
  const assignmentLink = page
    .locator("a[href*='/student/assignments/'], a[href*='/homework/']")
    .first()
  const assignmentVisible = await assignmentLink
    .isVisible({ timeout: 8000 })
    .catch(() => false)
  if (assignmentVisible) {
    await assignmentLink.click()
    await page.waitForLoadState("networkidle")
    await waitFor(page, "main")
    await hold(4500)
  }

  // ── ACT 7: AI Tutor ───────────────────────────────────────────────────────
  // "Struggling with a concept? The AI Tutor is available anytime."
  await load(page, "https://liberia-learn.vercel.app/student/today")
  await waitFor(page, "main")
  await hold(1500)
  const tutorBtn = page
    .locator(
      "button[aria-label*='tutor' i], [data-tour='ai-tutor'], " +
      "button:has-text('Tutor'), button:has-text('Ask')"
    )
    .first()
  const tutorVisible = await tutorBtn
    .isVisible({ timeout: 8000 })
    .catch(() => false)
  if (tutorVisible) {
    await tutorBtn.click()
    await page.waitForTimeout(1500)
    await waitFor(page, "[role='dialog'], [class*='chat'], [class*='tutor']")
    await hold(5000)
    const closeBtn = page
      .locator("button[aria-label='Close'], button:has-text('×'), button[aria-label*='close' i]")
      .first()
    const closeVisible = await closeBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false)
    if (closeVisible) {
      await closeBtn.click()
      await page.waitForTimeout(800)
    }
  }

  // ── ACT 8: Student portfolio ──────────────────────────────────────────────
  // "As you learn, you earn. Certificates, badges, verifiable portfolio."
  await load(page, "https://liberia-learn.vercel.app/student/portfolio")
  await waitFor(page, "main")
  await hold(5000)

  // ── ACT 9: National leaderboard (public) ──────────────────────────────────
  // "A place on the National Leaderboard — ranked by county."
  await load(page, "https://liberia-learn.vercel.app/league")
  await waitFor(page, "main, table, [class*='league']")
  await hold(5000)

  // ── ACT 10: Transition to teacher ─────────────────────────────────────────
  await load(page, "https://liberia-learn.vercel.app/login")
  await waitFor(page, "input[type='email']")
  await hold(1500)

  // ── ACT 11: Teacher dashboard ─────────────────────────────────────────────
  // "For teachers, LiberiaLearn puts the entire class in your hand."
  await signIn(page, "teacher1@cha.edu.lr")
  await waitFor(page, "main")
  await hold(6000)

  // ── ACT 12: Gradebook ─────────────────────────────────────────────────────
  // "Your dashboard shows you who is at risk before they fall behind."
  const gradebookLink = page
    .locator(
      "a[href*='/teacher/gradebook'], a[href*='/gradebook'], " +
      "[data-tour='gradebook']"
    )
    .first()
  const gradebookVisible = await gradebookLink
    .isVisible({ timeout: 8000 })
    .catch(() => false)
  if (gradebookVisible) {
    await gradebookLink.click()
    await page.waitForLoadState("networkidle")
    await waitFor(page, "main")
    await hold(5000)
  }

  // ── ACT 13: Lesson editor ─────────────────────────────────────────────────
  // "The AI curriculum engine drafts full lesson plans in seconds."
  await load(page, "https://liberia-learn.vercel.app/teacher/lessons/create")
  await waitFor(page, "main")
  await hold(5000)

  // ── ACT 14: Alert preferences ─────────────────────────────────────────────
  // "The platform surfaces that intelligence automatically."
  await load(page, "https://liberia-learn.vercel.app/teacher/settings/alerts")
  await waitFor(page, "main")
  await hold(4000)

  // ── ACT 15: SMS assignment send ───────────────────────────────────────────
  // "Your results go directly to your guardian by SMS — no smartphone required."
  const assignmentsNav = page
    .locator("a[href*='/teacher/assignments'], [data-tour='assignments']")
    .first()
  const assignmentsVisible = await assignmentsNav
    .isVisible({ timeout: 8000 })
    .catch(() => false)
  if (assignmentsVisible) {
    await assignmentsNav.click()
    await page.waitForLoadState("networkidle")
    await waitFor(page, "main")
    await hold(5000)
  }

  // ── ACT 16: Transition to admin ───────────────────────────────────────────
  await load(page, "https://liberia-learn.vercel.app/login")
  await waitFor(page, "input[type='email']")
  await hold(1500)

  // ── ACT 17: Admin dashboard ───────────────────────────────────────────────
  // "For school administrators, enrollment is a CSV upload."
  await signIn(page, "admin@cha.edu.lr")
  await waitFor(page, "main")
  await hold(6000)

  // ── ACT 18: Admin credentials page ───────────────────────────────────────
  // "Credentials printed on secure student ID cards."
  await load(page, "https://liberia-learn.vercel.app/admin/credentials")
  await waitFor(page, "main")
  await hold(4500)

  // ── ACT 19: Transition to MOE portal ──────────────────────────────────────
  await load(page, "https://liberia-learn.vercel.app/login")
  await waitFor(page, "input[type='email']")
  await hold(1500)

  // ── ACT 20: MOE national dashboard ───────────────────────────────────────
  // "For the Ministry of Education, a national oversight portal..."
  await signIn(page, "official1@moe.gov.lr")
  await waitFor(page, "main")
  await hold(7000)

  // ── ACT 21: Public credential verify ─────────────────────────────────────
  // "...backed by a QR code that proves every grade is real."
  await load(
    page,
    "https://liberia-learn.vercel.app/credential/demo-verify-token"
  )
  await waitFor(page, "main")
  await hold(5000)

  // ── ACT 22: Offline mode ──────────────────────────────────────────────────
  // "The app works without internet."
  await load(page, "https://liberia-learn.vercel.app/student/today")
  await waitFor(page, "main")
  await hold(1500)
  await page.context().setOffline(true)
  await page.waitForTimeout(2000)
  await hold(4000)
  await page.context().setOffline(false)
  await page.waitForTimeout(1500)

  // ── ACT 23: Final — landing page ─────────────────────────────────────────
  // "Welcome to LiberiaLearn. Built for Liberia. Built to last."
  await load(page, "https://liberia-learn.vercel.app")
  await waitFor(page, "main")
  await hold(8000)
})
