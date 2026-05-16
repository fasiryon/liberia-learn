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
      lessonBreakdown: [],
      studentBreakdown: [],
    });
  }

  // Aggregate TutorConversation records — counts only, no message bodies
  const conversations = await prisma.tutorConversation.findMany({
    where: {
      studentId: { in: studentUserIds },
      sessionDate: { gte: weekAgo },
    },
    select: {
      studentId: true,
      contentId: true,
      questionsAsked: true,
      content: { select: { title: true, subject: true, grade: true } },
    },
  });

  // Aggregate flags
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

  // Lesson breakdown
  const lessonMap: Record<
    string,
    { title: string | null; subject: string; grade: number; questions: number; flags: number }
  > = {};
  for (const conv of conversations) {
    const existing = lessonMap[conv.contentId];
    if (existing) {
      existing.questions += conv.questionsAsked;
    } else {
      lessonMap[conv.contentId] = {
        title: conv.content.title ?? null,
        subject: conv.content.subject,
        grade: conv.content.grade,
        questions: conv.questionsAsked,
        flags: flagsByContent[conv.contentId] ?? 0,
      };
    }
  }

  const lessonBreakdown = Object.entries(lessonMap)
    .map(([contentId, data]) => ({ contentId, ...data }))
    .sort((a, b) => b.questions - a.questions);

  // Student breakdown — aggregate counts without exposing message content
  const studentQuestions: Record<string, number> = {};
  for (const conv of conversations) {
    studentQuestions[conv.studentId] =
      (studentQuestions[conv.studentId] ?? 0) + conv.questionsAsked;
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

  const totalQuestions = conversations.reduce((sum, c) => sum + c.questionsAsked, 0);
  const uniqueStudents = new Set(conversations.map((c) => c.studentId)).size;

  const mostFlaggedEntry = Object.entries(flagsByContent).sort(
    ([, a], [, b]) => b - a
  )[0];
  const mostFlaggedLesson = mostFlaggedEntry
    ? (lessonMap[mostFlaggedEntry[0]]?.title ?? mostFlaggedEntry[0])
    : null;

  return NextResponse.json({
    totalQuestions,
    uniqueStudents,
    mostFlaggedLesson,
    lessonBreakdown,
    studentBreakdown,
  });
}
