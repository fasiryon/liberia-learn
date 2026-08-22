/**
 * Targeted generation + quality gate + approval for the 3 structural gaps:
 *   G5 CIVICS  |  G6 CIVICS  |  G5 COMPUTER_SCIENCE
 *
 * Usage:
 *   dry_run  — preview only, no DB writes
 *   generate — write pending_approval lessons to DB
 *   approve  — approve lessons written in this run (version=ncf-2026.1, specific combos)
 *   full     — generate + approve in one pass
 */
// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { generateNationalBatch, auditNationalCoverage, validatePayloadQuality } from "../lib/curriculum/nationalFactory";
import { PrismaClient } from "@prisma/client";
import { appendCurriculumGovernanceEvent } from "../lib/curriculum/mutations/governanceWriter";

const prisma = new PrismaClient();

export const GAP_COMBOS = [
  { grade: 5, subject: "CIVICS" },
  { grade: 6, subject: "CIVICS" },
  { grade: 5, subject: "COMPUTER_SCIENCE" },
];

type LessonRow = {
  id: string;
  contentId: string;
  grade: number;
  subject: string;
  payload: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

export function passesQualityGate(lesson: LessonRow): boolean {
  const payload = lesson.payload as Record<string, unknown>;
  const qr = validatePayloadQuality(payload);
  if (!qr.passed) return false;

  const body = String(payload.body ?? "").toLowerCase();
  if (!body.includes("liber")) return false;

  const hasTeacherNote =
    (typeof payload.teacherNote === "string" && payload.teacherNote.length > 10) ||
    (typeof payload.explanation === "string" && payload.explanation.length > 10) ||
    body.includes("## teacher explanation") ||
    body.includes("## teacher notes");
  if (!hasTeacherNote) return false;

  if (!(typeof payload.assessment === "string" && payload.assessment.length > 10)) return false;
  if (!(Array.isArray(payload.workedExamples) && (payload.workedExamples as unknown[]).length > 0)) return false;

  return true;
}

export async function runQualityGate(db: Db = prisma): Promise<{ failed: string[]; total: number }> {
  let skip = 0;
  const batchSize = 100;
  const failed: string[] = [];
  let total = 0;

  while (true) {
    const pending: LessonRow[] = await db.curriculumContent.findMany({
      where: {
        status: "pending_approval",
        version: "ncf-2026.1",
        OR: GAP_COMBOS.map(({ grade, subject }) => ({ grade, subject })),
      },
      select: { id: true, contentId: true, grade: true, subject: true, payload: true },
      skip,
      take: batchSize,
    });

    if (pending.length === 0) break;

    total += pending.length;
    for (const row of pending) {
      if (!passesQualityGate(row)) {
        failed.push(row.contentId);
      }
    }

    skip += batchSize;
  }

  return { failed, total };
}

export async function approveSafely(failed: string[], db: Db = prisma): Promise<number> {
  if (failed.length > 0) {
    console.log(`  Skipping ${failed.length} failed lesson(s) that did not pass quality gate:`);
    for (const contentId of failed) {
      console.log(`    SKIPPED: ${contentId}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    status: "pending_approval",
    version: "ncf-2026.1",
    OR: GAP_COMBOS.map(({ grade, subject }) => ({ grade, subject })),
  };

  if (failed.length > 0) {
    where.contentId = { notIn: failed };
  }

  const rows = await db.curriculumContent.findMany({
    where,
    select: { contentId: true },
  });
  for (const row of rows as Array<{ contentId: string }>) {
    await appendCurriculumGovernanceEvent({
      contentId: row.contentId,
      eventType: "APPROVED",
      actorType: "SYSTEM",
      actorLabel: "factory-gap-closure",
      approvalBasis: "AUTOMATED_RISK_POLICY",
      reviewAuthority: "SYSTEM",
      idempotencyKey: `factory-gap-closure:${row.contentId}:approved`,
    });
  }
  return rows.length;
}

async function beforeCounts(db: Db = prisma) {
  const rows: Array<{ grade: number; subject: string; _count: { id: number } }> = [];
  for (const { grade, subject } of GAP_COMBOS) {
    const count = await db.curriculumContent.count({
      where: { grade, subject, status: "APPROVED" },
    });
    rows.push({ grade, subject, _count: { id: count } });
  }
  return rows;
}

async function main() {
  const action = process.argv[2] ?? "dry_run";
  const isDryRun = action === "dry_run";
  const doGenerate = action === "generate" || action === "full";
  const doApprove = action === "approve" || action === "full";

  console.log(`\n=== Gap Closure Script: action=${action} ===`);
  console.log("Target combos:", GAP_COMBOS.map(c => `G${c.grade} ${c.subject}`).join(", "));

  const before = await beforeCounts();
  console.log("\n--- Before counts (APPROVED) ---");
  for (const row of before) {
    console.log(`  G${row.grade} ${row.subject}: ${row._count.id} approved`);
  }

  if (doGenerate || isDryRun) {
    console.log(`\n--- Generating (dryRun=${isDryRun}) ---`);
    for (const { grade, subject } of GAP_COMBOS) {
      const r = await generateNationalBatch({
        batchSize: 40,
        dryRun: isDryRun,
        prioritizeCritical: false,
        grade,
        subject,
        sessionId: `gap-closure-${grade}-${subject}-${Date.now()}`,
      });
      const b = r.batches[0];
      if (b) {
        console.log(`  G${grade} ${subject}: attempted=${b.attempted} saved=${b.passed} skipped=${b.skippedDuplicates} failed=${b.failed}`);
        if (Object.keys(b.failureReasons).length > 0) {
          console.log(`    failures:`, b.failureReasons);
        }
      } else {
        console.log(`  G${grade} ${subject}: no batch produced — check NATIONAL_MAP`);
      }
    }
  }

  if (!isDryRun) {
    console.log("\n--- Quality gate ---");
    const { failed, total } = await runQualityGate();
    const passedCount = total - failed.length;
    console.log(`  Total pending (ncf-2026.1, gap combos): ${total}`);
    console.log(`  Passed: ${passedCount}`);
    console.log(`  Failed: ${failed.length}`);
    if (failed.length > 0) {
      for (const f of failed.slice(0, 10)) console.log(`    FAIL: ${f}`);
    }

    if (doApprove) {
      if (total === 0) {
        console.log("\n  No pending lessons found to approve for these combos.");
      } else {
        if (failed.length > 0) {
          console.log(`\n  ${failed.length} lesson(s) failed quality gate — approving only the ${passedCount} that passed.`);
          process.exitCode = 1;
        }
        const approvedCount = await approveSafely(failed);
        console.log(`\n  Approved: ${approvedCount} lessons`);

        if (approvedCount > 0) {
          await (prisma as any).auditLog.create({
            data: {
              action: "GAP_CLOSURE_APPROVED",
              resourceType: "CurriculumContent",
              resourceId: "gap-closure-G5-CIVICS-G6-CIVICS-G5-CS",
              details: {
                actor: "system",
                actorRole: "ADMIN",
                reason: "Structural gap closure: G5 CIVICS, G6 CIVICS, G5 COMPUTER_SCIENCE",
                combos: GAP_COMBOS,
                approvedCount,
                failedCount: failed.length,
                skippedContentIds: failed,
                approvedAt: new Date().toISOString(),
                version: "ncf-2026.1",
              },
            },
          });
          console.log("  Audit log written.");
        }
      }
    }
  }

  console.log("\n--- Post-run audit (NATIONAL_MAP combos) ---");
  const audit = await auditNationalCoverage();
  const gapEntries = audit.entries.filter(e =>
    GAP_COMBOS.some(c => c.grade === e.grade && c.subject === e.subject)
  );
  for (const e of gapEntries) {
    console.log(`  G${e.grade} ${e.subject}: approved=${e.approved} pending=${e.pending} severity=${e.severity}`);
  }

  const allGaps = audit.entries.filter(e => e.approved < 10);
  if (allGaps.length === 0) {
    console.log("\n  ALL grade/subject combos have 10+ approved lessons.");
  } else {
    console.log(`\n  Remaining gaps (< 10 approved, ${allGaps.length} combos):`);
    for (const e of allGaps) {
      console.log(`    G${e.grade} ${e.subject}: ${e.approved} approved`);
    }
  }

  await prisma.$disconnect();
}

// Guard prevents main() from running when this file is imported by tests
if (!process.env.VITEST) {
  main().catch(err => { console.error(err); prisma.$disconnect(); process.exit(1); });
}
