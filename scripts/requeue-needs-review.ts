// Finds all NEEDS_REVIEW lessons and creates CurriculumRegenerationJob records
// so process-regen-jobs-direct.ts can regenerate them.
//
// Does NOT call enqueueJob (no SQS) and does NOT check isCurriculumRegenQueueEnabled.
// Works as a pure DB-based queuing step for the direct script pipeline.
//
// Usage:
//   npx dotenv -e .env.production -- npx tsx scripts/requeue-needs-review.ts
//   npx dotenv -e .env.production -- npx tsx scripts/requeue-needs-review.ts --dry-run
//   npx dotenv -e .env.production -- npx tsx scripts/requeue-needs-review.ts --grades=2,9
//   npx dotenv -e .env.production -- npx tsx scripts/requeue-needs-review.ts --grades=2,9 --subjects=MATH,SCIENCE
//   npx dotenv -e .env.production -- npx tsx scripts/requeue-needs-review.ts --limit 50

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { createHash } from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hasFlag(flag: string) {
  return process.argv.includes(flag);
}

function readArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readNumberArg(flag: string): number | undefined {
  const v = readArg(flag);
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : undefined;
}

function readListArg(prefix: string): string[] | null {
  const entry = process.argv.find((a) => a.startsWith(prefix));
  if (!entry) return null;
  return entry.replace(prefix, "").split(",").map((s) => s.trim()).filter(Boolean);
}

function buildIdempotencyKey(runId: string, contentId: string, grade: number, subject: string) {
  return createHash("sha256")
    .update(`${runId}:${grade}:${subject.toUpperCase()}:${contentId}`)
    .digest("hex");
}

function extractWordCount(payload: unknown): number {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return 0;
  const p = payload as Record<string, unknown>;
  const text =
    (typeof p.lessonContent === "string" ? p.lessonContent : "") ||
    (typeof p.content === "string" ? p.content : "") ||
    (typeof p.body_standard === "string" ? p.body_standard : "") ||
    (typeof p.body === "string" ? p.body : "");
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function inferTopic(row: { title: string | null; grade: number; subject: string; contentId: string; payload: unknown }): string {
  const p = row.payload as { metadata?: { topic?: string } } | null;
  return (
    row.title?.trim() ||
    p?.metadata?.topic?.trim() ||
    `${row.subject.replace(/_/g, " ")} Grade ${row.grade}`
  );
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const limit = readNumberArg("--limit");

  const gradeArg = readListArg("--grades=");
  const subjectArg = readListArg("--subjects=");

  // Normalise grade numbers — accept "G2" or "2"
  const gradeFilter = gradeArg
    ? gradeArg.map((g) => parseInt(g.replace(/^G/i, ""), 10)).filter((n) => Number.isFinite(n))
    : null;
  const subjectFilter = subjectArg ? subjectArg.map((s) => s.toUpperCase()) : null;

  console.log(`\n[REQUEUE] NEEDS_REVIEW Requeue Script`);
  console.log(`[REQUEUE] mode     : ${dryRun ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`[REQUEUE] grades   : ${gradeFilter ? `G${gradeFilter.join(", G")}` : "all"}`);
  console.log(`[REQUEUE] subjects : ${subjectFilter ? subjectFilter.join(", ") : "all"}`);
  console.log(`[REQUEUE] limit    : ${limit ?? "none"}\n`);

  const lessons = await prisma.curriculumContent.findMany({
    where: {
      status: "NEEDS_REVIEW",
      contentType: "lesson",
      ...(gradeFilter ? { grade: { in: gradeFilter } } : {}),
      ...(subjectFilter ? { subject: { in: subjectFilter } } : {}),
    },
    orderBy: [{ grade: "asc" }, { subject: "asc" }, { updatedAt: "asc" }],
    ...(limit ? { take: limit } : {}),
    select: {
      contentId: true,
      title: true,
      grade: true,
      subject: true,
      payload: true,
    },
  });

  if (lessons.length === 0) {
    console.log("[REQUEUE] No NEEDS_REVIEW lessons found matching filters. Nothing to queue.");
    await prisma.$disconnect();
    return;
  }

  // Word count profile
  const stubs = lessons.filter((l) => extractWordCount(l.payload) < 100);
  const thin = lessons.filter((l) => {
    const w = extractWordCount(l.payload);
    return w >= 100 && w < 500;
  });
  const candidates = lessons.filter((l) => extractWordCount(l.payload) >= 500);

  console.log(`[REQUEUE] Found ${lessons.length} NEEDS_REVIEW lessons:`);
  console.log(`          Stubs (<100 words) : ${stubs.length} — need full generation`);
  console.log(`          Thin (100-499)     : ${thin.length} — regen will rebuild`);
  console.log(`          Regen candidates   : ${candidates.length} — will be regenerated\n`);

  // Grade breakdown
  const byGrade = new Map<number, number>();
  for (const l of lessons) byGrade.set(l.grade, (byGrade.get(l.grade) ?? 0) + 1);
  console.log(`[REQUEUE] By grade:`);
  for (const [grade, count] of [...byGrade.entries()].sort((a, b) => a[0] - b[0])) {
    console.log(`          G${grade}: ${count}`);
  }
  console.log();

  if (dryRun) {
    console.log("[REQUEUE] DRY RUN complete. No DB writes performed.");
    console.log(`[REQUEUE] Would queue ${lessons.length} lessons for regeneration.`);
    await prisma.$disconnect();
    return;
  }

  // Create regeneration run
  const run = await prisma.curriculumRegenerationRun.create({
    data: {
      status: "pending",
      targetStatus: "NEEDS_REVIEW",
      totalPlanned: lessons.length,
    },
  });
  console.log(`[REQUEUE] Created run: ${run.id}`);

  // Group by grade+subject for checkpoints
  const groups = new Map<string, { grade: number; subject: string; count: number }>();
  for (const l of lessons) {
    const key = `${l.grade}:${l.subject}`;
    const g = groups.get(key) ?? { grade: l.grade, subject: l.subject, count: 0 };
    g.count++;
    groups.set(key, g);
  }

  for (const g of groups.values()) {
    await prisma.curriculumRegenerationCheckpoint.upsert({
      where: { runId_gradeLevel_subject: { runId: run.id, gradeLevel: g.grade, subject: g.subject } },
      update: { plannedCount: g.count, status: "pending" },
      create: { runId: run.id, gradeLevel: g.grade, subject: g.subject, plannedCount: g.count, status: "pending" },
    });
  }

  // Create jobs
  let created = 0;
  let updated = 0;

  for (const lesson of lessons) {
    const idempotencyKey = buildIdempotencyKey(run.id, lesson.contentId, lesson.grade, lesson.subject);
    const result = await prisma.curriculumRegenerationJob.upsert({
      where: { idempotencyKey },
      update: { status: "pending", lastErrorCode: null, lastErrorMessage: null },
      create: {
        runId: run.id,
        curriculumContentId: lesson.contentId,
        gradeLevel: lesson.grade,
        subject: lesson.subject,
        topic: inferTopic(lesson),
        status: "pending",
        requestedBy: null,
        idempotencyKey,
      },
      select: { id: true, updatedAt: true, createdAt: true },
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  await prisma.curriculumRegenerationRun.update({
    where: { id: run.id },
    data: { status: "running" },
  });

  console.log(`[REQUEUE] Jobs created : ${created}`);
  console.log(`[REQUEUE] Jobs updated : ${updated}`);
  console.log(`[REQUEUE] Run ID       : ${run.id}`);
  console.log(`\n[REQUEUE] Done. Now run:`);
  console.log(`  npx dotenv -e .env.production -- npx tsx scripts/process-regen-jobs-direct.ts --limit 50`);
}

main().catch((err) => {
  console.error("[REQUEUE] Fatal:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
