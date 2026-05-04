import { DashboardTopBar } from "@/components/DashboardTopBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { LegalFooter } from "@/components/LegalFooter";
import { StudentSidebar } from "@/components/StudentSidebar";
import { AchievementBadge } from "@/components/student/AchievementBadge";
import { StudentWelcomeBanner } from "@/components/student/StudentWelcomeBanner";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getStudentGreeting } from "@/lib/student/greetings";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

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

  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "TEACHER") redirect("/teacher");
  if (session.user.role === "ADMIN") redirect("/admin");

  let student: any = null;
  let error: string | null = null;

  try {
    student = await prisma.student.findFirst({
      where: { userId: session.user.id },
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
      },
    });

    logger.info("Student dashboard loaded", {
      studentId: student?.id,
      gradesCount: student?.grades?.length ?? 0,
    });
  } catch (err: any) {
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
            {error ? <p className="text-xs text-red-400">DB Error: {error}</p> : null}
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

  const studentName = student.user?.name || "Student";
  const county = student.county || "Montserrado";
  const firstEnrollment = student.enrollments[0];
  const school = firstEnrollment?.Class?.School?.name || "Demo School";
  const className = firstEnrollment?.Class?.name || "Grade 6 Mathematics";
  const teacherName = firstEnrollment?.Class?.Teacher?.name || "Teacher";
  const grades = student.grades || [];
  const avgGradeNum =
    grades.length > 0
      ? grades.reduce((sum: number, g: any) => sum + g.percent, 0) / grades.length
      : 72.0;
  const avgGrade = avgGradeNum.toFixed(1);
  const lessonsThisWeek = grades.length;
  const attendancePercent = "96";
  const chatMessagesCount = await prisma.chatMessage.count({
    where: {
      studentId: student.id,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });
  const greeting = getStudentGreeting({
    studentName: student.user?.name?.split(" ")[0] || "Student",
    avgGrade: avgGradeNum,
  });
  const dateLabel = new Date().toLocaleDateString("en-LR", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const quickNavItems = [
    { label: "Today", href: "/student/today" },
    { label: "Assignments", href: "/assignments" },
    { label: "Practice", href: "/student/adaptive" },
    { label: "Exams", href: "/student/exams" },
    { label: "Labs", href: "/student/labs" },
  ];

  return (
    <ErrorBoundary>
      <main className="ll-dashboard-shell">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-5 sm:px-4 sm:py-6">
          <DashboardTopBar
            roleLabel="Student"
            roleBadgeBg="bg-[var(--ll-yellow)]/10 border-emerald-500/20"
            roleAccent="text-[var(--ll-accent)]"
            userName={studentName}
            subtitle={`${className} - ${county}`}
          />

          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            <StudentSidebar school={school} teacherName={teacherName} studentName={studentName} />

            <section className="flex flex-1 flex-col gap-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 shadow-none">
              <StudentWelcomeBanner
                lessonsThisWeek={lessonsThisWeek}
                studentName={student.user?.name?.split(" ")[0] || undefined}
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-lg font-semibold text-[var(--ll-text)]">{greeting.headline}</h1>
                  <AchievementBadge avgGrade={avgGradeNum} />
                </div>
                <p className="text-sm text-[var(--ll-text-muted)]">{dateLabel}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-center">
                  <p className="text-xl font-semibold text-[var(--ll-text)]">{lessonsThisWeek}</p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">Lessons this week</p>
                </div>
                <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-center">
                  <p className="text-xl font-semibold text-[var(--ll-text)]">{attendancePercent}%</p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">Attendance</p>
                </div>
                <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-center">
                  <p className="text-xl font-semibold text-[var(--ll-text)]">{avgGrade}%</p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">Average grade</p>
                </div>
                <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-center">
                  <p className="text-xl font-semibold text-[var(--ll-text)]">{chatMessagesCount}</p>
                  <p className="mt-1 text-xs text-[var(--ll-text-faint)]">AI questions this week</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Link
                  href="/student/today"
                  className="flex min-h-24 flex-col justify-center gap-1 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-accent-soft)] p-3 hover:bg-[rgba(24,211,158,0.15)]"
                >
                  <p className="text-sm font-semibold text-[var(--ll-accent)]">Continue today&apos;s lesson</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Open today&apos;s plan</p>
                </Link>
                <Link
                  href="/student/progress"
                  className="flex min-h-24 flex-col justify-center gap-1 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 hover:border-[var(--ll-border-strong)]"
                >
                  <p className="text-sm font-semibold text-[var(--ll-text)]">View my progress</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Grades and mastery</p>
                </Link>
                <Link
                  href="/student/certificates"
                  className="flex min-h-24 flex-col justify-center gap-1 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 hover:border-[var(--ll-border-strong)]"
                >
                  <p className="text-sm font-semibold text-[var(--ll-text)]">My certificates</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">View earned awards</p>
                </Link>
              </div>

              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 md:hidden">
                {quickNavItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="shrink-0 rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)]"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
        <LegalFooter variant="portal" />
      </main>
    </ErrorBoundary>
  );
}
