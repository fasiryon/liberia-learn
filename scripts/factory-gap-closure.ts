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
import { generateNationalBatch, auditNationalCoverage, validatePayloadQuality } from "../lib/curriculum/nationalFactory";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GAP_COMBOS = [
  { grade: 5, subject: "CIVICS" },
  { grade: 6, subject: "CIVICS" },
  { grade: 5, subject: "COMPUTER_SCIENCE" },
];

async function beforeCounts() {
  const rows: Array<{ grade: number; subject: string; _count: { id: number } }> = [];
  for (const { grade, subject } of GAP_COMBOS) {
    const count = await (prisma as any).curriculumContent.count({
      where: { grade, subject, status: "APPROVED" },
    });
    rows.push({ grade, subject, _count: { id: count } });
  }
  return rows;
}

async function runQualityGate() {
  const pending = await (prisma as any).curriculumContent.findMany({
    where: {
      status: "pending_approval",
      version: "ncf-2026.1",
      OR: GAP_COMBOS.map(({ grade, subject }) => ({ grade, subject })),
    },
    select: { id: true, contentId: true, grade: true, subject: true, payload: true },
    take: 500,
  });

  let passed = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const lesson of pending) {
    const payload = lesson.payload as Record<string, unknown>;
    const qr = validatePayloadQuality(payload);
    // Extra checks beyond the base gate
    const body = String(payload.body ?? "").toLowerCase();
    const hasLiberia = body.includes("liber");
    // Factory payloads use `teacherNote`; catalog payloads use `explanation` + body section
    const hasTeacherNote =
      (typeof payload.teacherNote === "string" && payload.teacherNote.length > 10) ||
      (typeof payload.explanation === "string" && payload.explanation.length > 10) ||
      body.includes("## teacher explanation") ||
      body.includes("## teacher notes");
    const hasAssessment = typeof payload.assessment === "string" && payload.assessment.length > 10;
    const hasExamples = Array.isArray(payload.workedExamples) && (payload.workedExamples as unknown[]).length > 0;

    if (!qr.passed) {
      failed++;
      failures.push(`G${lesson.grade} ${lesson.subject} ${lesson.contentId}: ${qr.reason}`);
    } else if (!hasLiberia) {
      failed++;
      failures.push(`G${lesson.grade} ${lesson.subject} ${lesson.contentId}: missing_liberian_context`);
    } else if (!hasTeacherNote) {
      failed++;
      failures.push(`G${lesson.grade} ${lesson.subject} ${lesson.contentId}: missing_teacher_note`);
    } else if (!hasAssessment) {
      failed++;
      failures.push(`G${lesson.grade} ${lesson.subject} ${lesson.contentId}: missing_assessment`);
    } else if (!hasExamples) {
      failed++;
      failures.push(`G${lesson.grade} ${lesson.subject} ${lesson.contentId}: missing_examples`);
    } else {
      passed++;
    }
  }

  return { total: pending.length, passed, failed, failures, lessons: pending };
}

async function approveSafely() {
  const result = await (prisma as any).curriculumContent.updateMany({
    where: {
      status: "pending_approval",
      version: "ncf-2026.1",
      OR: GAP_COMBOS.map(({ grade, subject }) => ({ grade, subject })),
    },
    data: { status: "APPROVED", updatedAt: new Date() },
  });
  return result.count as number;
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
    const gate = await runQualityGate();
    console.log(`  Total pending (ncf-2026.1, gap combos): ${gate.total}`);
    console.log(`  Passed: ${gate.passed}`);
    console.log(`  Failed: ${gate.failed}`);
    if (gate.failures.length > 0) {
      for (const f of gate.failures.slice(0, 10)) console.log(`    FAIL: ${f}`);
    }

    if (doApprove) {
      if (gate.failed > 0) {
        console.log(`\n  Approval BLOCKED — ${gate.failed} lesson(s) failed quality gate.`);
        process.exitCode = 1;
      } else if (gate.total === 0) {
        console.log("\n  No pending lessons found to approve for these combos.");
      } else {
        const approvedCount = await approveSafely();
        console.log(`\n  Approved: ${approvedCount} lessons`);

        // Audit log
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
              approvedAt: new Date().toISOString(),
              version: "ncf-2026.1",
            },
          },
        });
        console.log("  Audit log written.");
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

main().catch(err => { console.error(err); prisma.$disconnect(); process.exit(1); });
