import { test, type Page } from "@playwright/test"

const BASE = "https://liberia-learn.vercel.app"
const PASS = "DemoSeed2026!"

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Navigate and wait for the network to genuinely settle before returning.
 * networkidle (no requests for 500ms) is the structural fix for the MOE
 * dashboard bug — a fixed timeout alone scrolled past empty cards whenever
 * an API call ran long. The 2.5s settle hold covers client-side React state
 * updates that land just after networkidle fires (data arrives, then a
 * render still has to commit).
 */
async function load(page: Page, url: string, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.goto(url, { waitUntil: "load", timeout: 30000 })
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
      await page.waitForTimeout(2500)
      return
    } catch (e: unknown) {
      if (attempt === retries) throw e
      await page.waitForTimeout(2500)
    }
  }
}

async function waitFor(page: Page, selector: string, timeout = 25000) {
  await page.waitForSelector(selector, { state: "visible", timeout })
  await page.waitForTimeout(600)
}

/**
 * For dashboards whose stats render only after a client-side fetch resolves,
 * wait on the data-testid that's only present once real data is in the DOM
 * (not on the loading skeleton). Falls back to a fixed extra hold if the
 * testid never appears, so the recording still proceeds with a clear signal
 * in the console rather than silently scrolling an empty dashboard.
 */
async function waitForDashboardReady(page: Page, testid: string, timeout = 10000) {
  const ok = await page
    .waitForSelector(`[data-testid="${testid}"]`, { state: "visible", timeout })
    .then(() => true)
    .catch(() => false)
  if (!ok) {
    console.warn(`[vsl] "${testid}" did not appear within ${timeout}ms — falling back to a fixed hold`)
    await page.waitForTimeout(3000)
  }
}

async function hold(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

/**
 * Warm up the student today page by retrying until timetable articles appear.
 * The /api/student/today endpoint has an 8s shield that returns empty on cold
 * Vercel+DB start. We retry until the DB connection is warm and the cache is
 * populated, so the camera-facing navigate renders immediately.
 */
async function prewarmToday(page: Page, base: string, maxAttempts = 6) {
  for (let i = 0; i < maxAttempts; i++) {
    await page.goto(`${base}/student/today`, { waitUntil: "load", timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(10000) // 10s: enough for API call + React render
    const articles = await page.locator("article").count()
    if (articles > 0) return true
    // Shield returned empty — cache not written yet, try again
  }
  return false // fallback: proceed without articles
}

/** Injects a full-screen role overlay so the viewer knows who is signing in. */
async function showRole(page: Page, role: string, accent = "#22d3ee") {
  await page.evaluate(
    ({ r, a }) => {
      const el = document.createElement("div")
      el.id = "__vsl_role_overlay"
      el.style.cssText = [
        "position:fixed", "inset:0", "z-index:99999",
        "display:flex", "align-items:center", "justify-content:center",
        `background:rgba(4,11,24,0.88)`, "backdrop-filter:blur(6px)",
        "font-family:system-ui,sans-serif",
      ].join(";")
      el.innerHTML = `
        <div style="text-align:center;padding:44px 88px;border-radius:22px;
                    border:2px solid ${a};background:#0a1628;">
          <p style="color:#94a3b8;font-size:12px;letter-spacing:0.22em;
                    text-transform:uppercase;margin:0 0 14px">&nbsp;Signing in as&nbsp;</p>
          <p style="color:#fff;font-size:48px;font-weight:900;margin:0;
                    letter-spacing:-0.02em;line-height:1">${r}</p>
        </div>`
      document.body.appendChild(el)
    },
    { r: role, a: accent }
  )
  await hold(2800)
  await page.evaluate(() =>
    document.getElementById("__vsl_role_overlay")?.remove()
  ).catch(() => {})
  await hold(400)
}

/** Sign in via any login page — default is the regular /login. */
async function signInAs(
  page: Page,
  role: string,
  email: string,
  loginUrl = `${BASE}/login`,
  accent = "#22d3ee"
) {
  await load(page, loginUrl)
  await waitFor(page, "input[type='email']")
  await showRole(page, role, accent)
  await page.fill("input[type='email']", email)
  await page.fill("input[type='password']", PASS)
  await page.click("button[type='submit']")
  await page.waitForLoadState("load")
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2500)
}

// ─── VSL ─────────────────────────────────────────────────────────────────────

test("LiberiaLearn VSL Recording", async ({ page }) => {
  test.setTimeout(900_000)

  // ═══════════════════════════════════════════════════════════════════════════
  // 0 · HOMEPAGE
  // "LiberiaLearn — national K–12 education platform, built for Liberia."
  // ═══════════════════════════════════════════════════════════════════════════
  await load(page, BASE)
  await waitFor(page, "h1")
  await hold(8000) // "1.5m children · no textbook · built for Liberia · ready to deploy"

  await page.mouse.wheel(0, 500)
  await hold(7000) // "Every lesson. Every grade. Every subject. Delivered digitally."

  await page.mouse.wheel(0, 600)
  await hold(5000) // read role cards (Student · Teacher · Guardian · Admin · MOE)

  // Scroll back to top before starting sign-in flows
  await page.mouse.wheel(0, -9999)
  await hold(1000)

  // ═══════════════════════════════════════════════════════════════════════════
  // 1 · STUDENT  —  "This is what a Grade 7 student sees on a Thursday morning."
  // ═══════════════════════════════════════════════════════════════════════════
  await signInAs(page, "STUDENT", "student1@cha.edu.lr", `${BASE}/login`, "#22d3ee")

  // Show student landing page/dashboard — let async widgets fully populate
  await page.waitForSelector("main, h1", { timeout: 20000 })
  await page.waitForTimeout(4000)
  await hold(2500) // camera: student dashboard overview

  // Pre-warm: retry today page until the DB is warm and Redis cache is written.
  // The 8s shield returns empty on cold start; we loop until articles appear.
  const hasSchedule = await prewarmToday(page, BASE)

  // Navigate again for the camera moment — now fast from Redis cache
  await load(page, `${BASE}/student/today`)
  // data-testid="today-schedule-loaded" only renders once the tab row mounts
  // past the loading skeleton — proves real schedule data is in the DOM.
  await waitForDashboardReady(page, "today-schedule-loaded")
  await page.waitForTimeout(800)
  await hold(8000) // "Every period of the school day, fully planned. Schedule is live."

  // Scroll to show the full schedule (only if timetable articles are present)
  if (hasSchedule && (await page.locator("article").count()) > 0) {
    await page.mouse.wheel(0, 450)
    await hold(7000) // "MATH, ENGLISH, SCIENCE, CIVICS, ENGINEERING, LITERACY, CS · The lessons are ready."
  }

  // ── Open SCIENCE lesson ───────────────────────────────────────────────────
  // This must come from the real 1-8 period timetable (the actual SCIENCE
  // period — period 3 in seeded data) so the lab shown afterward is clearly
  // part of that subject's real curriculum lesson, not a separate demo card.
  // If the timetable hasn't rendered yet (cold-start), retry the same page
  // rather than falling back to a different page/lesson.
  let scienceArticle = page.locator("article").filter({ hasText: /science/i })
  for (let attempt = 0; attempt < 4 && (await scienceArticle.count()) === 0; attempt++) {
    await load(page, `${BASE}/student/today`)
    await waitForDashboardReady(page, "today-schedule-loaded")
    await page.waitForTimeout(1000)
    scienceArticle = page.locator("article").filter({ hasText: /science/i })
  }
  await scienceArticle.first().scrollIntoViewIfNeeded()
  await hold(2500) // camera pause on the SCIENCE period card
  await scienceArticle.first().getByRole("button", { name: /open/i }).click()
  await page.waitForLoadState("load")
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2000)
  await page.waitForSelector("main, h1", { timeout: 25000 })
  await hold(4500) // "structured lesson — clear objective, rich content, slides"

  // Quick slides peek — show structured content depth before pivoting to labs
  const slidesTab = page.getByRole("button", { name: /slides/i }).first()
  if (await slidesTab.isVisible({ timeout: 6000 }).catch(() => false)) {
    await slidesTab.click()
    await hold(3000) // slide 1 — "pace at their own speed"
    const nxt = page.getByRole("button", { name: /^next$/i }).first()
    if (await nxt.isEnabled().catch(() => false)) { await nxt.click(); await hold(3000) }
    const readTab = page.getByRole("button", { name: /^read$/i }).first()
    if (await readTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await readTab.click(); await hold(800)
    }
  }

  // ── Scroll to labs sidebar ────────────────────────────────────────────────
  // "Students manipulate the model — not just watch a video."
  let labsVisible = false
  for (let attempt = 0; attempt < 8; attempt++) {
    const anyLab = page.locator("button").filter({ hasText: /Open.*Lab/i }).first()
    if (await anyLab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await anyLab.scrollIntoViewIfNeeded()
      await hold(3500) // camera pause — show all 5 lab buttons; "students interact with the subject"
      labsVisible = true
      break
    }
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(700)
  }
  if (!labsVisible) {
    await page.mouse.wheel(0, -9999)
    await page.waitForTimeout(800)
    const anyLab = page.locator("button").filter({ hasText: /Open.*Lab/i }).first()
    if (await anyLab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await anyLab.scrollIntoViewIfNeeded()
      await hold(2000)
    }
  }

  // ── Cell Structure Lab (~25 s of clean interaction) ───────────────────────
  const cellBtn = page.locator("button").filter({ hasText: /Open Cell Structure Lab/i }).first()
  if (await cellBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await cellBtn.click()
    await hold(3000) // lab panel opens — "live explorable model of a cell"

    const nucleusBtn = page.getByRole("button", { name: /^Nucleus$/i }).first()
    if (await nucleusBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await nucleusBtn.scrollIntoViewIfNeeded()
      await nucleusBtn.click()
      await hold(6000) // "Click the Nucleus. An information panel appears instantly."
    }

    const plantLabel = page.locator("label").filter({ hasText: "Show plant cell features" })
    if (await plantLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
      await plantLabel.click()
      await hold(6000) // "chloroplasts and cell wall appear · students don't watch biology — they manipulate it"
    }

    const closeBtn = page.locator("header").getByRole("button", { name: /^Close$/i })
    if (await closeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await closeBtn.click(); await hold(2500)
    }
  }

  // ── Certificates ─────────────────────────────────────────────────────────
  // "Every completion is tracked. Every mastery earns a certificate."
  await load(page, `${BASE}/student/certificates`)
  await waitFor(page, "main")
  await hold(8000) // "every lesson earns a certificate · mastery tracked permanently"

  // "Parents share their child's achievements on WhatsApp."
  const waBtn = page.locator("button, a").filter({ hasText: /WhatsApp/i }).first()
  if (await waBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await waBtn.hover(); await hold(6000) // "parents share on WhatsApp · no app required"
  }

  // ── Offline pack ──────────────────────────────────────────────────────────
  // "Rural schools without connectivity? A week of lessons downloads as one zip."
  await load(page, `${BASE}/student/packs`)
  await waitFor(page, "main")
  await hold(5000) // "rural schools without internet · full week downloads as one file"
  const packBtn = page.getByRole("button", { name: /Download This Week/i })
    .or(page.getByRole("button", { name: /Download/i })).first()
  if (await packBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await packBtn.scrollIntoViewIfNeeded(); await hold(6000) // "study offline · progress syncs"
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2 · TEACHER  —  "Teachers don't just deliver lessons — they create them."
  // ═══════════════════════════════════════════════════════════════════════════
  await signInAs(page, "TEACHER", "teacher1@cha.edu.lr", `${BASE}/login`, "#facc15")

  await page.waitForSelector("h1, header, [class*='dashboard']", { timeout: 25000 })
  // data-testid="teacher-classes-loaded" only renders past the skeleton.
  await waitForDashboardReady(page, "teacher-classes-loaded")
  await page.waitForTimeout(1500)
  await hold(10000) // "who completed · who is stuck · who is at risk — before they fall behind · early warning"

  // Lesson create editor
  await load(page, `${BASE}/teacher/lessons/create`)
  await page.waitForSelector("input, main, h1", { timeout: 25000 })
  await page.waitForTimeout(3000) // let editor components mount
  await hold(10000) // "structured editor · subject targeting · reviewed by principal before student sees it"

  // ═══════════════════════════════════════════════════════════════════════════
  // 3 · SCHOOL ADMIN  —  "For administrators, enrollment is a CSV upload."
  // ═══════════════════════════════════════════════════════════════════════════
  await signInAs(page, "SCHOOL ADMIN", "admin@cha.edu.lr", `${BASE}/login`, "#818cf8")

  await load(page, `${BASE}/admin`)
  await page.waitForSelector("h1, main, header", { timeout: 25000 })
  const adminConsentBtn = page.getByRole("button", { name: /I accept the Terms and Privacy Policy/i })
  if (await adminConsentBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await adminConsentBtn.click()
    await page.waitForTimeout(1500)
  }
  // admin/page.tsx is server-rendered with stats resolved before paint, but
  // the consent-button click above can repaint — confirm the KPI cards are
  // actually in the DOM before the camera holds on them.
  await waitForDashboardReady(page, "admin-stats-loaded")
  await page.waitForTimeout(1500)
  await hold(8000) // "CSV enrollment · credentials generated automatically · school-level metrics"

  await page.mouse.wheel(0, 500)
  await hold(5000) // "attendance · lesson delivery · grade performance"

  // ═══════════════════════════════════════════════════════════════════════════
  // 4 · GUARDIAN  —  "For parents — no app required. Progress comes to them."
  // ═══════════════════════════════════════════════════════════════════════════
  await signInAs(page, "GUARDIAN", "guardian1@cha.family.lr", `${BASE}/login`, "#4ade80")

  await load(page, `${BASE}/guardian/dashboard`)
  await page.waitForSelector("h1, main, header, [class*='guardian']", { timeout: 25000 })
  await page.waitForTimeout(4500) // let async child progress, SMS digest, attendance data populate
  await hold(9000) // "no smartphone · weekly SMS digest · what studied · how performed · what next"

  await page.mouse.wheel(0, 400)
  await hold(5500) // "progress · attendance · mastery — delivered to any phone, anywhere in Liberia"

  // ═══════════════════════════════════════════════════════════════════════════
  // 5 · MOE  —  Enter via homepage → MOE portal link (as the UX requires).
  // ═══════════════════════════════════════════════════════════════════════════
  await load(page, BASE)
  await waitFor(page, "main")

  const consentBtn = page.getByRole("button", { name: /I accept the Terms and Privacy Policy/i })
  if (await consentBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await consentBtn.click()
    await page.waitForTimeout(1500)
  }

  await page.mouse.wheel(0, 2500) // scroll to MOE section
  await hold(4000) // "and at the national level"

  const moeLink = page.locator("a[href='/moe/login']").first()
  if (await moeLink.isVisible({ timeout: 8000 }).catch(() => false)) {
    await moeLink.click()
    await page.waitForLoadState("load")
    await page.waitForTimeout(1500)
  } else {
    await load(page, `${BASE}/moe/login`)
  }

  await waitFor(page, "input[type='email']", 20000)
  await showRole(page, "MINISTRY OF EDUCATION", "#22d3ee")
  await page.fill("input[type='email']", "official1@moe.gov.lr")
  await page.fill("input[type='password']", PASS)
  await page.click("button[type='submit']")
  await page.waitForLoadState("load")
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(2500)

  // MOE dashboard — top stats + National Learning Intelligence panel.
  // CRITICAL: this is the page that previously scrolled before its data
  // fetched. data-testid="moe-stats-loaded" only renders in the DOM once
  // the stats request resolves (the loading branch renders skeleton cards
  // instead) — waiting on it, not a fixed timeout, is the actual fix.
  await load(page, `${BASE}/moe/dashboard`)
  await page.waitForSelector("h1, header, [class*='dashboard']", { timeout: 25000 })
  await waitForDashboardReady(page, "moe-stats-loaded")
  await page.waitForTimeout(2500) // visual settle — let the numbers paint before scroll
  await hold(7500) // "every school in real time · real-time · real schools · real students · mastery rate right now"

  await page.mouse.wheel(0, 700)
  await page.waitForTimeout(2000) // hold after scroll so the Intelligence panel settles on screen
  await hold(6000) // National Learning Intelligence panel

  // ── MOE Live TV Mode ──────────────────────────────────────────────────────
  // "And during press conferences — a live national dashboard. Full screen."
  // /moe/live fetches its data server-side before first paint (zero-flicker
  // by design), so networkidle + settle in load() already covers it — no
  // client-loading skeleton exists here to wait on.
  await load(page, `${BASE}/moe/live`)
  await page.waitForSelector("div[class*='inset-0'], section, h1, div", { timeout: 20000 })
  await page.waitForTimeout(2500)
  await hold(9500) // "press conferences · full-screen · 15 counties · active students · live"

  // ── Return to homepage — end the recording where we started ──────────────
  await load(page, BASE)
  await waitFor(page, "main")
  const finalConsentBtn = page.getByRole("button", { name: /I accept the Terms and Privacy Policy/i })
  if (await finalConsentBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await finalConsentBtn.click()
    await page.waitForTimeout(1000)
  }
  await hold(8000) // "LiberiaLearn. One platform. Every child in Liberia. This exists. Today. Built for Liberia."
})
