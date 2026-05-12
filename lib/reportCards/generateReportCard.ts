import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { ReportCard } from "@prisma/client";

export type SubjectGrade = {
  subject: string;
  average: number;
  assignmentCount: number;
  examScore?: number;
  masteryScore?: number;
};

export type AttendanceSummary = {
  totalDays: number;
  present: number;
  absent: number;
  late: number;
  rate: number;
};

export async function generateReportCard(
  studentId: string,
  termId: string,
  classId: string,
  createdBy: string
): Promise<ReportCard> {
  const term = await prisma.term.findUniqueOrThrow({ where: { id: termId } });
  const { startDate, endDate } = term;

  const existing = await prisma.reportCard.findUnique({
    where: { studentId_termId: { studentId, termId } },
  });
  if (existing?.status === "PUBLISHED") {
    return existing;
  }

  const student = await prisma.student.findUniqueOrThrow({
    where: { id: studentId },
    include: { user: { select: { schoolId: true } } },
  });
  const schoolId = student.user.schoolId!;

  // Aggregate graded submissions by subject within the term window
  const submissions = await prisma.assignmentSubmission.findMany({
    where: {
      studentId,
      score: { not: null },
      OR: [
        { gradedAt: { gte: startDate, lte: endDate } },
        { turnedInAt: { gte: startDate, lte: endDate } },
      ],
    },
    include: {
      Assignment: {
        include: { Class: { select: { subject: true } } },
      },
    },
  });

  const subjectMap = new Map<string, number[]>();
  for (const sub of submissions) {
    const subject = String(sub.Assignment.Class.subject);
    if (!subjectMap.has(subject)) subjectMap.set(subject, []);
    subjectMap.get(subject)!.push(sub.score!);
  }

  const primaryClass = await prisma.class.findUnique({
    where: { id: classId },
    select: { subject: true },
  });
  const primarySubject = primaryClass ? String(primaryClass.subject) : "UNKNOWN";

  // Exam scores from Grade model for this class
  const gradeRows = await prisma.grade.findMany({
    where: { studentId, classId },
    select: { percent: true },
  });
  const examScore =
    gradeRows.length > 0
      ? Math.round(gradeRows.reduce((s, g) => s + g.percent, 0) / gradeRows.length)
      : undefined;

  const subjectGrades: SubjectGrade[] = [];
  if (subjectMap.size === 0) {
    subjectGrades.push({
      subject: primarySubject,
      average: 0,
      assignmentCount: 0,
      examScore,
    });
  } else {
    for (const [subject, scores] of subjectMap) {
      const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      subjectGrades.push({
        subject,
        average: avg,
        assignmentCount: scores.length,
        examScore: subject === primarySubject ? examScore : undefined,
      });
    }
  }

  // Attendance within the term date range for this class
  const attendanceRows = await prisma.attendance.findMany({
    where: {
      studentId,
      classId,
      date: { gte: startDate, lte: endDate },
    },
    select: { status: true },
  });

  const totalDays = attendanceRows.length;
  const present = attendanceRows.filter((a) => a.status === "PRESENT").length;
  const absent = attendanceRows.filter(
    (a) => a.status === "ABSENT" || a.status === "EXCUSED"
  ).length;
  const late = attendanceRows.filter((a) => a.status === "LATE").length;
  const rate = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;

  const attendanceSummary: AttendanceSummary = {
    totalDays,
    present,
    absent,
    late,
    rate,
  };

  const reportCard = await prisma.reportCard.upsert({
    where: { studentId_termId: { studentId, termId } },
    create: {
      studentId,
      termId,
      schoolId,
      classId,
      subjectGrades: subjectGrades as object[],
      attendanceSummary: attendanceSummary as object,
      status: "DRAFT",
      generatedAt: new Date(),
      createdBy,
    },
    update: {
      classId,
      subjectGrades: subjectGrades as object[],
      attendanceSummary: attendanceSummary as object,
      generatedAt: new Date(),
      createdBy,
    },
  });

  void logAudit({
    userId: createdBy,
    action: "report_card.generated",
    resourceType: "ReportCard",
    resourceId: reportCard.id,
    schoolId,
    details: { studentId, termId, classId },
  });

  return reportCard;
}
