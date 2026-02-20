// lib/pilot-score.ts — Defensible Pilot Readiness Score (0-100)
import { prisma } from "@/lib/db";

export type ComponentScore = {
  name: string;
  score: number;
  max: number;
  detail: string;
};

export type PilotScoreResult = {
  total: number;
  components: ComponentScore[];
  grade: "A" | "B" | "C" | "D" | "F";
};

type PilotScoreStats = {
  classCount: number;
  meetingCount: number;
  classesWithContentCount: number;
  totalScheduled: number;
  totalCompleted: number;
  totalStudents: number;
  studentCount: number;
  guardianStudentCount: number;
  brandingSet: boolean;
  onboardingStep: number;
  teacherCount: number;
  classesWithStudentsCount: number;
};

function toGrade(total: number): "A" | "B" | "C" | "D" | "F" {
  if (total >= 90) return "A";
  if (total >= 75) return "B";
  if (total >= 60) return "C";
  if (total >= 40) return "D";
  return "F";
}

function computePilotScoreFromStats(stats: PilotScoreStats): PilotScoreResult {
  const components: ComponentScore[] = [];

  const attendancePct =
    stats.classCount > 0
      ? Math.min(stats.meetingCount / (stats.classCount * 5), 1)
      : 0;
  let attScore = 0;
  let attDetail = "";
  if (attendancePct >= 0.8) {
    attScore = 20;
    attDetail = `Attendance recorded for ${Math.round(attendancePct * 100)}% of class-days`;
  } else if (attendancePct >= 0.5) {
    attScore = 10;
    attDetail = `Attendance recorded for ${Math.round(attendancePct * 100)}% of class-days (need 80%+)`;
  } else {
    attScore = 0;
    attDetail = `Only ${Math.round(attendancePct * 100)}% attendance coverage this week`;
  }
  components.push({ name: "Attendance Coverage", score: attScore, max: 20, detail: attDetail });

  let curScore = 0;
  let curDetail = "";
  if (stats.classCount > 0 && stats.classesWithContentCount >= stats.classCount) {
    curScore = 20;
    curDetail = `All ${stats.classCount} classes have published lessons`;
  } else if (stats.classesWithContentCount > 0) {
    curScore = 10;
    curDetail = `${stats.classesWithContentCount}/${stats.classCount} classes have lessons (need all)`;
  } else {
    curScore = 0;
    curDetail = "No published lessons scheduled in the last 14 days";
  }
  components.push({ name: "Curriculum Adoption", score: curScore, max: 20, detail: curDetail });

  const expectedCompletions =
    stats.totalScheduled *
    Math.max(stats.totalStudents / Math.max(stats.classCount, 1), 1);
  const engagementPct = expectedCompletions > 0 ? stats.totalCompleted / expectedCompletions : 0;

  let engScore = 0;
  let engDetail = "";
  if (engagementPct >= 0.6) {
    engScore = 20;
    engDetail = `${Math.round(engagementPct * 100)}% completion rate this week`;
  } else if (engagementPct >= 0.3) {
    engScore = 10;
    engDetail = `${Math.round(engagementPct * 100)}% completion rate (need 60%+)`;
  } else {
    engScore = 0;
    engDetail = `${Math.round(engagementPct * 100)}% completion rate (need 30%+ for points)`;
  }
  components.push({ name: "Student Engagement", score: engScore, max: 20, detail: engDetail });

  const guardianPct =
    stats.studentCount > 0 ? stats.guardianStudentCount / stats.studentCount : 0;
  let guardScore = 0;
  let guardDetail = "";
  if (guardianPct >= 0.5) {
    guardScore = 20;
    guardDetail = `${Math.round(guardianPct * 100)}% of students have guardian links`;
  } else if (guardianPct >= 0.2) {
    guardScore = 10;
    guardDetail = `${Math.round(guardianPct * 100)}% guardian coverage (need 50%+)`;
  } else {
    guardScore = 0;
    guardDetail = `Only ${Math.round(guardianPct * 100)}% guardian coverage`;
  }
  components.push({ name: "Guardian Connection", score: guardScore, max: 20, detail: guardDetail });

  let setupScore = 0;
  const setupParts: string[] = [];

  if (stats.brandingSet) {
    setupScore += 5;
    setupParts.push("Branding set");
  } else {
    setupParts.push("No branding");
  }

  if (stats.onboardingStep >= 5) {
    setupScore += 5;
    setupParts.push("Onboarding complete");
  } else {
    setupParts.push("Onboarding incomplete");
  }

  if (stats.teacherCount > 0) {
    setupScore += 5;
    setupParts.push(`${stats.teacherCount} teacher(s)`);
  } else {
    setupParts.push("No teachers");
  }

  if (stats.classesWithStudentsCount > 0) {
    setupScore += 5;
    setupParts.push(`${stats.classesWithStudentsCount} class(es) with students`);
  } else {
    setupParts.push("No enrolled students");
  }

  components.push({ name: "Platform Setup", score: setupScore, max: 20, detail: setupParts.join(", ") });

  const total = components.reduce((sum, c) => sum + c.score, 0);
  return { total, components, grade: toGrade(total) };
}

export async function computePilotScore(schoolId: string): Promise<PilotScoreResult> {
  const components: ComponentScore[] = [];
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  // COMPONENT 1: Attendance Coverage (20 pts)
  const classes = await prisma.class.findMany({ where: { schoolId }, select: { id: true } });
  const classIds = classes.map((c) => c.id);

  const meetings = await prisma.meeting.findMany({
    where: { classId: { in: classIds }, startsAt: { gte: weekAgo } },
    select: { id: true },
  });

  // 5 school days in a week
  const attendancePct = classIds.length > 0 ? Math.min(meetings.length / (classIds.length * 5), 1) : 0;
  let attScore = 0;
  let attDetail = "";
  if (attendancePct >= 0.8) { attScore = 20; attDetail = `Attendance recorded for ${Math.round(attendancePct * 100)}% of class-days`; }
  else if (attendancePct >= 0.5) { attScore = 10; attDetail = `Attendance recorded for ${Math.round(attendancePct * 100)}% of class-days (need 80%+)`; }
  else { attScore = 0; attDetail = `Only ${Math.round(attendancePct * 100)}% attendance coverage this week`; }
  components.push({ name: "Attendance Coverage", score: attScore, max: 20, detail: attDetail });

  // COMPONENT 2: Curriculum Adoption (20 pts)
  const publishedContent = await prisma.curriculumContent.count({
    where: {
      status: "APPROVED",
      scheduledWork: { some: { classId: { in: classIds } } },
      updatedAt: { gte: twoWeeksAgo },
    },
  });

  const classesWithContent = await prisma.scheduledWork.groupBy({
    by: ["classId"],
    where: { classId: { in: classIds }, createdAt: { gte: twoWeeksAgo } },
  });

  let curScore = 0;
  let curDetail = "";
  if (classIds.length > 0 && classesWithContent.length >= classIds.length) {
    curScore = 20; curDetail = `All ${classIds.length} classes have published lessons`;
  } else if (classesWithContent.length > 0) {
    curScore = 10; curDetail = `${classesWithContent.length}/${classIds.length} classes have lessons (need all)`;
  } else {
    curScore = 0; curDetail = "No published lessons scheduled in the last 14 days";
  }
  components.push({ name: "Curriculum Adoption", score: curScore, max: 20, detail: curDetail });

  // COMPONENT 3: Student Engagement (20 pts)
  const totalScheduled = await prisma.scheduledWork.count({
    where: { classId: { in: classIds }, scheduledDate: { gte: weekAgo } },
  });
  const totalCompleted = await prisma.studentProgress.count({
    where: {
      completedAt: { not: null },
      scheduledWork: { classId: { in: classIds }, scheduledDate: { gte: weekAgo } },
    },
  });

  const totalStudents = await prisma.enrollment.count({ where: { classId: { in: classIds } } });
  const expectedCompletions = totalScheduled * Math.max(totalStudents / Math.max(classIds.length, 1), 1);
  const engagementPct = expectedCompletions > 0 ? totalCompleted / expectedCompletions : 0;

  let engScore = 0;
  let engDetail = "";
  if (engagementPct >= 0.6) { engScore = 20; engDetail = `${Math.round(engagementPct * 100)}% completion rate this week`; }
  else if (engagementPct >= 0.3) { engScore = 10; engDetail = `${Math.round(engagementPct * 100)}% completion rate (need 60%+)`; }
  else { engScore = 0; engDetail = `${Math.round(engagementPct * 100)}% completion rate (need 30%+ for points)`; }
  components.push({ name: "Student Engagement", score: engScore, max: 20, detail: engDetail });

  // COMPONENT 4: Guardian Connection (20 pts)
  const studentIds = (await prisma.enrollment.findMany({
    where: { classId: { in: classIds } },
    select: { studentId: true },
    distinct: ["studentId"],
  })).map((e) => e.studentId);

  const studentsWithGuardian = studentIds.length > 0
    ? await prisma.studentGuardian.groupBy({
        by: ["studentId"],
        where: { studentId: { in: studentIds } },
      })
    : [];

  const guardianPct = studentIds.length > 0 ? studentsWithGuardian.length / studentIds.length : 0;
  let guardScore = 0;
  let guardDetail = "";
  if (guardianPct >= 0.5) { guardScore = 20; guardDetail = `${Math.round(guardianPct * 100)}% of students have guardian links`; }
  else if (guardianPct >= 0.2) { guardScore = 10; guardDetail = `${Math.round(guardianPct * 100)}% guardian coverage (need 50%+)`; }
  else { guardScore = 0; guardDetail = `Only ${Math.round(guardianPct * 100)}% guardian coverage`; }
  components.push({ name: "Guardian Connection", score: guardScore, max: 20, detail: guardDetail });

  // COMPONENT 5: Platform Setup (20 pts, 5 each)
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { primaryHex: true, logoUrl: true, onboardingStep: true },
  });

  let setupScore = 0;
  const setupParts: string[] = [];

  // 5 pts: branding set
  if (school?.primaryHex || school?.logoUrl) { setupScore += 5; setupParts.push("Branding set"); }
  else setupParts.push("No branding");

  // 5 pts: onboarding complete
  if (school?.onboardingStep && school.onboardingStep >= 5) { setupScore += 5; setupParts.push("Onboarding complete"); }
  else setupParts.push("Onboarding incomplete");

  // 5 pts: at least 1 teacher
  const teacherCount = await prisma.user.count({ where: { schoolId, role: "TEACHER" } });
  if (teacherCount > 0) { setupScore += 5; setupParts.push(`${teacherCount} teacher(s)`); }
  else setupParts.push("No teachers");

  // 5 pts: at least 1 class with enrollments
  const classesWithStudents = await prisma.enrollment.groupBy({
    by: ["classId"],
    where: { classId: { in: classIds } },
  });
  if (classesWithStudents.length > 0) { setupScore += 5; setupParts.push(`${classesWithStudents.length} class(es) with students`); }
  else setupParts.push("No enrolled students");

  components.push({ name: "Platform Setup", score: setupScore, max: 20, detail: setupParts.join(", ") });

  const total = components.reduce((sum, c) => sum + c.score, 0);

  return { total, components, grade: toGrade(total) };
}

export async function computePilotScoresForSchools(
  schools: Array<{
    id: string;
    primaryHex: string | null;
    logoUrl: string | null;
    onboardingStep: number | null;
  }>
): Promise<Record<string, PilotScoreResult>> {
  if (schools.length === 0) return {};

  const schoolIds = schools.map((s) => s.id);
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  const classes = await prisma.class.findMany({
    where: { schoolId: { in: schoolIds } },
    select: { id: true, schoolId: true },
  });

  const classIdToSchool = new Map<string, string>();
  const classCountBySchool = new Map<string, number>();
  for (const cls of classes) {
    classIdToSchool.set(cls.id, cls.schoolId);
    classCountBySchool.set(cls.schoolId, (classCountBySchool.get(cls.schoolId) ?? 0) + 1);
  }

  const classIds = classes.map((c) => c.id);

  const meetings = classIds.length
    ? await prisma.meeting.groupBy({
        by: ["classId"],
        _count: { _all: true },
        where: { classId: { in: classIds }, startsAt: { gte: weekAgo } },
      })
    : [];
  const meetingCountBySchool = new Map<string, number>();
  for (const meeting of meetings) {
    const schoolId = classIdToSchool.get(meeting.classId);
    if (!schoolId) continue;
    meetingCountBySchool.set(
      schoolId,
      (meetingCountBySchool.get(schoolId) ?? 0) + meeting._count._all
    );
  }

  const classesWithContent = classIds.length
    ? await prisma.scheduledWork.groupBy({
        by: ["classId"],
        where: { classId: { in: classIds }, createdAt: { gte: twoWeeksAgo } },
      })
    : [];
  const classesWithContentBySchool = new Map<string, number>();
  for (const entry of classesWithContent) {
    const schoolId = classIdToSchool.get(entry.classId);
    if (!schoolId) continue;
    classesWithContentBySchool.set(
      schoolId,
      (classesWithContentBySchool.get(schoolId) ?? 0) + 1
    );
  }

  const scheduledWorkByClass = classIds.length
    ? await prisma.scheduledWork.groupBy({
        by: ["classId"],
        _count: { _all: true },
        where: { classId: { in: classIds }, scheduledDate: { gte: weekAgo } },
      })
    : [];
  const totalScheduledBySchool = new Map<string, number>();
  for (const entry of scheduledWorkByClass) {
    const schoolId = classIdToSchool.get(entry.classId);
    if (!schoolId) continue;
    totalScheduledBySchool.set(
      schoolId,
      (totalScheduledBySchool.get(schoolId) ?? 0) + entry._count._all
    );
  }

  const progress = classIds.length
    ? await prisma.studentProgress.findMany({
        where: {
          completedAt: { not: null },
          scheduledWork: { classId: { in: classIds }, scheduledDate: { gte: weekAgo } },
        },
        select: { scheduledWork: { select: { classId: true } } },
      })
    : [];
  const totalCompletedBySchool = new Map<string, number>();
  for (const record of progress) {
    const classId = record.scheduledWork?.classId;
    const schoolId = classId ? classIdToSchool.get(classId) : null;
    if (!schoolId) continue;
    totalCompletedBySchool.set(
      schoolId,
      (totalCompletedBySchool.get(schoolId) ?? 0) + 1
    );
  }

  const enrollments = classIds.length
    ? await prisma.enrollment.findMany({
        where: { classId: { in: classIds } },
        select: { classId: true, studentId: true },
      })
    : [];
  const totalStudentsBySchool = new Map<string, number>();
  const studentIdsBySchool = new Map<string, Set<string>>();
  const studentIdToSchool = new Map<string, string>();

  for (const enrollment of enrollments) {
    const schoolId = classIdToSchool.get(enrollment.classId);
    if (!schoolId) continue;
    totalStudentsBySchool.set(
      schoolId,
      (totalStudentsBySchool.get(schoolId) ?? 0) + 1
    );
    if (!studentIdsBySchool.has(schoolId)) {
      studentIdsBySchool.set(schoolId, new Set());
    }
    studentIdsBySchool.get(schoolId)!.add(enrollment.studentId);
    if (!studentIdToSchool.has(enrollment.studentId)) {
      studentIdToSchool.set(enrollment.studentId, schoolId);
    }
  }

  const allStudentIds = Array.from(studentIdToSchool.keys());
  const guardians = allStudentIds.length
    ? await prisma.studentGuardian.findMany({
        where: { studentId: { in: allStudentIds } },
        select: { studentId: true },
      })
    : [];
  const guardianStudentsBySchool = new Map<string, Set<string>>();
  for (const guardian of guardians) {
    const schoolId = studentIdToSchool.get(guardian.studentId);
    if (!schoolId) continue;
    if (!guardianStudentsBySchool.has(schoolId)) {
      guardianStudentsBySchool.set(schoolId, new Set());
    }
    guardianStudentsBySchool.get(schoolId)!.add(guardian.studentId);
  }

  const teacherCounts = await prisma.user.groupBy({
    by: ["schoolId"],
    _count: { _all: true },
    where: { schoolId: { in: schoolIds }, role: "TEACHER" },
  });
  const teacherCountBySchool = new Map<string, number>();
  for (const entry of teacherCounts) {
    if (!entry.schoolId) continue;
    teacherCountBySchool.set(entry.schoolId, entry._count._all);
  }

  const classesWithStudents = classIds.length
    ? await prisma.enrollment.groupBy({
        by: ["classId"],
        where: { classId: { in: classIds } },
      })
    : [];
  const classesWithStudentsBySchool = new Map<string, number>();
  for (const entry of classesWithStudents) {
    const schoolId = classIdToSchool.get(entry.classId);
    if (!schoolId) continue;
    classesWithStudentsBySchool.set(
      schoolId,
      (classesWithStudentsBySchool.get(schoolId) ?? 0) + 1
    );
  }

  const results: Record<string, PilotScoreResult> = {};
  for (const school of schools) {
    const classCount = classCountBySchool.get(school.id) ?? 0;
    const stats: PilotScoreStats = {
      classCount,
      meetingCount: meetingCountBySchool.get(school.id) ?? 0,
      classesWithContentCount: classesWithContentBySchool.get(school.id) ?? 0,
      totalScheduled: totalScheduledBySchool.get(school.id) ?? 0,
      totalCompleted: totalCompletedBySchool.get(school.id) ?? 0,
      totalStudents: totalStudentsBySchool.get(school.id) ?? 0,
      studentCount: studentIdsBySchool.get(school.id)?.size ?? 0,
      guardianStudentCount: guardianStudentsBySchool.get(school.id)?.size ?? 0,
      brandingSet: Boolean(school.primaryHex || school.logoUrl),
      onboardingStep: school.onboardingStep ?? 0,
      teacherCount: teacherCountBySchool.get(school.id) ?? 0,
      classesWithStudentsCount: classesWithStudentsBySchool.get(school.id) ?? 0,
    };

    results[school.id] = computePilotScoreFromStats(stats);
  }

  return results;
}
