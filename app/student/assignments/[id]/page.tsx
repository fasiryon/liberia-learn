import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logLearningEvent } from "@/lib/events/logLearningEvent";
import { getAssignmentTargetStudentIds } from "@/lib/assignments/targeting";

import AssignmentSubmissionClient from "./AssignmentSubmissionClient";

export default async function StudentAssignmentPage({ params }: { params: { id: string } }) {
  const user = await requireRole("STUDENT");
  const student = await prisma.student.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      enrollments: { select: { classId: true } },
    },
  });
  if (!student) {
    redirect("/dashboard");
  }

  const assignment = await prisma.assignment.findUnique({
    where: { id: params.id },
    include: {
      Class: {
        select: {
          id: true,
          schoolId: true,
          name: true,
        },
      },
      submissions: {
        where: { studentId: student.id },
        take: 1,
      },
    },
  });
  if (!assignment) {
    redirect("/assignments");
  }

  const isEnrolled = student.enrollments.some((enrollment) => enrollment.classId === assignment.classId);
  if (!isEnrolled || assignment.Class.schoolId !== user.schoolId) {
    redirect("/assignments");
  }
  const targetStudentIds = await getAssignmentTargetStudentIds(assignment.id);
  if (targetStudentIds.length > 0 && !targetStudentIds.includes(student.id)) {
    redirect("/assignments");
  }

  const submission = assignment.submissions[0] ?? null;

  logLearningEvent({
    schoolId: user.schoolId,
    classId: assignment.classId,
    userId: user.id,
    studentId: student.id,
    actor: { type: "student", id: user.id, role: "STUDENT" },
    target: { type: "assignment", id: assignment.id },
    eventType: "assignment_viewed",
    source: "/student/assignments/[id]",
    metadata: { title: assignment.title },
  }).catch(() => null);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--ll-yellow)]">LiberiaLearn</p>
          <h1 className="mt-3 text-3xl font-semibold text-[var(--ll-text)]">{assignment.title}</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{assignment.Class.name}</p>
        </header>

        <AssignmentSubmissionClient
          assignmentId={assignment.id}
          title={assignment.title}
          instructions={assignment.description}
          existingContent={submission?.content ?? ""}
        />
      </div>
    </main>
  );
}
