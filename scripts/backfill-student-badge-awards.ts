import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BATCH_SIZE = 100;
let disconnectPrisma: (() => Promise<void>) | null = null;

function loadEnvFile(path: string, override = false) {
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (!override && process.env[key] != null) continue;

    process.env[key] = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  }
}

loadEnvFile(resolve(process.cwd(), ".env"));
loadEnvFile(resolve(process.cwd(), ".env.local"), true);

async function main() {
  console.log("[badge-backfill] Loading badge services");
  const [{ backfillStudentBadgeAwards }, { prisma }] = await Promise.all([
    import("@/lib/badges/studentBadges"),
    import("@/lib/db"),
  ]);
  disconnectPrisma = () => prisma.$disconnect();

  const limit = Number.parseInt(process.env.BACKFILL_BADGE_LIMIT ?? "", 10);
  const maxStudents = Number.isFinite(limit) && limit > 0 ? limit : null;
  console.log("[badge-backfill] Starting StudentBadgeAward backfill");
  if (maxStudents != null) {
    console.log(`[badge-backfill] Limit: ${maxStudents} student${maxStudents === 1 ? "" : "s"}`);
  }

  let processed = 0;
  let awarded = 0;
  let cursor: string | undefined;

  while (true) {
    const remaining = maxStudents == null ? BATCH_SIZE : Math.min(BATCH_SIZE, maxStudents - processed);
    if (remaining <= 0) break;

    const students = await prisma.student.findMany({
      take: remaining,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: { id: true },
    });

    if (students.length === 0) break;

    const result = await backfillStudentBadgeAwards(students.map((student) => student.id));
    processed += result.processed;
    awarded += result.awarded;
    cursor = students[students.length - 1]?.id;

    console.log(
      `[badge-backfill] Processed ${processed} students; created ${awarded} badge award${awarded === 1 ? "" : "s"}`
    );
  }

  console.log(`[badge-backfill] Complete. Processed ${processed}; created ${awarded}.`);
}

main()
  .catch((error) => {
    console.error("[badge-backfill] Failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma?.();
  });
