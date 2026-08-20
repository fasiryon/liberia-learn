/**
 * scripts/regenerate-attached-thin-lessons.ts
 *
 * LIVE WRITE, but never touches status. Regenerates the ~125 attached-thin
 * lessons in place (real ScheduledWork attachment; their unattached
 * siblings were already purged - see
 * archive/thin-content-purge-export-2026-07-25.json).
 *
 * Generate + validate FIRST; write only on a passing quality gate, and
 * only title/payload/hash - status is never read as a precondition and
 * never mutated. The student-facing gate (APPROVED_CONTENT_STATUSES in
 * app/api/student/work/[scheduledWorkId]/route.ts) is the only thing that
 * governs live access, and this script never touches it - these lessons
 * stay servable throughout, even mid-run, even on a partial/failed run.
 * A failed quality gate writes nothing at all: original content untouched.
 *
 * Reuses the exact generateCurriculumPayload/validateLessonDepth call
 * shape already proven in scripts/process-regen-jobs-direct.ts, including
 * lessonFormat: "standard" (documented workaround for JSON
 * truncation/corruption with "either" on Groq models - see that script's
 * comment).
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/regenerate-attached-thin-lessons.ts [limit]
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "crypto";
import { config as loadEnv } from "dotenv";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const BATCH_SIZE = 10;
const MAX_ERROR_RATE = 0.3;
const MAX_LESSONS_THIS_RUN = Number(process.argv[2] ?? 25);
const THIN_THRESHOLD = 300;
const APPROVED_CONTENT_STATUSES = new Set(["published", "APPROVED"]);

function alignmentCodes(value: unknown): string[] | undefined {
  const arrayValue = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { standards?: unknown }).standards)
      ? (value as { standards: unknown[] }).standards
      : undefined;
  if (!arrayValue) return undefined;
  const codes = arrayValue
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && typeof (item as { code?: unknown }).code === "string") {
        return String((item as { code: string }).code).trim();
      }
      return "";
    })
    .filter(Boolean);
  return codes.length ? codes : undefined;
}

function contentHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40);
}

function extractMatchableText(payload: any): string {
  const textParts: string[] = [];
  if (payload) {
    // "content"/"description"/"summary" are the pre-regeneration stub shape
    // (nationalFactory/generationEngine). generateCurriculumPayload's real
    // output shape (this script's own write target) puts the substantive
    // text in lessonContent/body_standard instead - those fields don't
    // exist on the old stub shape, and the old fields don't exist on the
    // new one. Check both so freshly-regenerated lessons are correctly
    // recognized as no-longer-thin (confirmed via direct inspection: a
    // real regenerated lesson had 27,394 chars in lessonContent/
    // body_standard but content/description/summary were all undefined).
    for (const key of ["title", "description", "objectives", "content", "summary", "lessonPlan", "lessonContent", "body_standard"]) {
      const val = payload[key];
      if (typeof val === "string") textParts.push(val);
      else if (Array.isArray(val)) textParts.push(val.filter((v: any) => typeof v === "string").join(" "));
      else if (typeof val === "object" && val) textParts.push(JSON.stringify(val));
    }
  }
  return textParts.join(" ").toLowerCase();
}

async function main() {
  const { prisma } = await import("@/lib/db");
  const { createConservativeCurriculumMaintenanceClient } = await import("@/lib/curriculum/mutations/maintenanceClient");
  const governedCurriculum = createConservativeCurriculumMaintenanceClient("regenerate-attached-thin-lessons");
  const { generateCurriculumPayload } = await import("@/lib/ai/curriculum-factory");
  const { validateLessonDepth, extractLessonText } = await import("@/lib/curriculum/regenerationQualityGate");

  // Re-derived fresh, not reused from the earlier investigation/export snapshot.
  const allContent = await prisma.curriculumContent.findMany({
    select: {
      id: true,
      contentId: true,
      title: true,
      subject: true,
      grade: true,
      status: true,
      payload: true,
      moeAlignments: true,
      hash: true,
    },
  });
  const thin = allContent.filter((c) => extractMatchableText(c.payload).length < THIN_THRESHOLD);
  const thinContentIds = thin.map((c) => c.contentId);
  const scheduledWorkRows = await prisma.scheduledWork.findMany({
    where: { contentId: { in: thinContentIds } },
    select: { contentId: true },
  });
  const attachedIds = new Set(scheduledWorkRows.map((r) => r.contentId));
  const targets = thin.filter((c) => attachedIds.has(c.contentId));

  console.log(`Re-derived fresh: ${targets.length} attached-thin target lessons (expect 125).`);

  const toProcess = targets.slice(0, MAX_LESSONS_THIS_RUN);
  console.log(`Processing ${toProcess.length} this run (cap ${MAX_LESSONS_THIS_RUN}).\n`);

  let succeeded = 0;
  let qualityGateFailed = 0;
  let writeVerifyFailed = 0;
  let hardErrors = 0;
  let batchNum = 0;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    batchNum += 1;
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    console.log(`--- Batch ${batchNum}: ${batch.length} lessons ---`);

    let batchOk = 0;
    let batchBad = 0;

    for (const lesson of batch) {
      const label = `${lesson.contentId} (G${lesson.grade} ${lesson.subject})`;
      try {
        const topic = (lesson.payload as any)?.title || lesson.title || `${lesson.subject} Grade ${lesson.grade}`;
        const generated = await generateCurriculumPayload({
          grade: lesson.grade,
          subject: lesson.subject,
          topic,
          contentType: "lesson",
          moeAlignmentCodes: alignmentCodes(lesson.moeAlignments),
          lessonFormat: "standard",
          liberiaContext: true,
          forceSmartTier: true,
        });

        const gen = generated as Record<string, unknown>;
        const richContent =
          (typeof gen.body_standard === "string" ? gen.body_standard.trim() : "") || extractLessonText(generated);
        const payloadForValidation = { ...generated, lessonContent: richContent };
        const depth = validateLessonDepth(payloadForValidation, lesson.grade);

        if (!depth.valid) {
          qualityGateFailed += 1;
          batchBad += 1;
          console.log(`  [QUALITY-GATE-FAIL] ${label}: ${depth.failReasons.join("; ")} (slides=${depth.slideCount} words=${depth.wordCount}) - nothing written, original untouched`);
          continue;
        }

        const nextPayload = {
          ...generated,
          lessonContent: richContent,
          approvalStatus: "APPROVED",
          generationMetadata: {
            ...(typeof generated.metadata === "object" && generated.metadata ? generated.metadata : {}),
            regeneratedInPlace: true,
            previousHash: lesson.hash,
            depthSlideCount: depth.slideCount,
            depthWordCount: depth.wordCount,
            generatedAt: new Date().toISOString(),
          },
        };
        const newHash = contentHash(nextPayload);

        // Atomic write - ONLY title/payload/hash/updatedAt. status is never touched.
        await governedCurriculum.update({
          where: { id: lesson.id },
          data: {
            title: typeof (generated as any).title === "string" ? (generated as any).title : lesson.title,
            payload: nextPayload as any,
            hash: newHash,
            updatedAt: new Date(),
          },
        });

        // Verify immediately against real DB state - not just that the write didn't throw.
        const verify = await prisma.curriculumContent.findUnique({
          where: { id: lesson.id },
          select: { status: true, hash: true },
        });
        const statusUnchanged = verify?.status === lesson.status;
        const stillLiveToStudents = verify ? APPROVED_CONTENT_STATUSES.has(verify.status) === APPROVED_CONTENT_STATUSES.has(lesson.status) : false;
        const hashActuallyChanged = verify?.hash === newHash && verify.hash !== lesson.hash;

        if (!statusUnchanged || !stillLiveToStudents || !hashActuallyChanged) {
          writeVerifyFailed += 1;
          batchBad += 1;
          console.log(`  [VERIFY-FAIL] ${label}: statusUnchanged=${statusUnchanged} stillLiveToStudents=${stillLiveToStudents} hashActuallyChanged=${hashActuallyChanged}`);
          continue;
        }

        succeeded += 1;
        batchOk += 1;
        console.log(`  [OK] ${label}: slides=${depth.slideCount} words=${depth.wordCount} status unchanged (${verify.status}), still in live-servable set`);
      } catch (err: any) {
        hardErrors += 1;
        batchBad += 1;
        console.log(`  [ERROR] ${label}: ${err?.message ?? err}`);
      }
    }

    console.log(`Batch ${batchNum} result: ok=${batchOk} bad=${batchBad}\n`);

    const errorRate = batchBad / batch.length;
    if (errorRate > MAX_ERROR_RATE) {
      console.log(`[ABORT] Batch ${batchNum} bad rate ${(errorRate * 100).toFixed(1)}% exceeded ${MAX_ERROR_RATE * 100}% threshold. Stopping for human review.`);
      break;
    }
  }

  console.log(`=== SUMMARY ===`);
  console.log(`Succeeded (real content swap, status untouched, verified live): ${succeeded}`);
  console.log(`Quality-gate failed (nothing written, original untouched): ${qualityGateFailed}`);
  console.log(`Write-verify failed (wrote, but post-write check found an issue): ${writeVerifyFailed}`);
  console.log(`Hard errors (exception during generation/write): ${hardErrors}`);

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
