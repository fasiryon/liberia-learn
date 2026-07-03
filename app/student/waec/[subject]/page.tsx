import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ArrowRight, FileText } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { StudentSidebar } from "@/components/StudentSidebar";
import { LegalFooter } from "@/components/LegalFooter";
import { getStudentWaecReadiness } from "@/lib/waec/readiness";
import { waecSubjectFromSlug, waecSlug } from "@/lib/waec/syllabus";
import { WaecHeader, ReadinessRing, TrendChip } from "@/components/waec/WaecUi";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";

export const dynamic = "force-dynamic";

function topicStatus(score: number | null): { label: string; cls: string } {
  if (score == null) return { label: "Not started", cls: "text-[var(--ll-text-faint)]" };
  if (score >= 85) return { label: "Mastered", cls: "text-emerald-400" };
  if (score >= 50) return { label: "On track", cls: "text-[var(--ll-yellow)]" };
  return { label: "Needs work", cls: "text-red-400" };
}

export default async function WaecSubjectDetailPage({ params }: { params: { subject: string } }) {
  const subject = waecSubjectFromSlug(params.subject);
  if (!subject) notFound();

  const session = (await getServerSession(authOptions)) as { user?: { id?: string; role?: string } } | null;
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "TEACHER") redirect("/teacher");
  if (session.user.role === "ADMIN") redirect("/admin");

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id },
    select: {
      id: true, currentGrade: true,
      user: { select: { name: true } },
      enrollments: { include: { Class: { include: { School: true, Teacher: true } } } },
    },
  });
  if (!student || (student.currentGrade ?? 0) < WAEC_MIN_GRADE) redirect("/dashboard");

  const r = await getStudentWaecReadiness(student.id, subject.id);

  // Recent WAEC-style essay attempts for this subject (empty until practice essays are graded).
  let essayCount = 0;
  try {
    essayCount = await prisma.gradedSubmission.count({ where: { studentId: student.id } });
  } catch { /* model optional */ }

  const studentName = student.user?.name || "Student";
  const firstEnrollment = student.enrollments[0];
  const school = firstEnrollment?.Class?.School?.name || "Demo School";
  const teacherName = firstEnrollment?.Class?.Teacher?.name || "Teacher";
  const slug = waecSlug(subject.id);

  return (
    <ErrorBoundary>
      <main className="ll-dashboard-shell">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-3 py-5 sm:px-4 sm:py-6">
          <DashboardTopBar
            roleLabel="Student"
            roleBadgeBg="bg-[var(--ll-yellow)]/10 border-emerald-500/20"
            roleAccent="text-[var(--ll-accent)]"
            userName={studentName}
            subtitle={`${subject.name} · WAEC Prep`}
          />

          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            <StudentSidebar school={school} teacherName={teacherName} studentName={studentName} showWaec />

            <section className="flex flex-1 flex-col gap-4">
              <Link href="/student/waec" className="inline-flex w-fit items-center gap-1 text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text)]">
                <ChevronLeft size={14} /> All WAEC subjects
              </Link>

              <WaecHeader subtitle={subject.name} />

              {/* Readiness summary + practice CTA */}
              <div className="flex flex-col gap-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <ReadinessRing value={r.readiness} />
                  <div>
                    <p className="text-sm font-semibold text-[var(--ll-text)]">
                      {r.readiness == null ? "Not yet assessed" : `${r.readiness}% ready`}
                    </p>
                    <div className="mt-1 flex items-center gap-3">
                      <TrendChip trend={r.trend} />
                      <span className="text-xs text-[var(--ll-text-faint)]">Syllabus covered: {Math.round(r.coverage * 100)}%</span>
                    </div>
                    {r.nextFocusName && (
                      <p className="mt-1 text-xs text-[var(--ll-text-muted)]">Next focus: <span className="text-[var(--ll-text)]">{r.nextFocusName}</span></p>
                    )}
                  </div>
                </div>
                <Link
                  href={`/student/waec/${slug}/practice`}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] hover:opacity-90"
                >
                  {r.readiness == null ? "Take a placement assessment" : "Start practice"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              {/* Syllabus topic coverage */}
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <h2 className="mb-3 text-sm font-semibold text-[var(--ll-text)]">WAEC syllabus coverage</h2>
                <div className="flex flex-col gap-3">
                  {r.topics.map((t) => {
                    const st = topicStatus(t.score);
                    return (
                      <div key={t.topicId} className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm text-[var(--ll-text)]">{t.name}</span>
                            <span className={`shrink-0 text-xs ${st.cls}`}>{st.label}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ll-surface-muted)]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${t.score ?? 0}%`,
                                background: t.score == null ? "transparent" : t.score >= 75 ? "#22c55e" : t.score >= 50 ? "var(--ll-yellow)" : "#f87171",
                              }}
                            />
                          </div>
                        </div>
                        <span className="w-10 shrink-0 text-right text-xs text-[var(--ll-text-muted)]">
                          {t.score == null ? "—" : `${Math.round(t.score)}%`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent WAEC-style attempts */}
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ll-text)]">
                  <FileText className="h-4 w-4 text-[var(--ll-text-faint)]" /> Recent WAEC-style attempts
                </h2>
                {essayCount === 0 ? (
                  <p className="text-xs text-[var(--ll-text-muted)]">
                    No WAEC-style questions attempted yet. Start a practice session to build your record.
                  </p>
                ) : (
                  <p className="text-xs text-[var(--ll-text-muted)]">{essayCount} graded submission(s) on record.</p>
                )}
              </div>
            </section>
          </div>
        </div>
        <LegalFooter variant="portal" />
      </main>
    </ErrorBoundary>
  );
}
