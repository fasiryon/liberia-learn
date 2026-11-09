// Synthetic browser verification only. Never accepts a remote server or a database URL argument.
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { PrismaClient } = require("@prisma/client"), { chromium } = require("@playwright/test"), { encode } = require("next-auth/jwt");
if (process.argv[2] !== "--isolated-synthetic") throw Error("explicit_synthetic_test_required");
const db = new PrismaClient({ datasources: { db: { url: "postgresql://preview_test:preview_local_only@127.0.0.1:55447/draft6_preview_validation" } } });
const base = "http://127.0.0.1:3046", selection = "factory@4.0.0-draft.6@g7-math-area-perimeter";
const directory = "artifacts/draft6-pilot-validation";
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
const sha = value => crypto.createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
let browser;
(async () => {
  const identity = await db.$queryRaw`SELECT current_database() AS database, current_user AS username`;
  assert.deepEqual(identity, [{ database: "draft6_preview_validation", username: "preview_test" }]);
  const stored = await db.policyConfig.findUniqueOrThrow({ where: { id: "preview-test-policy" } });
  const config = { ...stored.config, startsAt: new Date(Date.now() - 60000).toISOString(), endsAt: new Date(Date.now() + 3600000).toISOString() };
  const packageHash = config.lessons[0].packageHash;
  const bindingSha256 = sha({ status: "PILOT_ONLY", schoolId: config.schoolId, classIds: config.classIds.slice().sort(),
    studentUserIds: config.studentUserIds.slice().sort(), startsAt: config.startsAt, endsAt: config.endsAt, selection, packageHash,
    reviews: config.lessons[0].reviews, approvalRecordId: config.lessons[0].approvalRecordId });
  const auditLogId = `preview-test-browser-audit-${Date.now()}`;
  await db.policyConfig.update({ where: { id: stored.id }, data: { config, isActive: true } });
  await db.policyConfig.update({ where: { id: "preview-test-approval" }, data: { isActive: true, config: { status: "AUTHORIZED_PILOT_RELEASE", bindingSha256, auditLogId } } });
  await db.auditLog.create({ data: { id: auditLogId, userId: "preview-test-authority", schoolId: config.schoolId,
    action: "V4_PILOT_RELEASE_AUTHORIZED", resourceType: "PolicyConfig", resourceId: "preview-test-approval", details: { bindingSha256, syntheticTestOnly: true } } });
  await db.dataPolicyAcceptance.create({ data: { userId: "preview-test-user", schoolId: config.schoolId, policyKey: "terms_privacy", policyVersion: "2026-04", source: "SYNTHETIC_TEST_ONLY" } });
  const counts = () => Promise.all([db.grade.count(), db.masteryRecord.count(), db.assignment.count(), db.learningEvent.count(), db.masterySnapshot.count(), db.curriculumGovernanceEvent.count()]);
  const before = await counts();
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const token = await encode({ secret: "draft6-isolated-test-only-secret-2026", token: {
    id: "preview-test-user", sub: "preview-test-user", email: "pilot-student@example.invalid", role: "STUDENT", schoolId: config.schoolId,
    isPlatformAdmin: false, mustChangePIN: false,
  }, maxAge: 3600 });
  await context.addCookies([{ name: "next-auth.session-token", value: token, url: base, httpOnly: true, sameSite: "Lax" }]);
  const page = await context.newPage(), requests = [], failures = [];
  page.on("request", request => requests.push({ url: request.url(), method: request.method() }));
  page.on("pageerror", error => failures.push(error.message));
  const response = await page.goto(`${base}/learn/preview/${selection}`, { waitUntil: "networkidle", timeout: 120000 });
  if (response.status() !== 200) {
    const session = await (await context.request.get(`${base}/api/auth/session`)).json();
    console.log(JSON.stringify({ diagnostic: "synthetic_session", authenticated: Boolean(session.user), role: session.user?.role,
      schoolMatches: session.user?.schoolId === config.schoolId, status: response.status(), finalPath: new URL(page.url()).pathname }));
  }
  assert.equal(response.status(), 200);
  assert.match(response.headers()["cache-control"], /no-store/);
  await page.locator("[data-lesson-player-v2]").waitFor({ timeout: 30000 });
  assert.equal(await page.getByText("Pilot lesson — not graded", { exact: true }).count(), 1);
  assert.equal(await page.locator("[data-lesson-player-v2]").getAttribute("data-lesson-version"), "4.0.0-draft.6");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(directory, "pilot-mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  const retainedScene = await page.locator("[data-lesson-player-v2]").getAttribute("data-scene-id");
  await context.setOffline(true);
  await page.locator("[data-lesson-player-v2]").waitFor({ state: "hidden", timeout: 7000 });
  assert.equal(await page.locator("[data-lesson-player-v2]").count(), 1);
  await context.setOffline(false);
  await page.locator("[data-lesson-player-v2]").waitFor({ state: "visible", timeout: 10000 });
  assert.equal(await page.locator("[data-lesson-player-v2]").getAttribute("data-scene-id"), retainedScene);
  const api = await context.request.get(`${base}/api/student/learning-preview/${selection}`);
  assert.equal(api.status(), 200); assert.match(api.headers()["cache-control"], /no-store/);
  const data = await api.json();
  assert.equal(data.experience.scenes.some(scene => scene.interaction.kind === "ASSESSMENT_HANDOFF"), false);
  assert.equal(data.experience.scenes.some(scene => scene.content.body.includes("No graded assessment is available")), true);
  const rejected = await context.request.get(`${base}/api/student/learning-preview/factory@4.0.0-draft.6@g7-civics-counties-capitals`);
  assert.equal(rejected.status(), 404);
  const doubleEncoded = await context.request.get(`${base}/api/student/learning-preview/${encodeURIComponent(encodeURIComponent(selection))}`);
  // Next may normalize an encoding layer before the handler. All spellings must bind the same identity.
  assert.equal(doubleEncoded.status(), 200);
  const normalized = await doubleEncoded.json();
  assert.equal(normalized.identity.selection, selection); assert.equal(normalized.identity.packageHash, packageHash);
  const malformed = await context.request.get(`${base}/api/student/learning-preview/${encodeURIComponent(encodeURIComponent("factory@4.0.0-draft.7@../x"))}`);
  assert.equal(malformed.status(), 404);
  const revokedAt = new Date().toISOString();
  await db.policyConfig.update({ where: { id: stored.id }, data: { config: { ...config, lessons: [{ ...config.lessons[0], revokedAt }] } } });
  const revokeStart = Date.now();
  const revoked = await context.request.get(`${base}/api/student/learning-preview/${selection}`);
  assert.equal(revoked.status(), 404);
  await page.locator("[data-lesson-player-v2]").waitFor({ state: "detached", timeout: 7000 });
  const removalMs = Date.now() - revokeStart;
  await context.setOffline(true);
  assert.equal(await page.locator("[data-lesson-player-v2]").count(), 0);
  await context.setOffline(false);
  assert.deepEqual(await counts(), before);
  assert.equal(requests.some(request => request.method !== "GET" && request.method !== "HEAD"), false);
  assert.deepEqual(failures, []);
  const evidence = { isolatedDatabase: identity[0], base, selection, packageHash, status: "PASS", authenticatedStudent: true,
    realLessonPlayer: true, mobileNoOverflow: true, civicsDenied: true, encodedSelectionSameExactIdentity: true, malformedSelectionDenied: true,
    offlineMemoryPreserved: true, retainedScene, revocationHTTP: 404, openPlayerRemovalMs: removalMs,
    officialRecordsUnchanged: true, nonReadRequests: 0, pageErrors: failures, requests };
  fs.writeFileSync(path.join(directory, "browser.json"), JSON.stringify(evidence, null, 2) + "\n");
  console.log(JSON.stringify({ ...evidence, requests: requests.length }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  // Leave every synthetic policy inactive after browser testing, including failure paths.
  await db.policyConfig.updateMany({ where: { schoolId: "preview-test-school", policyKey: { in: ["V4_DRAFT6_LEARNING_PREVIEW", "V4_PILOT_RELEASE_APPROVAL"] } }, data: { isActive: false } }).catch(() => {});
  await browser?.close(); await db.$disconnect();
});
