import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";

export async function GET(_req: NextRequest) {
  let user: Awaited<ReturnType<typeof requireRole>>;
  try {
    user = await requireRole("TEACHER");
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  // Get all students in this teacher's classes
  const enrollments = await prisma.enrollment.findMany({
    where: {
      Class: { teacherId: user.id, schoolId: user.schoolId ?? "" },
    },
    select: {
      Student: {
        select: {
          userId: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  const studentUserIds = [...new Set(enrollments.map((e) => e.Student.userId))];

  if (studentUserIds.length === 0) {
    return NextResponse.json({
      totalQuestions: 0,
      uniqueStudents: 0,
      mostFlaggedLesson: null,
      subjectBreakdown: [],
      studentBreakdown: [],
    });
  }

  // Real tutor usage now comes from AIInteraction (feature: "tutor"), written
  // by the consolidated GlobalAssistantShell -> /api/rag/query path. That
  // path isn't lesson-scoped the way the old per-lesson chat widget was
  // (no contentId), so this is a subject-level breakdown, not a per-lesson
  // one — see Tutor Architecture Consolidation.
  const interactions = await prisma.aIInteraction.findMany({
    where: {
      studentId: { in: studentUserIds },
      feature: "tutor",
      createdAt: { gte: weekAgo },
    },
    select: { studentId: true, subject: true },
  });

  // Lesson "I don't understand this" flags are a separate, still lesson-scoped
  // feature (StudentLessonHelpPanel), unrelated to the tutor chat itself.
  const flags = await prisma.lessonHelpFlag.findMany({
    where: {
      studentId: { in: studentUserIds },
      createdAt: { gte: weekAgo },
    },
    select: { contentId: true, studentId: true },
  });

  const flagsByContent: Record<string, number> = {};
  for (const flag of flags) {
    flagsByContent[flag.contentId] = (flagsByContent[flag.contentId] ?? 0) + 1;
  }

  const flagsByStudent: Record<string, number> = {};
  for (const flag of flags) {
    flagsByStudent[flag.studentId] = (flagsByStudent[flag.studentId] ?? 0) + 1;
  }

  // Subject breakdown
  const subjectCounts: Record<string, number> = {};
  for (const interaction of interactions) {
    const subject = interaction.subject ?? "General";
    subjectCounts[subject] = (subjectCounts[subject] ?? 0) + 1;
  }

  const subjectBreakdown = Object.entries(subjectCounts)
    .map(([subject, questions]) => ({ subject, questions }))
    .sort((a, b) => b.questions - a.questions);

  // Student breakdown — aggregate counts without exposing message content
  const studentQuestions: Record<string, number> = {};
  for (const interaction of interactions) {
    if (!interaction.studentId) continue;
    studentQuestions[interaction.studentId] =
      (studentQuestions[interaction.studentId] ?? 0) + 1;
  }

  const studentNameMap: Record<string, string> = {};
  for (const e of enrollments) {
    studentNameMap[e.Student.userId] = e.Student.user.name ?? "Student";
  }

  const studentBreakdown = Object.entries(studentQuestions)
    .map(([studentId, questions]) => ({
      studentId,
      name: studentNameMap[studentId] ?? "Student",
      questions,
      flags: flagsByStudent[studentId] ?? 0,
    }))
    .sort((a, b) => b.questions - a.questions);

  const totalQuestions = interactions.length;
  const uniqueStudents = new Set(
    interactions.map((i) => i.studentId).filter((id): id is string => id != null)
  ).size;

  const mostFlaggedEntry = Object.entries(flagsByContent).sort(
    ([, a], [, b]) => b - a
  )[0];
  let mostFlaggedLesson: string | null = null;
  if (mostFlaggedEntry) {
    const content = await prisma.curriculumContent.findUnique({
      where: { contentId: mostFlaggedEntry[0] },
      select: { title: true },
    });
    mostFlaggedLesson = content?.title ?? mostFlaggedEntry[0];
  }

  return NextResponse.json({
    totalQuestions,
    uniqueStudents,
    mostFlaggedLesson,
    subjectBreakdown,
    studentBreakdown,
  });
}
