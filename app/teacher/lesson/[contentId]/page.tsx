import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import TeacherLessonViewClient from "./TeacherLessonViewClient";
// TeacherVideoUpload is rendered inside TeacherLessonViewClient for teacher video management

export type StudentSubmissionContext = {
  studentName: string;
  score: number | null;
  submittedAt: string | null;
};

export default async function TeacherLessonPage({
  params,
  searchParams,
}: {
  params: { contentId: string };
  searchParams: { studentId?: string };
}) {
  const user = await requireRole("TEACHER");

  let studentContext: StudentSubmissionContext | null = null;

  if (searchParams.studentId) {
    const [student, attempts] = await Promise.all([
      prisma.student.findUnique({
        where: { id: searchParams.studentId },
        select: { user: { select: { name: true, schoolId: true } } },
      }),
      prisma.assessmentAttempt.findMany({
        where: {
          studentId: searchParams.studentId,
          source: "student.lesson.quiz.submit",
        },
        orderBy: { submittedAt: "desc" },
        select: { score: true, submittedAt: true, createdAt: true, metadata: true },
        take: 50,
      }),
    ]);

    // RBAC: student must belong to teacher's school
    if (student && student.user?.schoolId === user.schoolId) {
      const attempt =
        attempts.find((a) => {
          const meta = (a.metadata ?? {}) as Record<string, unknown>;
          return meta.contentId === params.contentId;
        }) ?? null;

      studentContext = {
        studentName: student.user.name ?? "Student",
        score: attempt?.score ?? null,
        submittedAt:
          attempt?.submittedAt?.toISOString() ??
          attempt?.createdAt?.toISOString() ??
          null,
      };
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl">
        <TeacherLessonViewClient
          contentId={params.contentId}
          studentContext={studentContext}
        />
      </div>
    </main>
  );
}
