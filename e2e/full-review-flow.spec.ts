import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import validationSet from "./fixtures/phase5-production-validation-set.json";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://liberia-learn.vercel.app";
const SEEDED_LESSON = "/student/lessons/cha-demo-student1-multimedia-lesson";
const SEEDED_CONTENT_ID = "cha-g9-math-multimedia-demo";
const E2E_DEMO_STUDENT_EMAIL = process.env.E2E_DEMO_STUDENT_EMAIL;
const E2E_DEMO_STUDENT_PASSWORD = process.env.E2E_DEMO_STUDENT_PASSWORD;
const E2E_DEMO_TEACHER_EMAIL = process.env.E2E_DEMO_TEACHER_EMAIL;
const E2E_DEMO_TEACHER_PASSWORD = process.env.E2E_DEMO_TEACHER_PASSWORD;
const E2E_DEMO_ADMIN_EMAIL = process.env.E2E_DEMO_ADMIN_EMAIL;
const E2E_DEMO_ADMIN_PASSWORD = process.env.E2E_DEMO_ADMIN_PASSWORD;
const E2E_DEMO_GUARDIAN_EMAIL = process.env.E2E_DEMO_GUARDIAN_EMAIL;
const E2E_DEMO_GUARDIAN_PASSWORD = process.env.E2E_DEMO_GUARDIAN_PASSWORD;
const E2E_DEMO_MOE_EMAIL = process.env.E2E_DEMO_MOE_EMAIL;
const E2E_DEMO_MOE_PASSWORD = process.env.E2E_DEMO_MOE_PASSWORD;

test.skip(
  !E2E_DEMO_STUDENT_EMAIL ||
    !E2E_DEMO_STUDENT_PASSWORD ||
    !E2E_DEMO_TEACHER_EMAIL ||
    !E2E_DEMO_TEACHER_PASSWORD ||
    !E2E_DEMO_ADMIN_EMAIL ||
    !E2E_DEMO_ADMIN_PASSWORD ||
    !E2E_DEMO_GUARDIAN_EMAIL ||
    !E2E_DEMO_GUARDIAN_PASSWORD ||
    !E2E_DEMO_MOE_EMAIL ||
    !E2E_DEMO_MOE_PASSWORD,
  "Skipping full review E2E tests because required E2E demo credential environment variables are not set."
);

type ValidationLesson = {
  contentId: string;
  title: string;
  subject: string;
  sourceType: string;
  initialScore: number;
};

type UpgradeResult = {
  ok: boolean;
  status: number;
  body: any;
};

type DraftPayloadResult = {
  ok: boolean;
  status: number;
  body: any;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

async function gotoWithRetry(page: Page, url: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      return;
    } catch (error) {
      if (attempt === 0 && error instanceof Error && error.message.includes("ERR_NETWORK_CHANGED")) {
        continue;
      }
      throw error;
    }
  }
}

async function login(page: Page, email: string, password: string, role?: "student" | "teacher" | "admin" | "guardian") {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await gotoWithRetry(page, `${BASE}/login${role ? `?role=${role}` : ""}`);
    if (role) {
      await page.getByRole("button", { name: role, exact: true }).click();
    }
    await page.fill('input[type="email"], input[type="text"]', email);
    await page.fill('input[type="password"]', password);
    await page.getByRole("button", { name: "Continue" }).click();

    try {
      await page.waitForFunction(() => !window.location.pathname.startsWith("/login"), undefined, {
        timeout: 30000,
      });
      return;
    } catch (error) {
      const authError = await page
        .locator("text=/invalid credentials|unauthorized|forbidden/i")
        .isVisible()
        .catch(() => false);
      if (!authError && attempt < 4) {
        await page.waitForTimeout(2500 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
}

async function loginMoe(page: Page) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await gotoWithRetry(page, `${BASE}/moe/login`);
    await page.fill('input[type="email"]', E2E_DEMO_MOE_EMAIL!);
    await page.fill('input[type="password"]', E2E_DEMO_MOE_PASSWORD!);
    await page.getByRole("button", { name: /sign in/i }).click();
    try {
      await page.waitForURL(/\/moe\/dashboard/, { timeout: 30000 });
      return;
    } catch (error) {
      if (attempt < 4) {
        await page.waitForTimeout(2500 * (attempt + 1));
        continue;
      }
      throw error;
    }
  }
}

async function makeWebmBuffer(page: Page) {
  const bytes = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 90;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1a1a18";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#E8B84B";
    ctx.fillRect(24, 30, 112, 20);
    const stream = canvas.captureStream(5);
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
    await new Promise((resolve) => setTimeout(resolve, 600));
    recorder.stop();
    await new Promise((resolve) => (recorder.onstop = resolve));
    const blob = new Blob(chunks, { type: "video/webm" });
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  return Buffer.from(bytes);
}

async function clearSession(page: Page) {
  await page.context().clearCookies();
  await page.goto("about:blank");
}

async function upgradeLesson(page: Page, contentId: string): Promise<UpgradeResult> {
  return page.evaluate(async (currentContentId) => {
    const response = await fetch("/api/admin/curriculum/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: currentContentId }),
    });
    const body = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  }, contentId);
}

async function fetchCurriculumPayload(page: Page, contentId: string): Promise<DraftPayloadResult> {
  return page.evaluate(async (currentContentId) => {
    const response = await fetch(`/api/curriculum/${currentContentId}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  }, contentId);
}

async function approveLesson(page: Page, contentId: string): Promise<UpgradeResult> {
  return page.evaluate(async (currentContentId) => {
    const response = await fetch("/api/admin/curriculum/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId: currentContentId }),
    });
    const body = await response.json().catch(() => null);
    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  }, contentId);
}

function inspectHumanQuality(payload: any) {
  const objectives = asArray(payload?.objectives);
  const workedExamples = asArray(payload?.workedExamples);
  const guidedPractice = asArray(payload?.guidedPractice);
  const independentPractice = asArray(payload?.independentPractice);
  const assessmentQuestions = asArray(payload?.assessmentQuestions ?? payload?.assessment);
  const misconceptions = asArray(payload?.commonMisconceptions);
  const teacherNotes = asArray(payload?.teacherNotes ?? payload?.teacher_notes);
  const studentNotes = String(payload?.studentNotes ?? payload?.student_notes ?? "");
  const realWorldApplication = String(payload?.realWorldApplication ?? "");
  const body = String(payload?.body_standard ?? payload?.body ?? "");
  const transferVisible =
    /transfer|compare|justify|why|apply|real[- ]world|critical/i.test(body) ||
    assessmentQuestions.some((item) => /compare|justify|why|apply|transfer/i.test(item));

  const checks = {
    clearObjectives: objectives.length >= 3 && objectives.every((item) => item.length >= 12),
    strongExplanation: body.length >= 900 && /introduction|explanation|summary/i.test(body),
    workedExamples: workedExamples.length >= 2,
    guidedPractice: guidedPractice.length >= 3,
    independentPractice: independentPractice.length >= 3,
    assessmentQuality: assessmentQuestions.length >= 4,
    misconceptionHandling: misconceptions.length >= 2,
    realWorldApplication: realWorldApplication.length >= 50,
    transferCriticalThinking: transferVisible,
    teacherNotes: teacherNotes.length >= 2,
    studentNotes: studentNotes.trim().length >= 80,
  };

  const issues = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    checks,
    issues,
    genuinelyElite: issues.length === 0,
  };
}

test("student reviewer flow has no dead navigation", async ({ page }) => {
  await login(page, E2E_DEMO_STUDENT_EMAIL, E2E_DEMO_STUDENT_PASSWORD!, "student");
  await page.goto(`${BASE}${SEEDED_LESSON}`);
  await expect(page.getByRole("heading", { name: /Ratios in Market Prices/i })).toBeVisible();
  await page.getByRole("button", { name: "Slides" }).click();
  await expect(page.locator("text=/Slide 1 of/")).toBeVisible();
  await page.getByRole("button", { name: "Listen" }).click();
  await expect(page.locator("text=/Audio being prepared|Audio is not generated yet|Download audio/")).toBeVisible();

  await page.goto(`${BASE}/student/exams`);
  await expect(page.getByRole("heading", { name: /My Exams/i })).toBeVisible();
  await page.goto(`${BASE}/student/certificates`);
  await expect(page.getByRole("heading", { name: /My Certificates/i })).toBeVisible();
  await page.goto(`${BASE}/student/textbooks`);
  await expect(page.getByRole("heading", { name: /My Textbooks/i })).toBeVisible();
});

test("generic library lesson exposes Read, Slides, and Listen modes", async ({ page }) => {
  await login(page, E2E_DEMO_STUDENT_EMAIL, E2E_DEMO_STUDENT_PASSWORD!, "student");
  await page.goto(`${BASE}/student/lesson/${SEEDED_CONTENT_ID}`);
  await expect(page.getByRole("heading", { name: /Ratios in Market Prices/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Read" })).toBeVisible();
  await page.getByRole("button", { name: "Slides" }).click();
  await expect(page.locator("text=/Slide 1 of/")).toBeVisible();
  await page.getByRole("button", { name: "Listen" }).click();
  await expect(page.getByRole("heading", { name: "Listen Mode" })).toBeVisible();
});

test("teacher uploads and activates a real video supplement", async ({ page }) => {
  await login(page, E2E_DEMO_TEACHER_EMAIL!, E2E_DEMO_TEACHER_PASSWORD!, "teacher");
  await page.goto(`${BASE}/teacher/lesson/${SEEDED_CONTENT_ID}`);
  await expect(page.getByRole("heading", { name: /Ratios in Market Prices/i })).toBeVisible();
  const buffer = await makeWebmBuffer(page);
  await page.setInputFiles('input[type="file"]', {
    name: `review-${Date.now()}.webm`,
    mimeType: "video/webm",
    buffer,
  });
  await page.fill('input[placeholder="Video title"]', "Review walkthrough introduction");
  await page.fill('input[placeholder="Duration seconds"]', "1");
  await page.getByRole("button", { name: /upload video/i }).click();
  await expect(page.getByText(/Video uploaded/)).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: /^Activate$/i }).first().click();
  await expect(page.getByRole("button", { name: /^Deactivate$/i }).first()).toBeVisible({ timeout: 15000 });
});

test("student sees active teacher video after upload", async ({ page }) => {
  await login(page, E2E_DEMO_STUDENT_EMAIL, E2E_DEMO_STUDENT_PASSWORD!, "student");
  await page.goto(`${BASE}${SEEDED_LESSON}`);
  await expect(page.locator("video").first()).toBeVisible({ timeout: 15000 });
  await expect(page.locator("text=/Lesson introduction by/i")).toBeVisible();
});

test("admin audio batch controls and analytics are visible", async ({ page }) => {
  await login(page, E2E_DEMO_ADMIN_EMAIL!, E2E_DEMO_ADMIN_PASSWORD!, "admin");
  await page.goto(`${BASE}/admin/curriculum`);
  await expect(page.getByRole("heading", { name: "Import Existing Curriculum" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Batch generate audio/i })).toBeVisible();
  await page.getByRole("button", { name: /Batch generate audio/i }).click();
  await expect(page.locator("text=/Queued|reused|Batch queue/")).toBeVisible({ timeout: 20000 });
  await page.goto(`${BASE}/admin/analytics`);
  await expect(page.getByRole("heading", { name: "Lesson Mode Usage" })).toBeVisible();
});

test("admin curriculum production validation captures upgrade, review, approval, and MOE visibility evidence", async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  const requestedIds = (process.env.PHASE5_PLAYWRIGHT_IDS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const baseLessons = validationSet as ValidationLesson[];
  const lessons = requestedIds.length
    ? requestedIds
        .map((contentId) => baseLessons.find((lesson) => lesson.contentId === contentId))
        .filter((lesson): lesson is ValidationLesson => Boolean(lesson))
    : baseLessons.slice(0, Math.max(1, Number(process.env.PHASE5_PLAYWRIGHT_LIMIT ?? "1")));
  const requireApproval = process.env.PHASE5_REQUIRE_APPROVAL === "true";
  const skipApproval = !requireApproval;
  const evidence: any[] = [];
  let approvedDraftId: string | null = null;
  let approvedVersionName: string | null = null;
  let approvedOriginalContentId: string | null = null;
  let approvedLessonTitle: string | null = null;
  let refinementChecked = false;

  await login(page, E2E_DEMO_ADMIN_EMAIL!, E2E_DEMO_ADMIN_PASSWORD!, "admin");
  await page.goto(`${BASE}/admin/curriculum`);
  await expect(page.getByRole("heading", { name: "Import Existing Curriculum" })).toBeVisible();

  for (const lesson of lessons) {
    const upgrade = await upgradeLesson(page, lesson.contentId);
    expect(upgrade.ok, `${lesson.contentId} upgrade failed: ${JSON.stringify(upgrade.body)}`).toBe(true);
    const draftContentId = String(upgrade.body?.draftContentId ?? "");
    expect(draftContentId.length).toBeGreaterThan(0);

    await gotoWithRetry(page, `${BASE}/admin/curriculum/${draftContentId}/review`);
    await expect(page.getByRole("heading", { name: /Original vs upgraded review/i })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Score source:/)).toBeVisible();
    await expect(page.getByText(/platform content rubric/i)).toBeVisible();
    await expect(page.getByText(/Model self-score:/)).toBeVisible();
    await expect(page.getByText(/Original quality/i)).toBeVisible();
    await expect(page.getByText(/Upgraded quality/i)).toBeVisible();
    await expect(page.getByText(/Score delta/i)).toBeVisible();
    const draftPayloadResponse = await fetchCurriculumPayload(page, draftContentId);
    expect(draftPayloadResponse.ok, `${draftContentId} payload fetch failed`).toBe(true);
    const draftPayload = draftPayloadResponse.body?.payload ?? draftPayloadResponse.body ?? {};
    const humanInspection = inspectHumanQuality(draftPayload);

    const qualityScores = upgrade.body?.qualityScores ?? {};
    const weakCategories = asArray(upgrade.body?.weakCategories);
    const firstPassWeakCategories = asArray(
      upgrade.body?.refinement?.previousScore?.weakCategories ?? qualityScores?.firstPass?.weakCategories
    );

    if (weakCategories.length > 0) {
      await expect(page.getByText(/Weak categories/i).first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Refine weak categories/i })).toBeVisible();
      if (upgrade.body?.refinement?.attempted && !refinementChecked) {
        await expect(page.getByText(/Automatic refinement:/)).toBeVisible();
        refinementChecked = true;
      }
    }

    evidence.push({
      lessonTitle: lesson.title,
      subject: lesson.subject,
      sourceType: lesson.sourceType,
      originalContentId: lesson.contentId,
      draftContentId,
      versionName: upgrade.body?.versionName ?? null,
      initialScore: qualityScores?.before?.total ?? lesson.initialScore,
      finalScore: qualityScores?.after?.total ?? null,
      scoreSourceVisible: true,
      modelSelfScoreVisible: true,
      refinementUsed: Boolean(upgrade.body?.refinement?.applied),
      weakCategoriesBeforeRefinement: firstPassWeakCategories,
      weakCategoriesFinal: weakCategories,
      reachedElite: Number(qualityScores?.after?.total ?? 0) >= 90,
      humanInspection,
    });

    if (!approvedDraftId) {
      approvedDraftId = draftContentId;
      approvedVersionName = upgrade.body?.versionName ?? null;
      approvedOriginalContentId = lesson.contentId;
      approvedLessonTitle = lesson.title;
    }
  }

  if (!skipApproval) {
    expect(approvedDraftId).toBeTruthy();
    await gotoWithRetry(page, `${BASE}/admin/curriculum/${approvedDraftId}/review`);
    if (approvedOriginalContentId) {
      await expect(page.getByText(new RegExp(escapeRegExp(approvedOriginalContentId)))).toBeVisible();
    }
    await page.getByRole("button", { name: /Approve & Publish/i }).click();
    try {
      await expect(page.getByText(/Approved/i)).toBeVisible({ timeout: 15000 });
    } catch {
      const approval = await approveLesson(page, String(approvedDraftId));
      expect(approval.ok, `Approval fallback failed: ${JSON.stringify(approval.body)}`).toBe(true);
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByText(/Approved/i)).toBeVisible({ timeout: 30000 });
    }

    await clearSession(page);
    await login(page, E2E_DEMO_STUDENT_EMAIL, E2E_DEMO_STUDENT_PASSWORD!, "student");
    await gotoWithRetry(page, `${BASE}/student/lesson/${approvedDraftId}`);
    await expect(
      page.getByRole("heading", { name: new RegExp(escapeRegExp(String(approvedLessonTitle ?? "")), "i") })
    ).toBeVisible({ timeout: 30000 });

    await clearSession(page);
    await loginMoe(page);
    await gotoWithRetry(page, `${BASE}/moe/curriculum`);
    if (approvedVersionName) {
      await expect(page.getByText(approvedVersionName)).toBeVisible({ timeout: 30000 });
    }
  }

  const summary = {
    validatedAt: new Date().toISOString(),
    lessonCount: evidence.length,
    approvedDraftId,
    approvedVersionName,
    teacherCurriculumReviewPathSupported: false,
    teacherCurriculumReviewPathNote: "Current curriculum governance exposes teacher curriculum generation and admin approval; a separate teacher curriculum review path is not present in the supported UI.",
    approvalSkipped: skipApproval,
    moeVisibilityVerified: skipApproval ? false : Boolean(approvedVersionName),
    evidence,
  };

  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    join("test-results", "phase5-production-validation.json"),
    JSON.stringify(summary, null, 2),
    "utf8"
  );
});

test("MOE review surface shows real data", async ({ page }) => {
  await loginMoe(page);
  await expect(page.locator("text=Lesson Mode Usage")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Audio Starts")).toBeVisible();
  await expect(page.getByText("Active Videos")).toBeVisible();
});

test("guardian review surface shows linked student data", async ({ page }) => {
  await login(page, E2E_DEMO_GUARDIAN_EMAIL!, E2E_DEMO_GUARDIAN_PASSWORD!, "guardian");
  await page.goto(`${BASE}/guardian`);
  await expect(page.locator("text=/Fatu Kollie|student/i")).toBeVisible({ timeout: 20000 });
});

test("platform admin demo account lands in platform console", async ({ page }) => {
  await login(page, "platform.admin@liberialearn.org", E2E_DEMO_STUDENT_PASSWORD!, "admin");
  await page.goto(`${BASE}/platform`);
  await expect(page.getByRole("heading", { name: "Platform Dashboard" })).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("link", { name: "Schools", exact: true })).toBeVisible();
});
