/**
 * Sprint 6.1 Finding 1: backfill Student.humanReadableStudentId for existing
 * students created before this field existed. Idempotent - only touches rows
 * where the field is still null. Safe to re-run / resume after interruption.
 *
 * Run: npx dotenv -e .env.production -- npx tsx scripts/backfill-human-readable-student-id.ts [--limit N]
 */
import { PrismaClient } from "@prisma/client";
import { createUniqueHumanReadableStudentId } from "@/lib/students/humanReadableId";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`) || a === `--${name}`);
  if (!hit) return undefined;
  if (hit.includes("=")) return hit.split("=")[1];
  return process.argv[process.argv.indexOf(hit) + 1];
}

const BATCH_SIZE = 25; // carry-forward rule 3: DIRECT_URL batch writes <=25

async function main() {
  const limit = arg("limit") ? parseInt(arg("limit")!, 10) : undefined;
  const prisma = new PrismaClient();

  let processed = 0;
  let updated = 0;

  while (true) {
    if (limit && processed >= limit) break;

    const batch = await prisma.student.findMany({
      where: { humanReadableStudentId: null },
      select: { id: true },
      take: limit ? Math.min(BATCH_SIZE, limit - processed) : BATCH_SIZE,
    });
    if (batch.length === 0) break;

    for (const student of batch) {
      const humanReadableStudentId = await createUniqueHumanReadableStudentId(prisma);
      await prisma.student.update({
        where: { id: student.id },
        data: { humanReadableStudentId },
      });
      updated++;
    }

    processed += batch.length;
    console.log(`[backfill-human-readable-student-id] processed ${processed}${limit ? `/${limit}` : ""}`);
  }

  console.log(`[backfill-human-readable-student-id] done. updated ${updated} student(s).`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("backfill failed:", e?.message || e);
  process.exit(1);
});
