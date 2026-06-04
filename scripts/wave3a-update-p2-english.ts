if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { prisma } from "../lib/prisma";

async function main() {
  const r = await prisma.timetable.updateMany({
    where: { classId: "cha-class-grade9a", periodLabel: { contains: "Period 2" } },
    data: { subject: "ENGLISH" },
  });
  console.log("Updated P2 entries:", r.count);

  const entries = await prisma.timetable.findMany({
    where: { classId: "cha-class-grade9a" },
    select: { periodLabel: true, subject: true },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  entries.forEach((e) => console.log(e.periodLabel, "|", e.subject));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
