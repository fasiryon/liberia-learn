/**
 * Seed the Grade 4 Math learning target LR-MATH-G4_6-02 (PREPARED; DRY RUN BY DEFAULT).
 *
 * Dry run (default): read-only transaction. Checks preconditions and prints
 * the exact row it would write. Writes nothing.
 *
 * Apply: requires BOTH `--apply` and CONFIRM_PRODUCTION_WRITE=LR-MATH-G4_6-02.
 * Only run with explicit founder authorization, after the fractions lesson is
 * published through scripts/author-grade4-fractions-authority.ts.
 *
 * Idempotent: an existing (code, version) row with the same payload is a no-op;
 * a different existing row aborts.
 *
 * Usage: DIRECT_URL=<connection> npx tsx scripts/seed-g4-learning-target.ts [--apply]
 */
import fs from "node:fs";
import { PrismaClient, type Prisma } from "@prisma/client";

const CODE = "LR-MATH-G4_6-02";
const LESSON = "ll-g4-math-fractions-equal-parts-2026.1";
const spec = JSON.parse(fs.readFileSync("curriculum/review/g4-math/live-readiness/lr-math-g4_6-02.target.json", "utf8"));

async function main() {
  const apply = process.argv.includes("--apply");
  if (apply && process.env.CONFIRM_PRODUCTION_WRITE !== CODE) throw new Error(`--apply requires CONFIRM_PRODUCTION_WRITE=${CODE}`);
  const url = process.env.DIRECT_URL?.trim();
  if (!url) throw new Error("DIRECT_URL is required");
  const prisma = new PrismaClient({ datasourceUrl: url, log: [] });
  try {
    await prisma.$transaction(async (tx) => {
      if (!apply) await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      const lesson = await tx.curriculumContent.findUnique({ where: { contentId: LESSON }, select: { id: true, status: true, version: true } });
      if (!lesson) throw new Error(`precondition_failed: ${LESSON} is not in the database (publish it first)`);
      if (lesson.status !== "published") throw new Error(`precondition_failed: ${LESSON} status is ${lesson.status}, expected published`);
      const provenance = await tx.curriculumProvenance.findUnique({ where: { curriculumContentId: lesson.id }, select: { currentRevisionId: true } });
      if (!provenance?.currentRevisionId) throw new Error("precondition_failed: lesson has no current revision");
      const human = await tx.curriculumGovernanceEvent.findFirst({ where: { revisionId: provenance.currentRevisionId, eventType: "APPROVED", approvalBasis: "HUMAN_REVIEW" }, select: { id: true } });
      if (!human) throw new Error("precondition_failed: current revision has no HUMAN_REVIEW approval");

      const data = { ...spec.data, curriculumRevisionId: provenance.currentRevisionId } as Prisma.CurriculumLearningTargetUncheckedCreateInput;
      const existing = await tx.curriculumLearningTarget.findUnique({ where: { code_version: { code: CODE, version: 1 } } });
      if (existing) {
        const same = existing.statement === data.statement && existing.curriculumRevisionId === data.curriculumRevisionId && existing.grade === data.grade;
        if (!same) throw new Error(`abort: ${CODE} v1 exists with different content (${existing.id})`);
        console.log(JSON.stringify({ result: "ALREADY_PRESENT", id: existing.id }));
        return;
      }
      if (!apply) { console.log(JSON.stringify({ result: "DRY_RUN", wouldCreate: data }, null, 2)); return; }
      const created = await tx.curriculumLearningTarget.create({ data });
      console.log(JSON.stringify({ result: "CREATED", id: created.id, code: created.code, curriculumRevisionId: created.curriculumRevisionId }));
    }, { timeout: 60_000 });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
