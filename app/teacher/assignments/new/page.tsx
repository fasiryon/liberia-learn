import Link from "next/link";

import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

import TeacherAssignmentCreateForm from "./TeacherAssignmentCreateForm";

type TeacherAssignmentNewPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function getFirstValue(value: string | string[] | undefined) {
  return typeof value === "string" ? value : value?.[0];
}

export default async function TeacherAssignmentNewPage({
  searchParams = {},
}: TeacherAssignmentNewPageProps) {
  const user = await requireRole("TEACHER", "ADMIN");

  const classes = await prisma.class.findMany({
    where:
      user.role === "ADMIN"
        ? { schoolId: user.schoolId ?? undefined }
        : { schoolId: user.schoolId ?? undefined, teacherId: user.id },
    select: {
      id: true,
      name: true,
      subject: true,
    },
    orderBy: [{ name: "asc" }],
  });

  const initialValues = {
    classId: getFirstValue(searchParams.classId) ?? classes[0]?.id ?? "",
    title: getFirstValue(searchParams.title) ?? "",
    description: getFirstValue(searchParams.description) ?? "",
    dueAt: getFirstValue(searchParams.dueAt) ?? "",
    points: getFirstValue(searchParams.points) ?? "100",
    contentId: getFirstValue(searchParams.contentId) ?? "",
    scheduledWorkId: getFirstValue(searchParams.scheduledWorkId) ?? "",
    generationMethod: getFirstValue(searchParams.generationMethod) ?? "manual",
    moeStandardCodes: getFirstValue(searchParams.moeStandardCodes) ?? "",
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <Link href="/teacher/assignments" className="text-sm text-emerald-300 hover:text-emerald-200">
            &larr; Back to Assignments
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Create Assignment</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Create classwork, homework, or quizzes directly for one of your classes.
            AI-generated drafts and lesson-linked suggestions can still land here, but
            teachers no longer have to depend on them to assign work.
          </p>
        </header>

        {classes.length === 0 ? (
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold text-slate-100">No classes available</h2>
            <p className="mt-2 text-sm text-slate-400">
              A teacher must be assigned to at least one class before creating assignments.
            </p>
            <Link
              href="/teacher/dashboard"
              className="mt-4 inline-flex rounded-full border border-slate-700 px-5 py-2 text-sm text-slate-200 hover:bg-slate-900/60"
            >
              Return to dashboard
            </Link>
          </section>
        ) : (
          <TeacherAssignmentCreateForm
            classes={classes.map((cls) => ({
              id: cls.id,
              name: cls.name,
              subject: String(cls.subject),
            }))}
            initialValues={initialValues}
          />
        )}
      </div>
    </main>
  );
}
