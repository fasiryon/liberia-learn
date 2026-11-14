import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const m = vi.hoisted(() => {
  const state = { actor: null as any, effects: [] as string[], parses: 0, classSchool: "school-A", audits: [] as any[],
    upgradeArgs: null as any, importArgs: null as any, fail: (_name: string): never => { throw Error("uninitialized"); } };
  state.fail = (name: string) => { state.effects.push(name); throw Error("Unexpected domain work: " + name); };
  return state;
});
vi.mock("@/lib/auth", () => ({ requireRole: async (...roles: string[]) => {
  if (!m.actor) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!roles.includes(m.actor.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return m.actor;
} }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: new Proxy({}, { get: (_target, model) => new Proxy({}, { get: (_model, operation) => async () => {
  if (model === "class" && operation === "findUnique") { m.effects.push("SQL:class.lookup"); return { schoolId: m.classSchool }; }
  return m.fail("SQL:" + String(model) + "." + String(operation));
} }) }) }));
vi.mock("@/lib/audit", () => ({ logAudit: async (entry: any) => { m.effects.push("audit"); m.audits.push(entry); } }));
vi.mock("@/lib/rateLimit", () => ({ RATE_LIMIT_POLICIES: { ADMIN: { windowMs: 60000, limit: 10 } },
  checkRateLimit: async () => { m.effects.push("rate-limit"); return { allowed: true }; }, getRateLimitHeaders: () => ({}), rateLimitExceededResponse: () => m.fail("rate-response") }));
vi.mock("@/lib/ai/curriculum-factory", () => ({ generateCurriculumPayload: () => m.fail("provider") }));
vi.mock("@/lib/localization/liberia-context", () => ({ liberianize: () => m.fail("localize") }));
vi.mock("@/lib/localization/tone-standardizer", () => ({ standardizeTone: () => m.fail("tone") }));
vi.mock("@/lib/metrics/events", () => ({ recordMetricEvent: () => m.fail("metric") }));
vi.mock("@/lib/curriculum-helpers", () => ({ slugify: () => m.fail("slug"), generateLabs: () => m.fail("labs"),
  generateTermPlanPayload: () => m.fail("term"), generateUnitPlanPayload: () => m.fail("unit"), generateAssessmentItems: () => m.fail("assessment"),
  generateRubric: () => m.fail("rubric"), generateMasteryChecks: () => m.fail("mastery") }));
vi.mock("@/lib/moe/alignment-engine", () => ({ gradeToBand: () => m.fail("alignment") }));
vi.mock("@/lib/moe/alignmentReader", () => ({ readMoeAlignmentCodes: () => m.fail("alignment-read") }));
vi.mock("@/lib/ai/rag/embeddingService", () => ({ embedLesson: () => m.fail("embedding") }));
vi.mock("@/lib/ai/rag/ragIngestionService", () => ({ syncCurriculumContentRagChunks: () => m.fail("rag") }));
vi.mock("@/lib/queue", () => ({ enqueueJob: () => m.fail("queue"), isQueueConfigured: () => m.fail("queue-config"), JobType: {} }));
vi.mock("@/lib/curriculum/mediaGeneration", () => ({ generateMediaArtifactsBestEffort: () => m.fail("media") }));
vi.mock("@/lib/courses/courseThumbnailQueue", () => ({ enqueueCourseThumbnailGeneration: () => m.fail("thumbnail") }));
vi.mock("@/lib/ai/promptRegistry", () => ({ getPrompt: () => m.fail("prompt") }));
vi.mock("@/lib/curriculum/mutations/repository", () => ({ upsertCurriculumContent: () => m.fail("content-write"), provenanceWritersEnabled: () => m.fail("writer-flag") }));
vi.mock("@/lib/curriculum/mutations/governanceWriter", () => ({ appendCurriculumGovernanceEvent: () => m.fail("governance") }));
vi.mock("@/lib/serverFlags", () => ({ isTeacherGenerationEnabled: () => true, isAbBlockSchedulingEnabled: () => false,
  isAssignmentLessonLinkageEnabled: () => false, isVirtualLabsEnabled: () => false }));
vi.mock("@/lib/teacher/lessonAuthoring", () => ({ deriveAssessmentQuestions: () => m.fail("teacher-assessment"),
  deriveEstimatedMinutes: () => m.fail("teacher-minutes"), getTeacherClassOrThrow: () => m.fail("teacher-class"), inferClassGrade: () => m.fail("teacher-grade") }));
vi.mock("@/lib/curriculum/eliteUpgrade", () => ({ createEliteUpgradeDraft: async (args: any) => {
  m.effects.push("upgrade"); m.upgradeArgs = args;
  return { draftContentId: "synthetic-draft", originalContentId: "synthetic-content", versionName: "draft-v2", qualityScores: { delta: 1 } };
} }));
vi.mock("@/lib/curriculum/importer", () => ({ extractCurriculumImportText: () => { m.effects.push("extract"); return { text: "Synthetic lesson", format: "TEXT" }; },
  normalizeImportedCurriculum: () => ({ sourceFormat: "TEXT", subject: "MATH", grade: 4 }),
  persistImportedCurriculum: async (args: any) => { m.effects.push("import"); m.importArgs = args;
    return { version: { id: "synthetic-version", versionName: "synthetic" }, unitCount: 1, lessonCount: 1, importedLessons: [] }; } }));

import { POST as generate } from "@/app/api/admin/curriculum/generate/route";
import { POST as fullPack } from "@/app/api/admin/curriculum/generate-full-pack/route";
import { POST as schedule } from "@/app/api/admin/curriculum/schedule/route";
import { POST as importFile } from "@/app/api/admin/curriculum/import/route";
import { POST as upgrade } from "@/app/api/admin/curriculum/upgrade/route";
import { POST as teacherGenerate } from "@/app/api/teacher/generate-lesson/route";

const actor = (role: string, fresh = true, schoolId = "school-A") => ({ id: "synthetic-" + role, role, schoolId, isPlatformAdmin: false,
  authProvider: "auth0", mfaVerifiedAt: fresh ? Date.now() - 1000 : null, assuranceExpiresAt: fresh ? Date.now() + 600000 : null });
const request = (body: any = {}) => {
  const req = new NextRequest("http://localhost/api/admin/curriculum/synthetic", { method: "POST" });
  Object.defineProperty(req, "json", { configurable: true, value: async () => { m.parses++; return body; } });
  Object.defineProperty(req, "formData", { configurable: true, value: async () => { m.parses++; return new FormData(); } });
  return req;
};
const routes = [
  ["generate", generate], ["generate-full-pack", fullPack], ["schedule", schedule], ["import", importFile], ["upgrade", upgrade],
] as const;
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("PRIVILEGED_MFA_ENFORCEMENT_ENABLED", "true");
  m.actor = actor("ADMIN"); m.effects = []; m.parses = 0; m.audits = []; m.classSchool = "school-A"; m.upgradeArgs = null; m.importArgs = null; });
afterEach(() => vi.unstubAllEnvs());

for (const [name, handler] of routes) describe(name, () => {
  it.each(["school-A", "school-B"])("ordinary teacher in %s is denied before parsing/effects", async school => {
    m.actor = actor("TEACHER", false, school); expect((await handler(request())).status).toBe(403); expect(m.parses).toBe(0); expect(m.effects).toEqual([]);
  });
  it("admin without step-up is denied before parsing/effects", async () => {
    m.actor = actor("ADMIN", false); expect((await handler(request())).status).toBe(428); expect(m.parses).toBe(0); expect(m.effects).toEqual([]);
  });
  it("expired admin assurance is denied", async () => {
    m.actor = { ...actor("ADMIN"), assuranceExpiresAt: Date.now() - 1 }; expect((await handler(request())).status).toBe(428); expect(m.effects).toEqual([]); expect(m.parses).toBe(0);
  });
  it.each(["STUDENT", "GUARDIAN", "DISTRICT_ADMIN", "MOE_OFFICIAL", "MOE_SUPER_ADMIN"])("role %s is not newly admitted", async role => {
    m.actor = actor(role); expect((await handler(request())).status).toBe(403); expect(m.parses).toBe(0); expect(m.effects).toEqual([]);
  });
  it("anonymous request is denied", async () => { m.actor = null; expect((await handler(request())).status).toBe(401); expect(m.effects).toEqual([]); expect(m.parses).toBe(0); });
  it("authorized admin reaches the existing input validation", async () => {
    expect((await handler(request())).status).toBe(400); expect(m.parses).toBe(1); expect(m.effects.every(effect => effect === "rate-limit")).toBe(true);
  });
});
it("authorized upgrade preserves canonical school/user and audit metadata", async () => {
  const res = await upgrade(request({ contentId: "synthetic-content", schoolId: "school-B", userId: "forged" }));
  expect(res.status).toBe(200); expect(m.upgradeArgs).toEqual({ contentId: "synthetic-content", userId: m.actor.id, schoolId: "school-A" });
  expect(m.audits[0]).toMatchObject({ userId: m.actor.id, schoolId: "school-A", action: "curriculum.elite_upgrade.created" });
});
it("authorized import preserves canonical actor/school and audit metadata", async () => {
  const req = request(); const data = new FormData(); data.set("file", new File(["Synthetic lesson"], "lesson.txt", { type: "text/plain" })); data.set("schoolId", "school-B");
  Object.defineProperty(req, "formData", { value: async () => data });
  expect((await importFile(req)).status).toBe(200); expect(m.importArgs.user).toBe(m.actor);
  expect(m.audits[0]).toMatchObject({ userId: m.actor.id, schoolId: "school-A", action: "curriculum.import.created" });
});
it("authorized admin cannot schedule a foreign school's class", async () => {
  m.classSchool = "school-B"; expect((await schedule(request({ contentId: "synthetic-content", classId: "foreign-class", scheduledDate: "2026-11-12" }))).status).toBe(404);
  expect(m.effects).toEqual(["SQL:class.lookup"]); expect(m.audits).toEqual([]);
});
it("teacher-specific authoring still accepts a teacher and reaches its existing schema validation", async () => {
  m.actor = actor("TEACHER", false); expect((await teacherGenerate(request())).status).toBe(422); expect(m.parses).toBe(1); expect(m.effects).toEqual([]);
});
it("teacher-specific authoring source remains byte-identical to the bound base", () => {
  const path = "app/api/teacher/generate-lesson/route.ts";
  const original = execFileSync("git", ["show", "4662b14ac47e561ec628ec327499fd1a87eef5ef:" + path]);
  expect(readFileSync(path)).toEqual(original);
});
