// app/teacher/homework/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type AppSession = {
  user?: {
    id?: string;
    role?: "STUDENT" | "TEACHER" | "ADMIN" | string;
  };
};

type TeacherHomeworkListProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default async function TeacherHomeworkList({
  searchParams = {},
}: TeacherHomeworkListProps) {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.role !== "TEACHER") {
    redirect("/");
  }

  const teacherId = session.user.id;

  const classIdParam = searchParams.classId;
  const classId =
    typeof classIdParam === "string" ? classIdParam : undefined;

  // Get teacher's classes
  const classes = await prisma.class.findMany({
    where: { teacherId },
    include: {
      School: true,
    },
  });

  if (classes.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-50">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold">No classes found</h1>
          <p className="mb-4 text-sm text-slate-400">
            Contact your admin to assign you to a class before managing
            homework.
          </p>
          <Link href="/teacher" className="text-sm text-blue-300 hover:underline">
            ← Back to teacher dashboard
          </Link>
        </div>
      </main>
    );
  }

  // Use selected class or first class
  const selectedClassId = classId || classes[0].id;

  const homework = await prisma.homework.findMany({
    where: {
      classId: selectedClassId,
    },
    include: {
      Class: true,
      submissions: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedClassName = selectedClass?.name || "Selected class";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />

      <div className="mx-auto max-w-5xl px-4 py-6">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <div>
            <Link
              href="/teacher"
              className="mb-2 inline-block text-sm text-blue-300 hover:underline"
            >
              ← Back to teacher dashboard
            </Link>
            <h1 className="text-2xl font-bold">Homework Assignments</h1>
            <p className="text-sm text-slate-400">
              View and manage homework for your classes.
            </p>
          </div>

          <Link
            href="/teacher/homework/create"
            className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            + Create Homework
          </Link>
        </header>

        {/* Class Selector */}
        <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-slate-400">
            Select Class
          </p>
          <div className="flex flex-wrap gap-2">
            {classes.map((cls) => (
              <Link
                key={cls.id}
                href={`/teacher/homework?classId=${cls.id}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  cls.id === selectedClassId
                    ? "bg-blue-500 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {cls.name}
              </Link>
            ))}
          </div>
        </div>

        {/* Homework List */}
        <div className="space-y-4">
          {homework.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-12 text-center">
              <p className="mb-3 text-4xl">📝</p>
              <p className="mb-2 text-lg font-medium">No homework yet</p>
              <p className="mb-4 text-sm text-slate-400">
                Create your first homework assignment for {selectedClassName}.
              </p>
              <Link
                href="/teacher/homework/create"
                className="inline-block rounded-full bg-emerald-500 px-6 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
              >
                + Create Homework
              </Link>
            </div>
          ) : (
            homework.map((hw) => {
              const totalSubmissions = hw.submissions.length;
              const gradedSubmissions = hw.submissions.filter(
                (s) => s.teacherScore !== null
              ).length;

              return (
                <Link
                  key={hw.id}
                  href={`/teacher/homework/${hw.id}`}
                  className="block rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition-colors hover:border-blue-500/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="mb-1 text-lg font-semibold">
                        {hw.title}
                      </h3>
                      <p className="mb-3 text-sm text-slate-400">
                        {hw.instructions || "No description"}
                      </p>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                        <span>Class: {hw.Class.name}</span>
                        <span>
                          Assigned:{" "}
                          {new Date(hw.createdAt).toLocaleDateString()}
                        </span>
                        {hw.dueAt && (
                          <span>
                            Due:{" "}
                            {new Date(hw.dueAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 text-right">
                      <p className="mb-1 text-xs text-slate-400">
                        Submissions
                      </p>
                      <p className="text-2xl font-bold text-blue-300">
                        {totalSubmissions}
                      </p>
                      <p className="text-xs text-slate-500">
                        {gradedSubmissions} graded
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
