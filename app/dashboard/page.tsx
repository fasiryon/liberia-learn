import AiTutorChat from "@/components/AiTutorChat";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";

// app/page.tsx (Student Dashboard)
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StatCard } from "@/components/ui/Card";
import { logger } from "@/lib/logger";
import { StudentSidebar } from "@/components/StudentSidebar";
import { LegalFooter } from "@/components/LegalFooter";
import {
  getPlacementOutcomeText,
  getPlacementReviewStatus,
  placementReviewStatusLabels,
  placementReviewStatusStyles,
} from "@/lib/placement";

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
        },
        placementTests: {
          orderBy: { createdAt: "desc" },
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
        <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)] flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center space-y-4">
            <h1 className="text-xl font-semibold">No student profile found</h1>
            <p className="text-sm text-[var(--ll-text-muted)]">
              You&apos;re signed in but there is no matching student row.
            </p>

            {error && (
              <p className="text-xs text-red-400">DB Error: {error}</p>
            )}

            <div className="flex justify-center gap-2 pt-2">
              <Link
                href="/"
                className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text)] hover:text-[var(--ll-text)]"
              >
                <span className="inline-flex items-center gap-1">
                  <ChevronLeft size={14} />
                  Back
                </span>
              </Link>
              <Link
                href="/login"
                className="rounded-full bg-[var(--ll-yellow)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text-faint)]"
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
    ? `Grade ${student.currentGrade}`
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

  const todayWorkItems = [
    {
      label: "Continue lesson",
      href: "/student/today",
      helper: "Resume today's current or next lesson",
    },
    {
      label: "Take exam",
      href: "/student/exams",
      helper: "Finish active assessments",
    },
    {
      label: "Practice weak areas",
      href: "/student/adaptive",
      helper: "Target the strands that need review",
    },
  ];

  const classIds = student.enrollments.map((enrollment: any) => enrollment.classId);
  const dashboardAssignments =
    classIds.length === 0
      ? []
      : await prisma.assignment.findMany({
          where: {
            classId: { in: classIds },
          },
          include: {
            Class: {
              select: {
                id: true,
                name: true,
                Teacher: {
                  select: {
                    name: true,
                    email: true,
                  },
                },
              },
            },
            submissions: {
              where: { studentId: student.id },
              select: {
                turnedInAt: true,
                score: true,
              },
            },
          },
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          take: 6,
        });

  return (
    <ErrorBoundary>
      <main className="ll-dashboard-shell">
        {/* Scroll-to-top on mount */}
        <script
          dangerouslySetInnerHTML={{
            __html: "window.scrollTo(0,0);",
          }}
        />
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-5 sm:px-4 sm:py-6">
          {/* Consistent top bar */}
          <DashboardTopBar
            roleLabel="Student"
            roleBadgeBg="bg-[var(--ll-yellow)]/10 border-emerald-500/20"
            roleAccent="text-[var(--ll-accent)]"
            userName={studentName}
            subtitle={`${className} Â· ${county}`}
          />

          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            {/* Sidebar */}
            <StudentSidebar
              school={school}
              teacherName={teacherName}
              studentName={studentName}
            />

            {/* Main Content */}
            <section className="flex flex-1 flex-col gap-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 shadow-none">
              {/* Greeting */}
              <div>
                <p className="text-xs uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                  {new Date().toLocaleDateString("en-LR", { weekday: "long", month: "long", day: "numeric" })}
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-[var(--ll-text)]">
                  Good morning, <span className="text-[var(--ll-accent)]">{studentName}</span>. Ready to learn?
                </h1>
                <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Placement: {placementGradeLabel} Â· {school}</p>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-center">
                  <p className="text-2xl font-semibold text-[var(--ll-text)]">{lessonsThisWeek}</p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">Lessons this week</p>
                </div>
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-center">
                  <p className="text-2xl font-semibold text-[var(--ll-text)]">{attendancePercent}%</p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">Attendance</p>
                </div>
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-center">
                  <p className="text-2xl font-semibold text-[var(--ll-text)]">{avgGrade}%</p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">Average grade</p>
                </div>
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-center">
                  <p className="text-2xl font-semibold text-[var(--ll-text)]">{chatMessagesCount}</p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">AI questions this week</p>
                </div>
              </div>

              {/* Primary Actions */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Link
                  href="/student/today"
                  className="flex flex-col gap-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-accent-soft)] p-4 hover:bg-[rgba(24,211,158,0.15)]"
                >
                  <p className="text-sm font-semibold text-[var(--ll-accent)]">Continue today&apos;s lesson</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Open today&apos;s structured lesson plan</p>
                </Link>
                <Link
                  href="/student/progress"
                  className="flex flex-col gap-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 hover:border-[var(--ll-border-strong)]"
                >
                  <p className="text-sm font-semibold text-[var(--ll-text)]">View my progress</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Grades, mastery, and history</p>
                </Link>
                <Link
                  href="/student/certificates"
                  className="flex flex-col gap-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 hover:border-[var(--ll-border-strong)]"
                >
                  <p className="text-sm font-semibold text-[var(--ll-text)]">My certificates</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">View earned certificates</p>
                </Link>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                      Today&apos;s Work
                    </p>
                    <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">
                      Keep moving while everything is fresh.
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ll-text-muted)]">
                      Start with your current lesson, then finish any open exam or adaptive practice before the day ends.
                    </p>
                  </div>
                  <Link
                    href="/student/today"
                    className="ll-touch-target inline-flex items-center justify-center rounded-lg bg-[var(--ll-accent)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)]"
                  >
                    Open today&apos;s lesson
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {todayWorkItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="ll-touch-target rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3"
                    >
                      <p className="text-sm font-semibold text-[var(--ll-text)]">{item.label}</p>
                      <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{item.helper}</p>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                      Teacher Assignments
                    </p>
                    <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">
                      Work your teacher assigned to your class.
                    </h2>
                  </div>
                  <Link
                    href="/assignments"
                    className="ll-touch-target inline-flex items-center justify-center rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-muted)]"
                  >
                    Open assignments
                  </Link>
                </div>
                {dashboardAssignments.length === 0 ? (
                  <p className="mt-4 text-sm text-[var(--ll-text)]">
                    No class assignments are waiting right now.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-3">
                    {dashboardAssignments.map((assignment: any) => {
                      const submission = assignment.submissions[0] ?? null;
                      const isOverdue =
                        !submission?.turnedInAt &&
                        assignment.dueAt &&
                        new Date(assignment.dueAt).getTime() < Date.now();
                      const teacherName =
                        assignment.Class.Teacher?.name ??
                        assignment.Class.Teacher?.email ??
                        "Teacher";

                      return (
                        <Link
                          key={assignment.id}
                          href={`/student/assignments/${assignment.id}`}
                          className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-[var(--ll-text)]">
                                {assignment.title}
                              </p>
                              <p className="mt-1 text-xs text-[var(--ll-text)]">
                                Assigned by {teacherName} Â· Due{" "}
                                {assignment.dueAt
                                  ? new Date(assignment.dueAt).toLocaleDateString("en-LR")
                                  : "not set"}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                submission?.turnedInAt
                                  ? "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]"
                                  : isOverdue
                                    ? "bg-red-500/20 text-red-300"
                                    : "bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]"
                              }`}
                            >
                              {submission?.turnedInAt
                                ? "Submitted"
                                : isOverdue
                                  ? "Overdue"
                                  : "Assigned"}
                            </span>
                          </div>
                          <p className="mt-3 text-sm text-[var(--ll-text)]">
                            {assignment.description || "Open this assignment to see instructions."}
                          </p>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard
                  label="Average Grade"
                  value={`${avgGrade}%`}
                  subtitle={`${grades.length} assignments`}
                />
                <StatCard
                  label="Placement Grade"
                  value={placementGradeLabel}
                  subtitle={
                    latestPlacement
                      ? `Last test: ${latestPlacement.rawScore}/${latestPlacement.totalQuestions}`
                      : "No test yet"
                  }
                  valueClassName="text-[var(--ll-yellow)]"
                />
                <StatCard
                  label="Classes"
                  value={student.enrollments.length || 1}
                  subtitle={`${community}, ${county}`}
                  valueClassName="text-[var(--ll-yellow)]"
                />
                <StatCard
                  label="Attendance"
                  value={`${attendancePercent}%`}
                  subtitle="Excellent"
                  valueClassName="text-sky-300"
                />

                {/* AI TUTOR ACTIVITY */}
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)]">
                    AI Tutor Activity
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-2xl font-semibold text-[var(--ll-yellow)]">
                      {chatMessagesCount}
                    </p>
                    <p className="text-xs text-[var(--ll-text-muted)]">
                      questions this week
                    </p>
                  </div>
                  <p className="text-xs text-[var(--ll-text-faint)] mt-2">
                    Keep asking questions â€” learning grows with curiosity.
                  </p>
                </div>
              </div>

              {/* Placement Overview */}
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)] mb-2">
                  Placement overview
                </p>
                <p className="text-sm text-[var(--ll-text)]">
                  Current recommended grade:{" "}
                  <span className="font-semibold">
                    {placementGradeLabel}
                  </span>
                </p>
                {latestPlacement ? (
                  <p className="text-xs text-[var(--ll-text-muted)] mt-1">
                    Last placement test: {latestPlacement.levelLabel} Â· Grade{" "}
                    {latestPlacement.estimatedGrade} Â· {latestPlacement.rawScore}/
                    {latestPlacement.totalQuestions} Â·{" "}
                    {new Date(latestPlacement.createdAt).toLocaleString()}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--ll-text-muted)] mt-1">
                    You haven&apos;t taken a placement test yet. Once the AI
                    test is live, we&apos;ll use it to set your starting grade.
                  </p>
                )}
                <Link
                  href="/student/placement"
                  className="mt-2 inline-flex text-[11px] text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
                >
                  <span className="inline-flex items-center gap-1">
                    View placement details
                    <ChevronRight size={14} />
                  </span>
                </Link>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)]">
                      Placement History
                    </p>
                    <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                      Review AI recommendations and teacher decisions from every placement attempt.
                    </p>
                  </div>
                  <Link
                    href="/placement"
                    className="inline-flex rounded-full border border-emerald-500/30 px-3 py-1.5 text-[11px] text-[var(--ll-yellow)] hover:border-emerald-400/40 hover:text-[var(--ll-yellow)]"
                  >
                    Retake placement
                  </Link>
                </div>

                {student.placementTests.length === 0 ? (
                  <p className="mt-4 text-sm text-[var(--ll-text-muted)]">
                    No placement history yet. Take the AI placement test to establish your starting grade.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {student.placementTests.map((placement: any) => {
                      const status = getPlacementReviewStatus(placement.teacherDecision);
                      return (
                        <div
                          key={placement.id}
                          className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-[var(--ll-text)]">
                                {getPlacementOutcomeText({
                                  estimatedGrade: placement.estimatedGrade,
                                  teacherDecision: placement.teacherDecision,
                                  teacherGrade: placement.teacherGrade,
                                })}
                              </p>
                              <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                                {placement.rawScore}/{placement.totalQuestions} correct Â·{" "}
                                {new Date(placement.createdAt).toLocaleDateString("en-LR")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full border px-3 py-1 text-[11px] font-medium ${placementReviewStatusStyles[status]}`}
                              >
                                {placementReviewStatusLabels[status]}
                              </span>
                              <Link
                                href="/placement"
                                className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[11px] text-[var(--ll-text)] hover:text-[var(--ll-text)]"
                              >
                                View results
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Grades */}
              {grades.length === 0 ? (
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-8 text-center">
                  <p className="mb-2 flex justify-center text-[var(--ll-text-muted)]">
                    <BookOpen size={28} />
                  </p>
                  <p className="text-sm font-medium mb-1">
                    No grades yet
                  </p>
                  <p className="text-xs text-[var(--ll-text-faint)]">
                    Your work will appear here once it&apos;s graded.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                  <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)] mb-3">
                    Recent Grades
                  </p>
                  <div className="space-y-2">
                    {grades.map((g: any) => (
                      <div
                        key={g.id}
                        className="flex items-center justify-between rounded-xl bg-[var(--ll-bg)]/80 px-3 py-2 text-sm"
                      >
                        <div>
                          <p className="text-[var(--ll-text)]">
                            {g.Class?.name}
                          </p>
                          <p className="text-[11px] text-[var(--ll-text-muted)]">
                            {new Date(
                              g.computedAt
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold text-[var(--ll-yellow)]">
                            {g.percent}%
                          </p>
                          <p className="text-[11px] text-[var(--ll-text-muted)]">
                            Grade: {g.letter}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Today's schedule */}
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)]">
                  Today&apos;s schedule
                </p>

                <div className="mt-3 space-y-2 text-xs text-[var(--ll-text)]">
                  {[
                    {
                      time: "08:30 â€“ 09:15",
                      title: "Mathematics Â· Fractions & Ratios",
                      tag: "AI plan ready",
                    },
                    {
                      time: "09:30 â€“ 10:15",
                      title: "Science Â· States of Matter",
                      tag: "Slides prepared",
                    },
                    {
                      time: "11:00 â€“ 11:45",
                      title: "English Â· Reading comprehension",
                      tag: "Reading pack",
                    },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl bg-[var(--ll-bg)]/80 px-3 py-2"
                    >
                      <div>
                        <p className="text-[11px] text-[var(--ll-text-muted)]">
                          {item.time}
                        </p>
                        <p className="text-sm text-[var(--ll-text)]">
                          {item.title}
                        </p>
                      </div>
                      <span className="text-[10px] bg-[var(--ll-yellow)]/15 rounded-full px-2 py-0.5 text-[var(--ll-yellow)]">
                        {item.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI TUTOR */}
              <div
                id="ai-tutor-section"
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"
              >
                <p className="text-[11px] uppercase tracking-wide text-[var(--ll-text-muted)] mb-3">
                  AI Tutor
                </p>
                <AiTutorChat />
              </div>
            </section>
          </div>
        </div>
        <LegalFooter variant="portal" />
      </main>
    </ErrorBoundary>
  );
}
