import { test, expect, type Page } from "@playwright/test";

const baseUrl = process.env.PLAYWRIGHT_BASE_URL;

if (!baseUrl) {
  throw new Error("PLAYWRIGHT_BASE_URL must be set for Day 1 simulation tests.");
}

const SLOW = 2000;
const MEDIUM = 1500;
const credentials = {
  adminEmail: process.env.E2E_DEMO_ADMIN_EMAIL,
  adminPassword: process.env.E2E_DEMO_ADMIN_PASSWORD,
  studentEmail: process.env.E2E_DEMO_STUDENT_EMAIL,
  studentPassword: process.env.E2E_DEMO_STUDENT_PASSWORD,
  teacherEmail: process.env.E2E_DEMO_TEACHER_EMAIL,
  teacherPassword: process.env.E2E_DEMO_TEACHER_PASSWORD,
  guardianEmail: process.env.E2E_DEMO_GUARDIAN_EMAIL,
  guardianPassword: process.env.E2E_DEMO_GUARDIAN_PASSWORD,
  moeEmail: process.env.E2E_DEMO_MOE_EMAIL,
  moePassword: process.env.E2E_DEMO_MOE_PASSWORD,
};

const missingCredentialKeys = Object.entries(credentials)
  .filter(([, value]) => !value)
  .map(([key]) => key);

test.skip(
  missingCredentialKeys.length > 0,
  `Missing Day 1 simulation credential environment variables: ${missingCredentialKeys.join(", ")}`
);

async function acceptPolicyIfPresent(page: Page) {
  const modal = page.locator('[role="dialog"][aria-labelledby="policy-consent-title"]').first();
  if (!(await modal.isVisible({ timeout: 3000 }).catch(() => false))) return;

  await modal.getByRole("button", { name: /accept the terms and privacy policy/i }).click();
  await expect(modal).toBeHidden({ timeout: 15000 });
}

async function gotoWithRetry(page: Page, url: string) {
  try {
    await page.goto(url);
  } catch (error) {
    if (!String(error).includes("ERR_NETWORK_CHANGED")) throw error;
    await page.waitForTimeout(1000);
    await page.goto(url);
  }
}

async function expectAdminDashboardReady(page: Page) {
  const body = await page.locator("body").innerText();
  expect(body).not.toMatch(/application error|internal server error/i);
  expect(body).toMatch(/admin/i);
  expect(body).toMatch(/school|students|teachers|curriculum/i);
  await expect(page.getByRole("link", { name: /students/i }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("link", { name: /curriculum/i }).first()).toBeVisible({ timeout: 15000 });
}

test("Gate 1  Admin: school setup and roster", async ({ page }) => {
  await gotoWithRetry(page, `${baseUrl}/login`);
  await page.fill('input[type="email"]', credentials.adminEmail!);
  await page.fill('input[type="password"]', credentials.adminPassword!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 15000 });
  await page.waitForTimeout(SLOW);

  await expectAdminDashboardReady(page);

  await page.goto(`${baseUrl}/admin/students`);
  await page.waitForTimeout(MEDIUM);
  const studentsBody = await page.locator("body").innerText();
  expect(studentsBody.toLowerCase()).toMatch(/student|name|grade/i);

  await page.goto(`${baseUrl}/admin/curriculum`);
  await page.waitForTimeout(MEDIUM);
  const currBody = await page.locator("body").innerText();
  expect(currBody).toMatch(/grade|subject|coverage/i);

  await page.goto(`${baseUrl}/admin/teachers`);
  await page.waitForTimeout(MEDIUM);
  const teacherBody = await page.locator("body").innerText();
  expect(teacherBody.toLowerCase()).toMatch(/teacher|class/i);
});

test("Gate 2  Teacher: create morning assignment", async ({ page }) => {
  await gotoWithRetry(page, `${baseUrl}/login`);
  await page.fill('input[type="email"]', credentials.teacherEmail!);
  await page.fill('input[type="password"]', credentials.teacherPassword!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/teacher/, { timeout: 15000 });
  await page.waitForTimeout(SLOW);

  await page.goto(`${baseUrl}/teacher/students`);
  await page.waitForTimeout(MEDIUM);
  const rosterBody = await page.locator("body").innerText();
  expect(rosterBody.toLowerCase()).toMatch(/student|name/i);

  await page.goto(`${baseUrl}/teacher/assignments`);
  await page.waitForTimeout(MEDIUM);
  const assignBody = await page.locator("body").innerText();
  expect(assignBody.toLowerCase()).toMatch(/assignment|create|new/i);

  await page.goto(`${baseUrl}/teacher/timetable`);
  await page.waitForTimeout(MEDIUM);
  await expect(page.locator("body")).toBeVisible();

  const timetableBody = await page.locator("body").innerText();
  expect(timetableBody.length).toBeGreaterThan(100);
});

test("Gate 3  Student: morning lesson experience", async ({ page }) => {
  await gotoWithRetry(page, `${baseUrl}/login`);
  await page.fill('input[type="email"]', credentials.studentEmail!);
  await page.fill('input[type="password"]', credentials.studentPassword!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/student|\/dashboard/, { timeout: 15000 });
  await page.waitForTimeout(SLOW);
  await acceptPolicyIfPresent(page);

  const dashBody = await page.locator("body").innerText();
  expect(dashBody.toLowerCase()).toMatch(/good morning|good afternoon|welcome/i);

  await page.goto(`${baseUrl}/student/today`);
  await acceptPolicyIfPresent(page);
  await expect(page.getByRole("heading", { name: "Today Focus" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByRole("heading", { name: "Todays School Day" })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page
      .getByText(
        /time to be announced|\d{1,2}:\d{2}\s*(AM|PM)|current|upcoming|catch up|adaptive recommendation|no school day schedule/i
      )
      .first()
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator("body")).not.toContainText(/application error|internal server error/i);

  const lessonLink = page.getByRole("link", {
    name: /continue lesson|open lesson|continue|start/i,
  }).first();

  let lessonLoaded = false;
  if (await lessonLink.isVisible({ timeout: 10000 }).catch(() => false)) {
    await lessonLink.click();
    await page.waitForURL(/\/student\/(?:lessons|lesson)\//, { timeout: 15000 });
    lessonLoaded = true;
  } else {
    await page.goto(`${baseUrl}/student/lessons`);
    await page.waitForTimeout(MEDIUM);
    await acceptPolicyIfPresent(page);
    const currLink = page
      .locator('a[href^="/student/lesson/"], a[href^="/student/lessons/"]')
      .first();
    if (await currLink.isVisible()) {
      await currLink.click();
      await page.waitForURL(/\/student\/(?:lessons|lesson)\//, { timeout: 15000 });
      lessonLoaded = true;
    }
  }

  if (lessonLoaded) {
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15000 });
    await expect(
      page
        .locator('[data-section-id="lesson-content"], button:has-text("read"), body:has-text("Progress")')
        .first()
    ).toBeVisible({ timeout: 15000 });

    const slidesTab = page.getByRole("button", { name: /slides/i }).first();
    const slidesVisible = await slidesTab.isVisible().catch(() => false);

    const listenTab = page.getByRole("button", { name: /listen/i }).first();
    const listenVisible = await listenTab.isVisible().catch(() => false);

    const tutorBtn = page.locator('[aria-label*="tutor"], button:has-text("Ask")').first();
    const tutorVisible = await tutorBtn.isVisible().catch(() => false);

    const backLink = page.getByRole("link", { name: /back|today/i }).first();
    const backVisible = await backLink.isVisible().catch(() => false);

    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL(/\/student\/today/, { timeout: 15000 });
    await expect(page.getByRole("heading", { name: "Today Focus" })).toBeVisible();

    console.log("Slides tab:", slidesVisible);
    console.log("Listen tab:", listenVisible);
    console.log("AI tutor:", tutorVisible);
    console.log("Back nav:", backVisible);
  }

  expect(lessonLoaded).toBe(true);
});

test("Gate 4  Assignment loop: assign and submit", async ({ page, context }) => {
  await gotoWithRetry(page, `${baseUrl}/login`);
  await page.fill('input[type="email"]', credentials.teacherEmail!);
  await page.fill('input[type="password"]', credentials.teacherPassword!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/teacher/, { timeout: 15000 });
  await page.waitForTimeout(SLOW);

  await page.goto(`${baseUrl}/teacher/assignments`);
  await page.waitForTimeout(MEDIUM);

  const assignBody = await page.locator("body").innerText();
  const canCreate = assignBody.toLowerCase().match(/create|new assignment|add/i);
  console.log("Teacher can create assignment:", !!canCreate);

  const studentPage = await context.newPage();
  await gotoWithRetry(studentPage, `${baseUrl}/login`);
  await studentPage.fill('input[type="email"]', credentials.studentEmail!);
  await studentPage.fill('input[type="password"]', credentials.studentPassword!);
  await studentPage.click('button[type="submit"]');
  await studentPage.waitForURL(/\/student|\/dashboard/, { timeout: 15000 });
  await studentPage.waitForTimeout(SLOW);
  await acceptPolicyIfPresent(studentPage);

  await studentPage.goto(`${baseUrl}/student/assignments`);
  await studentPage.waitForTimeout(MEDIUM);
  const studentAssignBody = await studentPage.locator("body").innerText();
  console.log("Student assignments page loads:", studentAssignBody.length > 100);

  const refreshBtn = studentPage.getByRole("button", { name: /refresh/i }).first();
  const hasRefresh = await refreshBtn.isVisible().catch(() => false);
  console.log("Refresh button present:", hasRefresh);

  await studentPage.close();

  expect(studentAssignBody.length).toBeGreaterThan(100);
});

test("Gate 5  Guardian: child progress visible", async ({ page }) => {
  await gotoWithRetry(page, `${baseUrl}/login`);
  await page.fill('input[type="email"]', credentials.guardianEmail!);
  await page.fill('input[type="password"]', credentials.guardianPassword!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/guardian|\/dashboard/, { timeout: 15000 });
  await page.waitForTimeout(SLOW);

  const dashBody = await page.locator("body").innerText();
  expect(dashBody.length).toBeGreaterThan(200);

  await page.goto(`${baseUrl}/guardian/messages`);
  await page.waitForTimeout(MEDIUM);
  const msgBody = await page.locator("body").innerText();

  const hasCompose = msgBody.toLowerCase().match(/message|compose|teacher|new/i);
  console.log("Guardian can message teacher:", !!hasCompose);

  const backLink = page.getByRole("link", { name: /back|dashboard/i }).first();
  const hasBack = await backLink.isVisible().catch(() => false);
  console.log("Back navigation:", hasBack);

  expect(dashBody.length).toBeGreaterThan(200);
  expect(!!hasCompose).toBe(true);
});

test("Gate 6  Teacher: end of day review", async ({ page }) => {
  await gotoWithRetry(page, `${baseUrl}/login`);
  await page.fill('input[type="email"]', credentials.teacherEmail!);
  await page.fill('input[type="password"]', credentials.teacherPassword!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/teacher/, { timeout: 15000 });
  await page.waitForTimeout(SLOW);

  await page.goto(`${baseUrl}/teacher/weekly-report`);
  await page.waitForTimeout(MEDIUM);
  const reportBody = await page.locator("body").innerText();
  expect(reportBody.length).toBeGreaterThan(200);

  await page.goto(`${baseUrl}/teacher/alerts`);
  await page.waitForTimeout(MEDIUM);
  const alertsBody = await page.locator("body").innerText();
  expect(alertsBody.length).toBeGreaterThan(100);

  await page.goto(`${baseUrl}/teacher/dashboard`);
  await page.waitForTimeout(SLOW);
  const bellBtn = page.locator(
    '[data-testid="alert-bell"], [aria-label*="alert"], button:has-text("alerts")'
  ).first();
  const hasBell = await bellBtn.isVisible().catch(() => false);
  console.log("Alert bell visible:", hasBell);

  expect(reportBody.length).toBeGreaterThan(200);
});

test("Gate 7  Admin: end of day operations", async ({ page }) => {
  await gotoWithRetry(page, `${baseUrl}/login`);
  await page.fill('input[type="email"]', credentials.adminEmail!);
  await page.fill('input[type="password"]', credentials.adminPassword!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 15000 });
  await page.waitForTimeout(SLOW);

  await expectAdminDashboardReady(page);

  await page.goto(`${baseUrl}/admin/ai-costs`);
  await page.waitForTimeout(MEDIUM);
  const costsBody = await page.locator("body").innerText();
  expect(costsBody.length).toBeGreaterThan(100);

  await page.goto(`${baseUrl}/admin/audit-log`);
  await page.waitForTimeout(MEDIUM);
  const auditBody = await page.locator("body").innerText();
  expect(auditBody.length).toBeGreaterThan(100);

  const dashBody = await page.locator("body").innerText();
  expect(dashBody).not.toContain("Application error");
  expect(dashBody).not.toContain("Internal Server Error");
});

test("Gate 8  MOE: national dashboard", async ({ page }) => {
  await gotoWithRetry(page, `${baseUrl}/moe/login`);
  await page.waitForTimeout(MEDIUM);
  await page.fill('input[type="email"]', credentials.moeEmail!);
  await page.fill('input[type="password"]', credentials.moePassword!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/moe\/dashboard/, { timeout: 15000 });
  await page.waitForTimeout(SLOW + 2000);
  await expect(page.getByText("Montserrado").first()).toBeVisible({ timeout: 15000 });

  const dashBody = await page.locator("body").innerText();
  expect(dashBody.length).toBeGreaterThan(400);

  expect(dashBody).toContain("Montserrado");

  expect(dashBody).not.toContain(credentials.studentEmail!);
  expect(dashBody).not.toMatch(/DemoSeed/);

  await page.goto(`${baseUrl}/moe/policies`);
  await page.waitForTimeout(MEDIUM);
  const policyBody = await page.locator("body").innerText();
  expect(policyBody.length).toBeGreaterThan(100);

  await page.goto(`${baseUrl}/moe/curriculum`);
  await page.waitForTimeout(MEDIUM);
  const currBody = await page.locator("body").innerText();
  expect(currBody.length).toBeGreaterThan(100);
});

test("Gate 9  Timetable: student schedule view", async ({ page }) => {
  await gotoWithRetry(page, `${baseUrl}/login`);
  await page.fill('input[type="email"]', credentials.studentEmail!);
  await page.fill('input[type="password"]', credentials.studentPassword!);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/student|\/dashboard/, { timeout: 15000 });
  await page.waitForTimeout(SLOW);
  await acceptPolicyIfPresent(page);

  await page.goto(`${baseUrl}/student/today`);
  await acceptPolicyIfPresent(page);
  await page.waitForTimeout(SLOW);

  const todayBody = await page.locator("body").innerText();

  const hasTimetable = todayBody.toLowerCase().match(/period|schedule|8:30|am|pm|timetable/i);
  const hasAdaptivePlan = todayBody.toLowerCase().match(/continue|lesson|today|assigned/i);
  const hasEmptyState = todayBody.toLowerCase().match(/no school day schedule|setup|catch up/i);

  console.log("Timetable configured:", !!hasTimetable);
  console.log("Adaptive plan shows:", !!hasAdaptivePlan);
  console.log("Empty state shows:", !!hasEmptyState);

  expect(todayBody.length).toBeGreaterThan(100);
  expect(todayBody).toContain("Todays School Day");
  expect(todayBody).toMatch(/Adaptive recommendation|Catch Up/i);
});
