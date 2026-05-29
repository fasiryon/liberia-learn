/**
 * scripts/seed-prerequisites.ts  — NR-14B Phase 1
 *
 * Seeds LessonPrerequisite edges from CurriculumContent.
 * Logic: within each subject+grade, lessons ordered by `orderInUnit` form
 * a linear prerequisite chain (each lesson prerequisite = the previous one).
 *
 * Run:
 *   npx dotenv -e .env.production -- npx tsx scripts/seed-prerequisites.ts
 *
 * Flags:
 *   --dry-run   Print counts without writing
 *   --subject   Filter to one subject (e.g. --subject MATH)
 *   --grade     Filter to one grade (e.g. --grade 5)
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const subjectArg = args.find((a) => a.startsWith("--subject="))?.split("=")[1] ??
    (args.includes("--subject") ? args[args.indexOf("--subject") + 1] : undefined);
  const gradeArg = args.find((a) => a.startsWith("--grade="))?.split("=")[1] ??
    (args.includes("--grade") ? args[args.indexOf("--grade") + 1] : undefined);

  console.log(`🔗 NR-14B: seed-prerequisites ${dryRun ? "(DRY RUN)" : ""}`);

  // Fetch all APPROVED/published lessons with orderInUnit set, grouped by subject+grade+unitId
  const contents = await prisma.curriculumContent.findMany({
    where: {
      status: { in: ["published", "APPROVED"] },
      orderInUnit: { not: null },
      ...(subjectArg ? { subject: subjectArg } : {}),
      ...(gradeArg ? { grade: parseInt(gradeArg, 10) } : {}),
    },
    select: {
      id: true,
      subject: true,
      grade: true,
      unitId: true,
      orderInUnit: true,
    },
    orderBy: [{ subject: "asc" }, { grade: "asc" }, { unitId: "asc" }, { orderInUnit: "asc" }],
  });

  console.log(`  Found ${contents.length} lessons with orderInUnit`);

  // Group by subject + grade + unitId
  type ContentRow = typeof contents[number];
  const groups = new Map<string, ContentRow[]>();
  for (const c of contents) {
    const key = `${c.subject}:${c.grade}:${c.unitId ?? "none"}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  console.log(`  Groups (subject+grade+unit): ${groups.size}`);

  // Build prerequisite edges: within each group, lesson[i] prerequisite = lesson[i-1]
  const edges: Array<{ lessonId: string; prerequisiteLessonId: string; strength: string }> = [];
  for (const [key, lessons] of groups) {
    // Sort by orderInUnit ascending
    lessons.sort((a, b) => (a.orderInUnit ?? 0) - (b.orderInUnit ?? 0));
    for (let i = 1; i < lessons.length; i++) {
      edges.push({
        lessonId: lessons[i].id,
        prerequisiteLessonId: lessons[i - 1].id,
        strength: "recommended", // sequential order = recommended (not hard required)
      });
    }
    if (lessons.length > 1) {
      console.log(`  [${key}] ${lessons.length} lessons → ${lessons.length - 1} edges`);
    }
  }

  console.log(`\n  Total edges to upsert: ${edges.length}`);

  if (dryRun) {
    console.log("  DRY RUN — no writes performed.");
    return;
  }

  if (edges.length === 0) {
    console.log("  No edges to write (no lessons with orderInUnit found).");
    console.log("\n  ℹ️  Most lessons may not have orderInUnit set yet.");
    console.log("     The prerequisite graph will populate as content is ordered in units.");
    return;
  }

  // Upsert in batches of 100
  let created = 0;
  const BATCH = 100;
  for (let i = 0; i < edges.length; i += BATCH) {
    const batch = edges.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((e) =>
        prisma.lessonPrerequisite.upsert({
          where: {
            lessonId_prerequisiteLessonId: {
              lessonId: e.lessonId,
              prerequisiteLessonId: e.prerequisiteLessonId,
            },
          },
          create: e,
          update: { strength: e.strength },
        })
      )
    );
    created += results.length;
  }

  console.log(`\n  ✅ Upserted ${created} prerequisite edges`);
  console.log(`  Groups covered: ${groups.size}`);
}

main()
  .catch((e) => {
    console.error("seed-prerequisites failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
