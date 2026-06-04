/**
 * scripts/fix-demo-timetable.ts
 *
 * WAVE-1A Phase 3 fix: Remove duplicate-subject Timetable rows from demo classes.
 * For each (classId, dayOfWeek) combo, keeps only the FIRST period per subject.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/fix-demo-timetable.ts
 *   npx dotenv -e .env.production -- npx tsx scripts/fix-demo-timetable.ts --dry-run
 */

if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { PrismaClient } from "@prisma/client";
import { parseArgs } from "node:util";

const prisma = new PrismaClient();

const DEMO_CLASS_IDS = ["cha-class-grade9a", "cls-cha-math-0"];

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { "dry-run": { type: "boolean", default: false } },
    strict: false,
  });
  const dryRun = (values["dry-run"] as boolean) ?? false;

  console.log(`\n▶ fix-demo-timetable  dryRun=${dryRun}`);

  const rows = await prisma.timetable.findMany({
    where: { classId: { in: DEMO_CLASS_IDS } },
    select: { id: true, classId: true, subject: true, dayOfWeek: true, periodLabel: true, startTime: true, endTime: true },
    orderBy: [{ classId: "asc" }, { dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  if (rows.length === 0) {
    console.log("  No timetable rows found — nothing to fix.");
    return;
  }

  console.log(`  Total timetable rows: ${rows.length}`);

  // Group by classId+dayOfWeek, find duplicate subjects within each group
  const toDelete: string[] = [];
  const groupMap = new Map<string, typeof rows>();

  for (const row of rows) {
    const key = `${row.classId}:${row.dayOfWeek}`;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(row);
  }

  const BREAK_RE = /break|lunch|recess|assembly/i;

  for (const [groupKey, periods] of groupMap.entries()) {
    const seenSubjects = new Set<string>();
    const [classId, day] = groupKey.split(":");
    console.log(`\n  ${classId} | ${day}`);

    for (const period of periods) {
      const subj = period.subject as string;
      const isBreak = BREAK_RE.test(period.periodLabel ?? "");
      const flag = isBreak ? "BREAK-SKIP" : "";
      console.log(`    ${(period.startTime ?? "??").padEnd(5)}-${(period.endTime ?? "??").padEnd(5)} | ${subj.padEnd(22)} | ${period.periodLabel.padEnd(32)} ${flag}`);

      if (isBreak) continue; // never remove break rows — UI handles them by label

      if (seenSubjects.has(subj)) {
        console.log(`    ↳ DUPLICATE — will delete id: ${period.id}`);
        toDelete.push(period.id);
      } else {
        seenSubjects.add(subj);
      }
    }
  }

  console.log(`\n  Duplicate rows to remove: ${toDelete.length}`);

  if (dryRun || toDelete.length === 0) {
    if (dryRun) console.log("  [dry-run] No changes made.");
    if (toDelete.length === 0) console.log("  ✅ No duplicates found — timetable is already clean.");
    return;
  }

  const result = await prisma.timetable.deleteMany({
    where: { id: { in: toDelete } },
  });
  console.log(`\n✅ Removed ${result.count} duplicate timetable row(s).`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
