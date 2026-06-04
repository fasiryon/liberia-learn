/**
 * WAVE-1C fix: change Period 6 on cha-class-grade9a from CIVICS to LITERACY
 * (displayed as "ENGLISH" in the period label).
 */
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { prisma } from "../lib/prisma";

async function main() {
  const result = await (prisma as any).timetable.updateMany({
    where: {
      classId: "cha-class-grade9a",
      periodLabel: "Period 6 - CIVICS",
    },
    data: {
      subject: "LITERACY",
      periodLabel: "Period 6 - ENGLISH",
    },
  });

  console.log(`Updated ${result.count} Period 6 timetable entries → LITERACY (ENGLISH)`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
