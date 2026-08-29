/**
 * NR-13 governed runner.
 *
 * dry_run is the safe default and never writes. Database persistence requires
 * NR13_ALLOW_WRITE=true. `full` additionally routes pending rows through the
 * existing approval triage path; no mode publishes directly.
 */
import { NR13_GRADES, NR13_SUBJECTS, NR13_TARGET_LESSONS, NR13_VERSION, buildNr13GenerationPlan, validateNr13Lesson } from "../lib/curriculum/nr13Grades58";
import { createCurriculumContent, provenanceWritersEnabled } from "../lib/curriculum/mutations/repository";
import { appendCurriculumGovernanceEvent } from "../lib/curriculum/mutations/governanceWriter";
import { triageAndApprove } from "../lib/curriculum/riskTriage";
import { prisma } from "../lib/db";
import { countLessonWords } from "../lib/curriculum/generatedLessonEnricher";

export type Nr13BatchItem = { contentId: string; outcome: "saved" | "skipped_duplicate" | "quality_failed" | "dry_run"; failureReason?: string };
export type Nr13BatchResult = { grade: number; subject: string; attempted: number; passed: number; failed: number; items: Nr13BatchItem[] };

export function isCompleteNr13Batch(runAction: string, grade: number, subject: string, batch: Nr13BatchResult | undefined) {
  const completed = batch?.items.filter((item) => item.outcome === "saved" || item.outcome === "skipped_duplicate").length ?? 0;
  const dryRunComplete = runAction === "dry_run"
    && !!batch
    && batch.attempted === NR13_TARGET_LESSONS
    && batch.passed === NR13_TARGET_LESSONS
    && batch.failed === 0
    && batch.items.length === NR13_TARGET_LESSONS
    && batch.items.every((item) => item.outcome === "dry_run");
  const persistedComplete = runAction !== "dry_run"
    && !!batch
    && batch.failed === 0
    && batch.items.length === NR13_TARGET_LESSONS
    && completed === NR13_TARGET_LESSONS;
  return !!batch && batch.grade === grade && batch.subject === subject && (dryRunComplete || persistedComplete);
}

async function generateCell(grade: number, subject: string, action: string): Promise<Nr13BatchResult> {
  const plan = buildNr13GenerationPlan(grade, subject as (typeof NR13_SUBJECTS)[number]);
  const items: Nr13BatchItem[] = [];
  let passed = 0;
  let failed = 0;
  const canWrite = process.env.NR13_ALLOW_WRITE === "true";
  if (!canWrite && action !== "dry_run") throw new Error("NR13_ALLOW_WRITE=true is required for database-writing actions");
  const existingIds = action === "dry_run" ? new Set<string>() : new Set<string>((await prisma.curriculumContent.findMany({ where: { contentId: { in: plan.map((item) => item.contentId) } }, select: { contentId: true } })).map((item) => item.contentId));

  for (const record of plan) {
    const quality = validateNr13Lesson(record);
    if (!quality.passed) {
      failed += 1;
      items.push({ contentId: record.contentId, outcome: "quality_failed", failureReason: quality.reasons.join(",") });
      continue;
    }
    if (action === "dry_run") {
      passed += 1;
      items.push({ contentId: record.contentId, outcome: "dry_run" });
      continue;
    }
    if (existingIds.has(record.contentId)) {
      passed += 1;
      items.push({ contentId: record.contentId, outcome: "skipped_duplicate" });
      continue;
    }
    const payload = record.payload as Record<string, unknown>;
    const writersEnabled = provenanceWritersEnabled();
    const write = await createCurriculumContent({
      contentId: record.contentId,
      title: String(payload.title),
      grade: record.grade,
      subject: record.subject,
      contentType: "lesson",
      status: writersEnabled ? "draft" : "pending_approval",
      version: NR13_VERSION,
      unitId: record.unitId,
      orderInUnit: record.orderInUnit,
      lessonType: "core",
      teacherCreated: false,
      hash: record.hash,
      payload: {
        ...payload,
        approvalStatus: writersEnabled ? "DRAFT" : "pending_approval",
        metadata: { ...((payload.metadata as Record<string, unknown>) ?? {}), source: "nr13-grades58", qualityValidated: true },
      },
    }, {
      revisionKind: "ORIGINAL_GENERATION",
      originKind: "DETERMINISTIC_GENERATED",
      actorLabel: "nr13-grades58",
      generatorName: "nr13Grades58",
      generatorVersion: NR13_VERSION,
      generatedAt: new Date(),
      requestedCompleteness: "VERIFIED",
      auditAction: "curriculum.revision.nr13_create",
      auditDetails: { grade, subject },
      idempotencyKey: `nr13:${record.contentId}`,
    });
    if (writersEnabled) {
      await appendCurriculumGovernanceEvent({ contentId: write.content.contentId, revisionId: write.revision?.id, eventType: "SUBMITTED", actorType: "SYSTEM", actorLabel: "nr13-grades58", idempotencyKey: `nr13:${record.contentId}:submitted` });
    }
    passed += 1;
    items.push({ contentId: record.contentId, outcome: "saved" });
  }
  return { grade, subject, attempted: plan.length, passed, failed, items };
}

async function run() {
  const action = process.argv[2] ?? "dry_run";
  if (!["dry_run", "generate", "full"].includes(action)) throw new Error("Usage: npm run run:nr13 -- [dry_run|generate|full]");
  const batches: Nr13BatchResult[] = [];
  for (const grade of NR13_GRADES) {
    for (const subject of NR13_SUBJECTS) {
      const batch = await generateCell(grade, subject, action);
      batches.push(batch);
      if (!isCompleteNr13Batch(action, grade, subject, batch)) throw new Error(`NR-13 incomplete G${grade} ${subject}`);
      console.log(`G${grade} ${subject}: attempted=${batch.attempted} passed=${batch.passed} failed=${batch.failed} mode=${action}`);
    }
  }
  if (action !== "full") return;
  const pending = await prisma.curriculumContent.findMany({ where: { version: NR13_VERSION, status: { in: ["pending_approval", "draft", "DRAFT"] } }, select: { contentId: true, grade: true, subject: true, payload: true }, orderBy: [{ grade: "asc" }, { subject: "asc" }, { contentId: "asc" }] });
  for (const lesson of pending) {
    const result = await triageAndApprove({ contentId: lesson.contentId, grade: lesson.grade, subject: lesson.subject, payload: (lesson.payload ?? {}) as Record<string, unknown>, wordCount: countLessonWords(lesson.payload as any), minWordCount: 3500 }, "system:nr13-grades58", "APPROVED");
    console.log(`${result.action.toUpperCase()} ${lesson.contentId} risk=${result.riskScore}`);
  }
}

const invokedScript = process.argv[1]?.replace(/\\/g, "/");
if (invokedScript?.endsWith("/scripts/nr13-grades58.ts") || invokedScript?.endsWith("/scripts/nr13-grades58.js")) {
  run().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { if (process.argv[2] !== "dry_run") await prisma.$disconnect(); });
}
