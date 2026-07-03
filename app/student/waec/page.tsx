import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { StudentSidebar } from "@/components/StudentSidebar";
import { LegalFooter } from "@/components/LegalFooter";
import { getStudentWaecReadinessAll } from "@/lib/waec/readiness";
import { WaecHeader, WaecSubjectCard } from "@/components/waec/WaecUi";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";

export const dynamic = "force-dynamic";

export default async function WaecDashboardPage() {
  const session = (await getServerSession(authOptions)) as { user?: { id?: string; role?: string } } | null;
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "TEACHER") redirect("/teacher");
  if (session.user.role === "ADMIN") redirect("/admin");

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id },
    select: {
      id: true,
      currentGrade: true,
      county: true,
      user: { select: { name: true } },
      enrollments: { include: { Class: { include: { School: true, Teacher: true } } } },
    },
  });

  // Grade gate — WAEC prep is Grade 9+. Lower grades never see this surface.
  if (!student || (student.currentGrade ?? 0) < WAEC_MIN_GRADE) redirect("/dashboard");

  const readiness = await getStudentWaecReadinessAll(student.id);
  const assessed = readiness.filter((r) => r.readiness != null);
  const overall =
    assessed.length > 0
      ? Math.round(assessed.reduce((s, r) => s + (r.readiness ?? 0), 0) / assessed.length)
      : null;

  const studentName = student.user?.name || "Student";
  const firstEnrollment = student.enrollments[0];
  const school = firstEnrollment?.Class?.School?.name || "Demo School";
  const teacherName = firstEnrollment?.Class?.Teacher?.name || "Teacher";

  return (
    <ErrorBoundary>
      <main className="ll-dashboard-shell">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-5 sm:px-4 sm:py-6">
          <DashboardTopBar
            roleLabel="Student"
            roleBadgeBg="bg-[var(--ll-yellow)]/10 border-emerald-500/20"
            roleAccent="text-[var(--ll-accent)]"
            userName={studentName}
            subtitle={`Grade ${student.currentGrade} · WAEC Prep`}
          />

          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            <StudentSidebar school={school} teacherName={teacherName} studentName={studentName} showWaec />

            <section className="flex flex-1 flex-col gap-4">
              <Link
                href="/dashboard"
                className="inline-flex w-fit items-center gap-1 text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text)]"
              >
                <ChevronLeft size={14} /> Dashboard
              </Link>

              <WaecHeader
                subtitle={
                  overall != null
                    ? `Overall readiness across assessed subjects: ${overall}%`
                    : "Complete lessons or take a placement assessment to see your readiness."
                }
              />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {readiness.map((r) => (
                  <WaecSubjectCard key={r.subjectId} r={r} />
                ))}
              </div>

              <p className="text-[11px] leading-relaxed text-[var(--ll-text-faint)]">
                Readiness is computed from your mastery across the WAEC syllabus topics for each
                subject. Subjects with no data yet show a placement prompt — nothing is estimated.
              </p>
            </section>
          </div>
        </div>
        <LegalFooter variant="portal" />
      </main>
    </ErrorBoundary>
  );
}
