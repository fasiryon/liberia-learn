// app/page.tsx (Student Dashboard)
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StatCard } from "@/components/ui/Card";
import { logger } from "@/lib/logger";
import { AITutorChat } from "@/components/AITutorChat";
import { StudentSidebar } from "@/components/StudentSidebar";

export const dynamic = "force-dynamic";

type AppSession = {
  user?: {
    id?: string;
    role?: "STUDENT" | "TEACHER" | "ADMIN" | string;
    email?: string | null;
    name?: string | null;
  };
};

export default async function DashboardPage() {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) {
    redirect("/login");
  }

  const role = session.user.role;
  const userId = session.user.id as string;

  // Redirect teacher/admin
  if (role === "TEACHER") redirect("/teacher");
  if (role === "ADMIN") redirect("/admin");

  let student: any = null;
  let error: string | null = null;

  try {
    student = await prisma.student.findFirst({
      where: { userId },
      include: {
        user: true,
        enrollments: {
          include: {
            Class: {
              include: {
                School: true,
                Teacher: true,
              },
            },
          },
        },
        grades: {
          include: { Class: true },
          take: 5,
        },
      },
    });

    logger.info("Student dashboard loaded", {
      studentId: student?.id,
      gradesCount: student?.grades?.length ?? 0,
    });
  } catch (err: any) {
    console.error("DB error:", err);
    error = err.message;
  }

  if (!student) {
    return (
      <ErrorBoundary>
        <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-xl font-semibold">No student profile found</h1>
            <p className="text-sm text-slate-400">
              You're signed in but there is no matching student row.
            </p>
            <p className="text-xs text-slate-500">
              Demo login:{" "}
              <span className="font-mono text-emerald-300">
                student@school.lr
              </span>{" "}
              /{" "}
              <span className="font-mono text-emerald-300">
                password123
              </span>
            </p>

            {error && (
              <p className="text-xs text-red-400">DB Error: {error}</p>
            )}

            <div className="flex justify-center gap-2 pt-2">
              <Link
                href="/"
                className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:text-slate-50"
              >
                ⬅ Back
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950"
              >
                Login
              </Link>
            </div>
          </div>
        </main>
      </ErrorBoundary>
    );
  }

  // ------------------ Normal Dashboard ------------------

  const studentName = student.user?.name || "Student";
  const county = student.county || "Montserrado";
  const community = student.community || "New Kru Town";

  const firstEnrollment = student.enrollments[0];
  const school = firstEnrollment?.Class?.School?.name || "Demo School";
  const className = firstEnrollment?.Class?.name || "Grade 6 Mathematics";
  const teacherName = firstEnrollment?.Class?.Teacher?.name || "Teacher";

  const grades = student.grades || [];
  const avgGrade =
    grades.length > 0
      ? (
          grades.reduce((sum: number, g: any) => sum + g.percent, 0) /
          grades.length
        ).toFixed(1)
      : "72.0";

  const lessonsThisWeek = grades.length;
  const attendancePercent = "96";

  const latestPlacement = student.placementTests?.[0] ?? null;
  const placementGradeLabel = student.currentGrade
    ? Grade +student.currentGrade+`
    : "Not set";

  // Fetch AI chat message count for this student
  const chatMessagesCount = await prisma.chatMessage.count({
    where: {
      studentId: student.id,
      createdAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      },
    },
  });

  return (
    <ErrorBoundary>
      <main className="min-h-screen bg-slate-950 text-slate-50">
        {/* Glow */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%),radial-gradient(circle_at_bottom,_#0ea5e922,_transparent_60%)]" />

        <div className="mx-auto max-w-6xl min-h-screen flex flex-col gap-4 px-4 py-6">
          {/* Header */}
          <header className="flex items-center justify-between rounded-3xl border border-white/5 bg-slate-950/70 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-sm font-black text-slate-950">
                L
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                  LiberiaLearn
                </p>
                <p className="text-sm font-medium">Student dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <Link
                href="/"
                className="hidden sm:inline-flex rounded-full border border-slate-700 px-3 py-1.5 text-slate-300 hover:text-slate-50"
              >
                ⬅ Home
              </Link>
              <div className="flex items-center gap-2 rounded-full bg-slate-900/80 px-3 py-1.5">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400" />
                <div>
                  <p className="text-xs font-medium">{studentName}</p>
                  <p className="text-[10px] text-slate-400">
                    {className} · {county}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            {/* Sidebar */}
            <StudentSidebar
              school={school}
              teacherName={teacherName}
              studentName={studentName}
            />

            {/* Main Content */}
            <section className="flex flex-1 flex-col gap-4 rounded-3xl border border-white/5 bg-slate-950/80 p-4 shadow-lg shadow-black/40 backdrop-blur">
              {/* Greeting */}
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-300">
                    Today
                  </p>
                  <h1 className="text-xl font-semibold">
                    Welcome back,{" "}
                    <span className="text-emerald-300">
                      {studentName}
                    </span>
                  </h1>
                  <p className="text-xs text-slate-400">
                    Placement: {placementGradeLabel}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-900/90 px-3 py-2 text-xs">
                  <p className="text-[11px] text-slate-400">
                    Current class
                  </p>
                  <p className="text-sm font-semibold text-slate-100">
                    {className}
                  </p>
                  <p className="text-[11px] text-emerald-300">{school}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid gap-3 md:grid-cols-5">
                <StatCard
                  label="Average Grade"
                  value={+avgGrade+%}
                  subtitle={+grades.length+ assignments}
                />
                <StatCard
                  label="Placement Grade"
                  value={placementGradeLabel}
                  subtitle={
                    latestPlacement
                      ? Last test: +latestPlacement.score+%
                      : "No test yet"
                  }
                  valueClassName="text-emerald-300"
                />
                <StatCard
                  label="Classes"
                  value={student.enrollments.length || 1}
                  subtitle={`${student?.community ?? ""}${student?.community && student?.county ? ", " : ""}${student?.county ?? ""}`}
                  valueClassName="text-amber-300"
                />
                <StatCard
                  label="Attendance"
                  value={+attendancePercent+%}
                  subtitle="Excellent"
                  valueClassName="text-sky-300"
                />

                {/* AI TUTOR ACTIVITY */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">
                    AI Tutor Activity
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-2xl font-semibold text-emerald-300">
                      {chatMessagesCount}
                    </p>
                    <p className="text-xs text-slate-400">
                      questions this week
                    </p>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Keep asking questions — learning grows with curiosity.
                  </p>
                </div>
              </div>

              {/* Placement Overview */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
                  Placement overview
                </p>
                <p className="text-sm text-slate-200">
                  Current recommended grade:{" "}
                  <span className="font-semibold">
                    {placementGradeLabel}
                  </span>
                </p>
                {latestPlacement ? (
                  <p className="text-xs text-slate-400 mt-1">
                    Last placement test: {latestPlacement.track} · Grade{" "}
                    {latestPlacement.grade} · {latestPlacement.score}% ·{" "}
                    {new Date(latestPlacement.createdAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">
                    You haven&apos;t taken a placement test yet. Once the AI
                    test is live, we&apos;ll use it to set your starting grade.
                  </p>
                )}
                <Link
                  href="/student/placement"
                  className="mt-2 inline-flex text-[11px] text-emerald-300 hover:text-emerald-200"
                >
                  View placement details →
                </Link>
              </div>

              {/* Grades */}
              {grades.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 text-center">
                  <p className="text-4xl mb-2">📚</p>
                  <p className="text-sm font-medium mb-1">
                    No grades yet
                  </p>
                  <p className="text-xs text-slate-500">
                    Your work will appear here once it&apos;s graded.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-3">
                    Recent Grades
                  </p>
                  <div className="space-y-2">
                    {grades.map((g: any) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between rounded-xl bg-slate-950/80 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="text-slate-100">
                            {g.Class?.name}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {new Date(
                              g.computedAt
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-emerald-300">
                            {g.percent}%
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Grade: {g.letter}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Today's schedule */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">
                  Today's schedule
                </p>

                <div className="mt-3 space-y-2 text-xs text-slate-300">
                  {[
                    {
                      time: "08:30 – 09:15",
                      title: "Mathematics · Fractions & Ratios",
                      tag: "AI plan ready",
                    },
                    {
                      time: "09:30 – 10:15",
                      title: "Science · States of Matter",
                      tag: "Slides prepared",
                    },
                    {
                      time: "11:00 – 11:45",
                      title: "English · Reading comprehension",
                      tag: "Reading pack",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-slate-950/80 px-3 py-2"
                    >
                      <div>
                        <p className="text-[11px] text-slate-400">
                          {item.time}
                        </p>
                        <p className="text-sm text-slate-100">
                          {item.title}
                        </p>
                      </div>
                      <span className="text-[10px] bg-emerald-500/15 rounded-full px-2 py-0.5 text-emerald-300">
                        {item.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI TUTOR */}
              <div
                id="ai-tutor-section"
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4"
              >
                <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-3">
                  AI Tutor
                </p>
                <AITutorChat />
              </div>
            </section>
          </div>
        </div>
      </main>
    </ErrorBoundary>
  );
}

