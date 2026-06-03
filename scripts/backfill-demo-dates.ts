/**
 * scripts/backfill-demo-dates.ts
 *
 * NR-PILOT-CRITICAL: Demo date refresh
 *
 * All seeded ScheduledWork / Assignment / Homework records have hardcoded
 * dates from March–May 2026. Today is 2026-06-03+. This script rolls the
 * demo data forward so the Today page and Homework pages show live content.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/backfill-demo-dates.ts
 */

if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function nextSchoolDays(count: number): Date[] {
  const days: Date[] = [];
  const now = new Date();
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  while (days.length < count) {
    const dow = cursor.getUTCDay();
    if (dow >= 1 && dow <= 5) days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

const SAMPLE_QUESTIONS = [
  [
    "A farmer has 48 yams and divides them equally among 8 children. How many yams does each child receive?",
    "Calculate: 15 × 8 = ?",
    "A rectangle has length 12 cm and width 5 cm. What is its area in cm²?",
  ],
  [
    "If a class has 30 students and 18 are girls, what fraction are boys? Write as a simplified fraction.",
    "Simplify 12/16 to its lowest terms.",
    "A bus travels 60 km in 1.5 hours. What is its average speed in km/h?",
  ],
  [
    "What is 7² (seven squared)?",
    "A triangle has sides of 3 cm, 4 cm, and 5 cm. What is its perimeter?",
    "Round 4,786 to the nearest hundred.",
  ],
  [
    "Convert 3/4 to a decimal.",
    "If x + 12 = 20, what is the value of x?",
    "A shop sells 250 items on Monday and 320 on Tuesday. How many items in total?",
  ],
  [
    "What is 15% of 200?",
    "A square has a perimeter of 36 cm. What is the length of each side?",
    "Write 0.75 as a fraction in its simplest form.",
  ],
];

async function main() {
  console.log("▶ NR-PILOT-CRITICAL: backfill-demo-dates");

  const schoolDays = nextSchoolDays(7);
  console.log(`  School days: ${schoolDays.map(d => d.toISOString().slice(0, 10)).join(", ")}`);

  // ── 1. Gather demo school/class/teacher data ──────────────────────────────

  const demoSchoolIds = ["school-cha"];

  const [demoClasses, teacherMap] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: { in: demoSchoolIds } },
      select: { id: true, name: true, subject: true, gradeLevel: true, teacherId: true, schoolId: true },
    }),
    prisma.user.findMany({
      where: { schoolId: { in: demoSchoolIds }, role: "TEACHER" },
      select: { id: true, schoolId: true },
    }),
  ]);

  console.log(`  Classes found: ${demoClasses.length}`);

  const teacherBySchool = new Map(teacherMap.map(t => [t.schoolId, t.id]));

  // ── 2. Fetch approved content for each class (all at once) ────────────────

  // Build unique (subject, grade) pairs
  type Pair = { subject: string; grade: number | null };
  const pairs: Pair[] = demoClasses.map(c => ({ subject: c.subject as string, grade: c.gradeLevel }));

  // Fetch up to 10 approved content IDs for each unique subject
  const uniqueSubjects = [...new Set(pairs.map(p => p.subject))];
  const contentBySubjectGrade = new Map<string, string[]>();

  for (const cls of demoClasses) {
    const subject = cls.subject as string;
    const grade = cls.gradeLevel;
    const key = `${subject}:${grade ?? "any"}`;

    if (contentBySubjectGrade.has(key)) continue;

    const where = grade != null
      ? { subject: subject as any, grade, status: { in: ["APPROVED", "published"] } }
      : { subject: subject as any, status: { in: ["APPROVED", "published"] } };

    const rows = await prisma.curriculumContent.findMany({
      where: where as any,
      select: { contentId: true },
      take: 10,
      orderBy: { createdAt: "asc" },
    });

    contentBySubjectGrade.set(key, rows.map(r => r.contentId));
  }

  // ── 3. Build ScheduledWork create-data ─────────────────────────────────────

  // Find existing SW for these classes in the next 14 days to skip duplicates
  const futureStart = schoolDays[0];
  const futureEnd = new Date(futureStart.getTime() + 14 * 86400000);

  const existingSW = await prisma.scheduledWork.findMany({
    where: {
      classId: { in: demoClasses.map(c => c.id) },
      scheduledDate: { gte: futureStart, lt: futureEnd },
    },
    select: { classId: true, scheduledDate: true, contentId: true },
  });

  const existingKeys = new Set(existingSW.map(sw =>
    `${sw.classId}:${sw.scheduledDate.toISOString().slice(0, 10)}:${sw.contentId}`
  ));

  const swToCreate: {
    classId: string;
    contentId: string;
    scheduledDate: Date;
    createdById: string;
    status: string;
    periodNumber: number;
  }[] = [];

  for (const cls of demoClasses) {
    const subject = cls.subject as string;
    const key = `${subject}:${cls.gradeLevel ?? "any"}`;
    const contentIds = contentBySubjectGrade.get(key) ?? [];

    if (contentIds.length === 0) {
      console.log(`  ⚠ No approved content for ${cls.id} (${subject} grade ${cls.gradeLevel})`);
      continue;
    }

    const createdById =
      cls.teacherId ??
      teacherBySchool.get(cls.schoolId) ??
      "";

    if (!createdById) {
      console.log(`  ⚠ No teacher found for class ${cls.id}`);
      continue;
    }

    for (let i = 0; i < schoolDays.length; i++) {
      const scheduledDate = schoolDays[i];
      const contentId = contentIds[i % contentIds.length];
      const swKey = `${cls.id}:${scheduledDate.toISOString().slice(0, 10)}:${contentId}`;

      if (existingKeys.has(swKey)) continue;

      swToCreate.push({
        classId: cls.id,
        contentId,
        scheduledDate,
        createdById,
        status: "confirmed",
        periodNumber: 1,
      });
    }
  }

  // createMany in one shot
  const swResult = await prisma.scheduledWork.createMany({
    data: swToCreate,
    skipDuplicates: true,
  });
  console.log(`  ✓ ScheduledWork created: ${swResult.count} (${swToCreate.length - swResult.count} skipped)`);

  // ── 4. Roll Assignment.dueAt forward ──────────────────────────────────────

  const pastAssignments = await prisma.assignment.findMany({
    where: {
      classId: { in: demoClasses.map(c => c.id) },
      dueAt: { lt: new Date() },
    },
    select: { id: true },
    orderBy: { dueAt: "asc" },
  });

  await Promise.all(
    pastAssignments.map((a, i) =>
      prisma.assignment.update({
        where: { id: a.id },
        data: { dueAt: new Date(schoolDays[i % schoolDays.length].getTime() + 6 * 3600_000) },
      })
    )
  );
  console.log(`  ✓ Assignment.dueAt rolled forward: ${pastAssignments.length}`);

  // ── 5. Roll Homework.dueAt forward + populate questions ───────────────────

  const homework = await prisma.homework.findMany({
    where: { classId: { in: demoClasses.map(c => c.id) } },
    select: { id: true, dueAt: true, questions: true },
    orderBy: { dueAt: "asc" },
  });

  await Promise.all(
    homework.map((hw, i) =>
      prisma.homework.update({
        where: { id: hw.id },
        data: {
          dueAt: new Date(schoolDays[i % schoolDays.length].getTime() + 6 * 3600_000),
          questions: hw.questions ?? (SAMPLE_QUESTIONS[i % SAMPLE_QUESTIONS.length] as any),
        },
      })
    )
  );
  console.log(`  ✓ Homework updated: ${homework.length} (dueAt + questions)`);

  console.log("\n✅ Done. student1@cha.edu.lr should now see lessons on the Today page.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
