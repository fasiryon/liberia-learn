/**
 * scripts/backfill-demo-dates.ts
 *
 * NR-PILOT-CRITICAL: Demo date refresh
 *
 * Rolls demo data forward so the Today page shows live content.
 * For cha-class-grade9a: driven by TimetableEntry rows — one ScheduledWork
 * per non-break period per school day, with proper startTime/endTime.
 * For other pool classes: one SW per class per day (backward-compat).
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

const UTC_DAY_TO_WEEKDAY: Record<number, string> = {
  1: "MONDAY",
  2: "TUESDAY",
  3: "WEDNESDAY",
  4: "THURSDAY",
  5: "FRIDAY",
};

const BREAK_LABEL_RE = /break|lunch|recess|assembly/i;

// No period overrides needed — ENGLISH is now a native Subject enum value.
// P2 uses subject=ENGLISH which resolves to the ENGLISH G7 hero via normal lookup.
const TIMETABLE_PERIOD_CONTENT_OVERRIDE: Record<number, string> = {};

function parsePeriodNumber(label: string | null | undefined): number | null {
  if (!label) return null;
  // Match "Period N" pattern first, fall back to first digit
  const m = label.match(/\bperiod\s+(\d+)\b/i) ?? label.match(/(\d+)/);
  return m ? parseInt(m[1] ?? m[0], 10) : null;
}

// For each Timetable subject, define content lookup order.
// Tries each subject string against the DB in order.
const CONTENT_SUBJECT_CHAIN: Record<string, string[]> = {
  MATH: ["MATH"],
  LITERACY: ["LITERACY", "ENGLISH"],
  ENGLISH: ["ENGLISH", "LITERACY"],
  SCIENCE: ["SCIENCE"],
  CIVICS: ["CIVICS", "SOCIAL_STUDIES"],
  COMPUTER_SCIENCE: ["COMPUTER_SCIENCE"],
  ENGINEERING: ["ENGINEERING"],
  ARTS: ["ARTS"],
  PE: ["PE"],
  CAREER: ["CAREER"],
};

// Grade preference order for content lookup (closest to G7 first)
const GRADE_PREFERENCE = [7, 6, 8, 5, 9, 10, 2, 3, 4, 11, 12, 1];

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
  console.log("▶ NR-PILOT-CRITICAL: backfill-demo-dates (WAVE-1C revision)");

  const schoolDays = nextSchoolDays(7);
  console.log(`  School days: ${schoolDays.map(d => d.toISOString().slice(0, 10)).join(", ")}`);

  const demoSchoolIds = ["school-cha"];

  const [demoClasses, teacherMap] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId: { in: demoSchoolIds } },
      select: {
        id: true, name: true, subject: true, gradeLevel: true, teacherId: true, schoolId: true,
        timetableEntries: {
          select: {
            id: true, dayOfWeek: true, periodLabel: true, startTime: true, endTime: true, subject: true
          }
        }
      },
    }),
    prisma.user.findMany({
      where: { schoolId: { in: demoSchoolIds }, role: "TEACHER" },
      select: { id: true, schoolId: true },
    }),
  ]);

  console.log(`  Classes found: ${demoClasses.length}`);

  const teacherBySchool = new Map(teacherMap.map(t => [t.schoolId, t.id]));

  // ── Pre-fetch all hero content indexed by subject:grade ──────────────────

  const allHeroContent = await prisma.curriculumContent.findMany({
    where: { isHero: true, status: { in: ["APPROVED", "published"] } },
    select: { contentId: true, subject: true, grade: true },
    orderBy: { createdAt: "asc" },
  });

  // Group by "subject:grade" → contentId[]
  const heroIndex = new Map<string, string[]>();
  for (const c of allHeroContent) {
    const key = `${c.subject}:${c.grade}`;
    if (!heroIndex.has(key)) heroIndex.set(key, []);
    heroIndex.get(key)!.push(c.contentId);
  }

  // V1 fallback: any approved content grouped by subject:grade
  const allV1Content = await prisma.curriculumContent.findMany({
    where: { isHero: false, status: { in: ["APPROVED", "published"] } },
    select: { contentId: true, subject: true, grade: true },
    take: 500,
    orderBy: { createdAt: "asc" },
  });
  const v1Index = new Map<string, string[]>();
  for (const c of allV1Content) {
    const key = `${c.subject}:${c.grade}`;
    if (!v1Index.has(key)) v1Index.set(key, []);
    v1Index.get(key)!.push(c.contentId);
  }

  /** Find best contentId for a subject, cycling by dayIndex for variety. */
  function findContent(subject: string, dayIndex: number): { contentId: string; isHero: boolean } | null {
    const chain = CONTENT_SUBJECT_CHAIN[subject] ?? [subject];

    // 1. Hero content: try each subject alias, each grade in preference order
    for (const subj of chain) {
      for (const grade of GRADE_PREFERENCE) {
        const ids = heroIndex.get(`${subj}:${grade}`);
        if (ids && ids.length > 0) {
          return { contentId: ids[dayIndex % ids.length], isHero: true };
        }
      }
    }

    // 2. V1 fallback
    for (const subj of chain) {
      for (const grade of GRADE_PREFERENCE) {
        const ids = v1Index.get(`${subj}:${grade}`);
        if (ids && ids.length > 0) {
          return { contentId: ids[dayIndex % ids.length], isHero: false };
        }
      }
    }

    return null;
  }

  // ── Identify timetable-driven class (cha-class-grade9a) ────────────────────

  const TIMETABLE_CLASS_ID = "cha-class-grade9a";
  const timetableClass = demoClasses.find(c => c.id === TIMETABLE_CLASS_ID);
  const poolClasses = demoClasses.filter(c => c.id !== TIMETABLE_CLASS_ID);

  // ── Delete stale future SW (no progress) for all demo classes ─────────────

  const allClassIds = demoClasses.map(c => c.id);
  const futureStart = schoolDays[0];

  const deleted = await prisma.scheduledWork.deleteMany({
    where: {
      classId: { in: allClassIds },
      scheduledDate: { gte: futureStart },
      progress: { none: {} },
    },
  });
  console.log(`  ✓ Cleared stale future SW (no progress): ${deleted.count}`);

  const swToCreate: {
    classId: string;
    contentId: string;
    scheduledDate: Date;
    createdById: string;
    status: string;
    periodNumber?: number;
    startTime?: string;
    endTime?: string;
  }[] = [];

  // ── Build SW for timetable-driven class ───────────────────────────────────

  if (timetableClass && timetableClass.timetableEntries.length > 0) {
    const teacherId = timetableClass.teacherId ?? teacherBySchool.get(timetableClass.schoolId) ?? "";

    if (!teacherId) {
      console.log(`  ⚠ No teacher for ${TIMETABLE_CLASS_ID}`);
    } else {
      // Group timetable entries by weekday
      const byWeekday = new Map<string, typeof timetableClass.timetableEntries>();
      for (const entry of timetableClass.timetableEntries) {
        const day = entry.dayOfWeek as string;
        if (!byWeekday.has(day)) byWeekday.set(day, []);
        byWeekday.get(day)!.push(entry);
      }

      // Sort each day's entries by startTime
      for (const entries of byWeekday.values()) {
        entries.sort((a, b) => {
          const ta = a.startTime ?? "99:99";
          const tb = b.startTime ?? "99:99";
          return ta.localeCompare(tb);
        });
      }

      let totalPeriods = 0;

      for (let dayIdx = 0; dayIdx < schoolDays.length; dayIdx++) {
        const schoolDay = schoolDays[dayIdx];
        const weekday = UTC_DAY_TO_WEEKDAY[schoolDay.getUTCDay()];
        const entries = byWeekday.get(weekday) ?? [];

        // Per-day per-subject counter: duplicate-subject periods (e.g. P2 + P6
        // both LITERACY) get different hero slots via an incremented offset.
        const subjectUseCount = new Map<string, number>();

        for (const entry of entries) {
          // Skip break/lunch periods
          if (BREAK_LABEL_RE.test(entry.periodLabel)) continue;

          const periodNum = parsePeriodNumber(entry.periodLabel);
          const subject = entry.subject as string;
          const useCount = subjectUseCount.get(subject) ?? 0;
          subjectUseCount.set(subject, useCount + 1);

          // dayIdx * 10 + useCount: unique cycle index per day per occurrence
          const pinnedId = periodNum != null ? TIMETABLE_PERIOD_CONTENT_OVERRIDE[periodNum] : undefined;
          const content = pinnedId
            ? { contentId: pinnedId, isHero: true }
            : findContent(subject, dayIdx * 10 + useCount);

          if (!content) {
            console.log(`  ⚠ No content for ${entry.subject} (${entry.periodLabel}) on ${weekday}`);
            continue;
          }

          swToCreate.push({
            classId: TIMETABLE_CLASS_ID,
            contentId: content.contentId,
            scheduledDate: schoolDay,
            createdById: teacherId,
            status: "confirmed",
            ...(periodNum != null ? { periodNumber: periodNum } : {}),
            ...(entry.startTime ? { startTime: entry.startTime } : {}),
            ...(entry.endTime ? { endTime: entry.endTime } : {}),
          });

          if (dayIdx === 0) {
            console.log(
              `  ✓ ${weekday} P${periodNum ?? "?"} ${entry.startTime ?? "??"}-${entry.endTime ?? "??"} | ${entry.subject} | ${content.isHero ? "HERO" : "V1"}`
            );
          }
          totalPeriods++;
        }
      }

      console.log(`  ✓ Timetable-driven SW planned: ${totalPeriods} (${schoolDays.length} days × ${totalPeriods / schoolDays.length} periods/day avg)`);
    }
  } else {
    console.log(`  ⚠ ${TIMETABLE_CLASS_ID} not found or has no timetable entries — skipping timetable-driven SW`);
  }

  // ── Build SW for pool classes (one per class per day, dedup by subject×date) ─

  const usedSubjectDates = new Set<string>();

  for (const cls of poolClasses) {
    const subject = cls.subject as string;
    const grade = cls.gradeLevel ?? null;
    const key = `${subject}:${grade ?? "any"}`;

    const teacherId = cls.teacherId ?? teacherBySchool.get(cls.schoolId) ?? "";
    if (!teacherId) continue;

    for (let i = 0; i < schoolDays.length; i++) {
      const scheduledDate = schoolDays[i];
      const dateStr = scheduledDate.toISOString().slice(0, 10);
      const subjectDateKey = `${subject}:${dateStr}`;
      if (usedSubjectDates.has(subjectDateKey)) continue;
      usedSubjectDates.add(subjectDateKey);

      // For pool classes, search hero for exact grade first, then any
      let contentId: string | null = null;
      let chain = CONTENT_SUBJECT_CHAIN[subject] ?? [subject];

      const grades = grade != null
        ? [grade, ...GRADE_PREFERENCE.filter(g => g !== grade)]
        : GRADE_PREFERENCE;

      for (const subj of chain) {
        for (const g of grades) {
          const ids = heroIndex.get(`${subj}:${g}`);
          if (ids && ids.length > 0) { contentId = ids[i % ids.length]; break; }
        }
        if (contentId) break;
      }

      if (!contentId) {
        for (const subj of chain) {
          for (const g of grades) {
            const ids = v1Index.get(`${subj}:${g}`);
            if (ids && ids.length > 0) { contentId = ids[i % ids.length]; break; }
          }
          if (contentId) break;
        }
      }

      if (!contentId) {
        console.log(`  ⚠ No content for ${key} (${cls.name})`);
        continue;
      }

      swToCreate.push({
        classId: cls.id,
        contentId,
        scheduledDate,
        createdById: teacherId,
        status: "confirmed",
        periodNumber: i + 1,
      });
    }
  }

  // ── Create all SW records ──────────────────────────────────────────────────

  const swResult = await prisma.scheduledWork.createMany({
    data: swToCreate,
    skipDuplicates: true,
  });
  console.log(`  ✓ ScheduledWork created: ${swResult.count}`);

  // ── Roll Assignment.dueAt forward ─────────────────────────────────────────

  const pastAssignments = await prisma.assignment.findMany({
    where: {
      classId: { in: allClassIds },
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

  // ── Roll Homework.dueAt forward + populate questions ─────────────────────

  const homework = await prisma.homework.findMany({
    where: { classId: { in: allClassIds } },
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

  console.log("\n✅ Done. student1@cha.edu.lr should now see a properly structured school day.");
  console.log("   Each period has a real start time and a hero lesson assigned.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
