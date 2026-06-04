/**
 * WAVE-1C: Add Period 5 ENGINEERING timetable slot to cha-class-grade9a
 * for all 5 weekdays (Mon-Fri), 11:15-12:00.
 *
 * Also adds Period 6 CIVICS (13:00-13:45) to fill the gap before Period 7.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/wave1c-add-engineering-period.ts
 */
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { prisma } from "../lib/prisma";

const CLASS_ID = "cha-class-grade9a";
const SCHOOL_ID = "school-cha";
const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;

const NEW_PERIODS = [
  { periodLabel: "Period 5 - ENGINEERING", subject: "ENGINEERING", startTime: "11:15", endTime: "12:00" },
  { periodLabel: "Period 6 - CIVICS", subject: "CIVICS", startTime: "13:00", endTime: "13:45" },
] as const;

async function main() {
  const cls = await prisma.class.findUnique({
    where: { id: CLASS_ID },
    select: { teacherId: true },
  });
  if (!cls?.teacherId) throw new Error(`Class ${CLASS_ID} not found or has no teacher`);

  console.log(`▶ Adding new timetable periods to ${CLASS_ID} (teacher=${cls.teacherId})`);

  let added = 0;
  let skipped = 0;

  for (const period of NEW_PERIODS) {
    for (const day of WEEKDAYS) {
      const existing = await (prisma as any).timetable.findFirst({
        where: { schoolId: SCHOOL_ID, classId: CLASS_ID, dayOfWeek: day, periodLabel: period.periodLabel },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await (prisma as any).timetable.create({
        data: {
          schoolId: SCHOOL_ID,
          classId: CLASS_ID,
          subject: period.subject,
          teacherId: cls.teacherId,
          dayOfWeek: day,
          periodLabel: period.periodLabel,
          startTime: period.startTime,
          endTime: period.endTime,
        },
      });
      console.log(`  ✓ ${day}: ${period.periodLabel} ${period.startTime}-${period.endTime}`);
      added++;
    }
  }

  console.log(`\n✅ Done. Added: ${added}, Already existed: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
