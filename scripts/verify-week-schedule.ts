// scripts/verify-week-schedule.ts — Verification script for full week curriculum
// Run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/verify-week-schedule.ts

// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getThisWeekDates(): Date[] {
  const now = new Date();
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + mondayOffset));
  return Array.from({ length: 5 }, (_, i) => new Date(monday.getTime() + i * 86400000));
}

async function main() {
  const weekDates = getThisWeekDates();
  const weekStart = weekDates[0];
  const weekEnd = new Date(weekDates[4].getTime() + 86400000);
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];

  console.log("=== LiberiaLearn Week Schedule Verification ===\n");
  console.log(`Week: ${weekStart.toISOString().slice(0, 10)} to ${weekDates[4].toISOString().slice(0, 10)}\n`);

  // 1. Count curriculum content
  const contentCount = await prisma.curriculumContent.count({
    where: { status: "APPROVED", contentId: { startsWith: "wk_" } },
  });
  console.log(`Curriculum Content: ${contentCount} (target: 130)`);
  console.log(contentCount >= 130 ? "  ✓ PASS" : "  ✗ FAIL — missing content");

  // 2. Count scheduled work
  const swCount = await prisma.scheduledWork.count({
    where: { scheduledDate: { gte: weekStart, lt: weekEnd } },
  });
  console.log(`\nScheduled Work: ${swCount} (target: 130)`);
  console.log(swCount >= 130 ? "  ✓ PASS" : "  ✗ FAIL — missing scheduled work");

  // 3. Count meetings
  const meetingCount = await prisma.meeting.count({
    where: { startsAt: { gte: weekStart, lt: weekEnd } },
  });
  console.log(`\nMeetings: ${meetingCount} (target: 18)`);
  console.log(meetingCount >= 18 ? "  ✓ PASS" : "  ✗ FAIL — missing meetings");

  // 4. Per-class schedule summary
  console.log("\n=== Class Schedule Summary ===");
  const classes = await prisma.class.findMany({
    select: { id: true, name: true, School: { select: { name: true } } },
    where: { id: { in: ["class_mca_7a", "class_mca_8b", "class_pcs_6a", "class_pcs_9a", "class_krs_5a", "class_krs_10a"] } },
  });

  for (const cls of classes) {
    const sw = await prisma.scheduledWork.findMany({
      where: { classId: cls.id, scheduledDate: { gte: weekStart, lt: weekEnd } },
      orderBy: [{ scheduledDate: "asc" }, { periodNumber: "asc" }],
      select: { scheduledDate: true, periodNumber: true, startTime: true, endTime: true, content: { select: { subject: true } } },
    });

    console.log(`\n${cls.School.name} — ${cls.name} (${sw.length} lessons):`);
    for (let d = 0; d < 5; d++) {
      const dayDate = weekDates[d];
      const daySw = sw.filter(s => {
        const sd = new Date(s.scheduledDate);
        sd.setUTCHours(0, 0, 0, 0);
        return sd.getTime() === dayDate.getTime();
      });
      const periods = daySw.map(s => `P${s.periodNumber}:${s.content.subject}(${s.startTime}-${s.endTime})`).join("  ");
      console.log(`  ${dayNames[d]}: ${periods || "(none)"}`);
    }
  }

  // 5. Pilot score estimation
  console.log("\n=== Pilot Score Estimates ===");
  const schools = [
    { id: "school_mca", name: "Monrovia Central Academy", targetMin: 80, targetMax: 90, grade: "B" },
    { id: "school_pcs", name: "Paynesville Community School", targetMin: 55, targetMax: 70, grade: "C" },
    { id: "school_krs", name: "Kakata Rural School", targetMin: 30, targetMax: 45, grade: "D" },
  ];

  for (const school of schools) {
    const schoolClasses = await prisma.class.findMany({ where: { schoolId: school.id }, select: { id: true } });
    const classIds = schoolClasses.map(c => c.id);

    // Attendance
    const meetings = await prisma.meeting.count({
      where: { classId: { in: classIds }, startsAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    });
    const attPct = classIds.length > 0 ? Math.min(meetings / (classIds.length * 5), 1) : 0;
    const attScore = attPct >= 0.8 ? 20 : attPct >= 0.5 ? 10 : 0;

    // Curriculum
    const classesWithContent = await prisma.scheduledWork.groupBy({
      by: ["classId"],
      where: { classId: { in: classIds }, createdAt: { gte: new Date(Date.now() - 14 * 86400000) } },
    });
    const curScore = classesWithContent.length >= classIds.length ? 20 : classesWithContent.length > 0 ? 10 : 0;

    // Engagement
    const totalSw = await prisma.scheduledWork.count({
      where: { classId: { in: classIds }, scheduledDate: { gte: new Date(Date.now() - 7 * 86400000) } },
    });
    const totalCompleted = await prisma.studentProgress.count({
      where: { completedAt: { not: null }, scheduledWork: { classId: { in: classIds }, scheduledDate: { gte: new Date(Date.now() - 7 * 86400000) } } },
    });
    const totalStudents = await prisma.enrollment.count({ where: { classId: { in: classIds } } });
    const expected = totalSw * Math.max(totalStudents / Math.max(classIds.length, 1), 1);
    const engPct = expected > 0 ? totalCompleted / expected : 0;
    const engScore = engPct >= 0.6 ? 20 : engPct >= 0.3 ? 10 : 0;

    // Guardians
    const studentIds = (await prisma.enrollment.findMany({
      where: { classId: { in: classIds } }, select: { studentId: true }, distinct: ["studentId"],
    })).map(e => e.studentId);
    const withGuardian = studentIds.length > 0
      ? await prisma.studentGuardian.groupBy({ by: ["studentId"], where: { studentId: { in: studentIds } } })
      : [];
    const guardPct = studentIds.length > 0 ? withGuardian.length / studentIds.length : 0;
    const guardScore = guardPct >= 0.5 ? 20 : guardPct >= 0.2 ? 10 : 0;

    // Setup
    const schoolData = await prisma.school.findUnique({
      where: { id: school.id }, select: { primaryHex: true, logoUrl: true, onboardingStep: true },
    });
    let setupScore = 0;
    if (schoolData?.primaryHex || schoolData?.logoUrl) setupScore += 5;
    if (schoolData?.onboardingStep && schoolData.onboardingStep >= 5) setupScore += 5;
    const teacherCount = await prisma.user.count({ where: { schoolId: school.id, role: "TEACHER" } });
    if (teacherCount > 0) setupScore += 5;
    const classesWithStudents = await prisma.enrollment.groupBy({ by: ["classId"], where: { classId: { in: classIds } } });
    if (classesWithStudents.length > 0) setupScore += 5;

    const total = attScore + curScore + engScore + guardScore + setupScore;
    const inRange = total >= school.targetMin && total <= school.targetMax;

    console.log(`\n${school.name} (target: ${school.grade} ${school.targetMin}-${school.targetMax}):`);
    console.log(`  Attendance: ${attScore}/20 (${Math.round(attPct * 100)}% coverage, ${meetings} meetings)`);
    console.log(`  Curriculum: ${curScore}/20 (${classesWithContent.length}/${classIds.length} classes)`);
    console.log(`  Engagement: ${engScore}/20 (${Math.round(engPct * 100)}% completion)`);
    console.log(`  Guardian:   ${guardScore}/20 (${Math.round(guardPct * 100)}% linked)`);
    console.log(`  Setup:      ${setupScore}/20`);
    console.log(`  TOTAL:      ${total}/100 ${inRange ? "✓ IN RANGE" : "✗ OUT OF RANGE"}`);
  }

  console.log("\n=== Verification Complete ===");
}

main()
  .catch((e) => { console.error("Verification error:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
