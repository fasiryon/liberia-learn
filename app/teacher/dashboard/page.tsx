"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Users, ClipboardCheck, CalendarDays, BarChart3 } from "lucide-react";
import { teacherWelcomeStorageKey } from "@/app/teacher/TeacherWelcomeGate";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { getTeacherGreeting } from "@/lib/student/greetings";
import { AlertBell } from "@/components/teacher/AlertBell";
import { WeeklySentiment } from "@/components/teacher/WeeklySentiment";

type DashboardData = {
  scheduledToday: number;
  completionRateToday: number;
  assignmentsPendingGrading: number;
  labsPendingReview: number;
  classPerformance: Array<{
    classId: string;
    className: string;
    subject: string;
    studentCount: number;
    lessonCount: number;
    lessonCompletionRate: number;
    averageQuizScore: number | null;
    lessonQuizPerformance: Array<{
      lessonKey: string;
      lessonTitle: string;
      averageQuizScore: number;
      attemptCount: number;
    }>;
    strugglingLesson: {
      lessonKey: string;
      lessonTitle: string;
      averageQuizScore: number;
      attemptCount: number;
    } | null;
    topStudents: Array<{
      studentId: string;
      userId: string;
      name: string;
      averageQuizScore: number;
      attemptCount: number;
      profileHref: string;
    }>;
    bottomStudents: Array<{
      studentId: string;
      userId: string;
      name: string;
      averageQuizScore: number;
      attemptCount: number;
      profileHref: string;
    }>;
    atRiskStudents: Array<{
      studentId: string;
      userId: string;
      name: string;
      classId: string;
      className: string;
      lastActivityAt: string | null;
      daysSinceActivity: number;
      profileHref: string;
    }>;
  }>;
  adaptiveStats: {
    studentsWithGaps: number;
    totalGapsDetected: number;
    avgMasteryScore: number;
    topWeakStrands: string[];
  };
  todayLessons: Array<{
    id: string;
    title: string;
    className: string;
    teacherName: string;
    durationMinutes: number;
    status: string;
    startedCount: number;
    completedCount: number;
    averageExitTicketScore: number | null;
  }>;
  recentLessons: Array<{ contentId: string; title: string; status: string; createdAt: string }>;
  classesWithoutLesson: string[];
  schoolCode: string | null;
  schoolName: string | null;
  teacherAlerts?: Array<{
    id: string;
    alertType: string;
    severity: string;
    reason: string;
    studentId: string | null;
    weakConcept: string | null;
    weakLesson: string | null;
    recommendedAction: string | null;
    studentHref: string | null;
    createdAt: string;
  }>;
};

export default function TeacherDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightState, setInsightState] = useState<
    Record<
      string,
      {
        loading: boolean;
        error: string | null;
        result: null | {
          recommendations: string[];
          strugglingLesson: string;
          reteachApproach: string;
          hadFallback: boolean;
        };
      }
    >
  >({});
  const adaptiveEnabled = process.env.NEXT_PUBLIC_ENABLE_ADAPTIVE_ENGINE !== "false";
  const [codeCopied, setCodeCopied] = useState(false);

  function copySchoolCode() {
    const code = data?.schoolCode;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(teacherWelcomeStorageKey, "true");
    }
    fetch("/api/teacher/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  async function handleClassInsights(classId: string) {
    setInsightState((current) => ({
      ...current,
      [classId]: { loading: true, error: null, result: current[classId]?.result ?? null },
    }));

    try {
      const response = await fetch("/api/teacher/class-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load class insights.");
      }

      setInsightState((current) => ({
        ...current,
        [classId]: { loading: false, error: null, result: payload },
      }));
    } catch (error: any) {
      setInsightState((current) => ({
        ...current,
        [classId]: {
          loading: false,
          error: error?.message ?? "Failed to load class insights.",
          result: current[classId]?.result ?? null,
        },
      }));
    }
  }

  const atRiskCount =
    data?.classPerformance.reduce((total, cls) => total + cls.atRiskStudents.length, 0) ?? 0;
  const pendingGradingCount = data?.assignmentsPendingGrading ?? 0;
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  async function dismissOnboardingBanner() {
    setOnboardingDismissed(true);
    await fetch("/api/teacher/onboarding/complete", { method: "POST" }).catch(() => null);
  }

  async function handleDismissAlert(alertId: string) {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
    await fetch("/api/teacher/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId, action: "dismissed" }),
    }).catch(() => null);
  }

  async function handleMarkReviewed(alertId: string) {
    setDismissedAlerts((prev) => new Set([...prev, alertId]));
    await fetch("/api/teacher/alerts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alertId, action: "reviewed" }),
    }).catch(() => null);
  }

  const visibleAlerts = (data?.teacherAlerts ?? []).filter((a) => !dismissedAlerts.has(a.id));

  return (
    <div className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
        <DashboardTopBar
          roleLabel="Teacher"
          roleBadgeBg="bg-[var(--ll-silver-soft)] border-[var(--ll-silver)]/20"
          roleAccent="text-[var(--ll-text-muted)]"
          userName={data?.schoolName ?? undefined}
          subtitle={data?.schoolCode ? `Code: ${data.schoolCode}` : undefined}
          rightSlot={
            <AlertBell
              alerts={visibleAlerts}
              onMarkReviewed={handleMarkReviewed}
              onDismiss={handleDismissAlert}
            />
          }
        />

        {(() => {
          const greeting = getTeacherGreeting({
            teacherName: data?.schoolName ?? undefined,
            atRiskCount,
            lessonsScheduledToday: data?.scheduledToday,
          });
          return (
            <div>
              <h1 className="text-2xl font-semibold text-[var(--ll-text)]">{greeting.headline}</h1>
              <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">{greeting.subtext}</p>
            </div>
          );
        })()}

        {!onboardingDismissed && !loading && (
          <div className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3">
            <p className="text-sm text-[var(--ll-text-muted)]">
              New to LiberiaLearn?{" "}
              <Link href="/teacher/onboarding" className="font-medium text-[var(--ll-yellow)] hover:underline">
                View setup guide →
              </Link>
            </p>
            <button
              type="button"
              onClick={dismissOnboardingBanner}
              className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
            >
              Dismiss
            </button>
          </div>
        )}

        {!loading && <WeeklySentiment />}

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <SkeletonCard key={i} />)}</div>
        ) : (
          <>
            {data?.classesWithoutLesson && data.classesWithoutLesson.length > 0 && (
              <div className="ll-notice ll-notice-warning">
                {data.classesWithoutLesson.length} class(es) have no lesson scheduled for today: {data.classesWithoutLesson.join(", ")}
              </div>
            )}

            {visibleAlerts.length > 0 && (
              <div
                data-testid="immediate-attention-panel"
                className="flex items-center justify-between rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                  </span>
                  <p className="text-sm font-medium text-[var(--ll-text)]">
                    {visibleAlerts.length} alert{visibleAlerts.length !== 1 ? "s" : ""} need attention
                  </p>
                </div>
                <Link
                  href="/teacher/alerts"
                  className="text-xs font-medium text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
                >
                  Review →
                </Link>
              </div>
            )}

            {(atRiskCount > 0 || pendingGradingCount > 0) && (
              <section className="ll-section p-4">
                <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                  Needs attention today
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {atRiskCount > 0 && (
                    <Link href="/teacher/students" className="ll-command ll-focus justify-between">
                      <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ll-text)]">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                        </span>
                        At-risk students
                      </span>
                      <span className="text-sm font-semibold text-[var(--ll-warning)]">{atRiskCount}</span>
                    </Link>
                  )}
                  {pendingGradingCount > 0 && (
                    <Link href="/teacher/assignments" className="ll-command ll-focus justify-between">
                      <span className="text-sm font-semibold text-[var(--ll-text)]">Assignments to grade</span>
                      <span className="text-sm font-semibold text-[var(--ll-warning)]">{pendingGradingCount}</span>
                    </Link>
                  )}
                </div>
              </section>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="ll-kpi border-t-2 border-t-[var(--ll-yellow)]/30">
                <p className="text-2xl font-semibold text-[var(--ll-text)]">{data?.scheduledToday || 0}</p>
                <p className="text-xs text-[var(--ll-text-faint)]">Lessons today</p>
              </div>
              <div className="ll-kpi border-t-2 border-t-[var(--ll-accent)]/30">
                <p className={`text-2xl font-semibold ${(data?.completionRateToday || 0) === 0 ? "text-[var(--ll-text-faint)]" : "text-[var(--ll-accent)]"}`}>{data?.completionRateToday || 0}%</p>
                <p className="text-xs text-[var(--ll-text-faint)]">Completion rate</p>
              </div>
              <div className="ll-kpi border-t-2 border-t-[var(--ll-warning)]/30">
                <p className={`text-2xl font-semibold ${(data?.assignmentsPendingGrading || 0) === 0 ? "text-[var(--ll-text-faint)]" : "text-[var(--ll-warning)]"}`}>{data?.assignmentsPendingGrading || 0}</p>
                <p className="text-xs text-[var(--ll-text-faint)]">Pending grading</p>
              </div>
              <div className="ll-kpi border-t-2 border-t-[var(--ll-warning)]/20">
                <p className={`text-2xl font-semibold ${(data?.labsPendingReview || 0) === 0 ? "text-[var(--ll-text-faint)]" : "text-[var(--ll-warning)]"}`}>{data?.labsPendingReview || 0}</p>
                <p className="text-xs text-[var(--ll-text-faint)]">Labs to review</p>
              </div>
            </div>

            {/* Primary Actions */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Link href="/teacher/students" className="ll-command ll-focus flex-col items-start">
                <Users className="h-4 w-4 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
                <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">View my classes</p>
              </Link>
              <Link href="/teacher/assignments" className="ll-command ll-focus flex-col items-start">
                <ClipboardCheck className="h-4 w-4 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
                <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">Grade assignments</p>
              </Link>
              <Link href="/teacher/schedule" className="ll-command ll-focus flex-col items-start">
                <CalendarDays className="h-4 w-4 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
                <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">Lesson planner</p>
              </Link>
              <Link href="/teacher/weekly-report" className="ll-command ll-focus flex-col items-start">
                <BarChart3 className="h-4 w-4 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
                <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">Weekly report</p>
              </Link>
            </div>

            {/* School code */}
            {data?.schoolCode && (
              <section className="ll-section p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">School registration code</p>
                    <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-[var(--ll-text)]">{data.schoolCode}</p>
                    <p className="mt-1 text-xs text-[var(--ll-text-faint)]">Share this code so students and guardians can self-register.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copySchoolCode}
                      className="ll-interactive rounded-lg border border-[var(--ll-border-strong)] bg-[var(--ll-surface-muted)] px-4 py-2 text-xs font-semibold text-[var(--ll-text)]"
                    >
                      {codeCopied ? "Copied!" : "Copy code"}
                    </button>
                    <a
                      href={`/register/student?code=${encodeURIComponent(data.schoolCode)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-2 text-xs font-semibold text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                    >
                      Shareable link
                    </a>
                  </div>
                </div>
              </section>
            )}

            {adaptiveEnabled && (
              <section className="ll-section p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--ll-text)]">Students Needing Extra Support</h2>
                    <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">Use this section first when deciding who needs intervention today.</p>
                  </div>
                  <span className="text-xs text-[var(--ll-text-faint)]">Closed-loop mastery</span>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                    <p className="text-2xl font-semibold text-[var(--ll-text)]">
                      {data?.adaptiveStats?.studentsWithGaps ?? 0}
                    </p>
                    <p className="text-xs text-[var(--ll-text-faint)]">Students with gaps</p>
                  </div>
                  <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                    <p className={`text-2xl font-semibold ${(data?.adaptiveStats?.totalGapsDetected ?? 0) > 0 ? "text-[var(--ll-warning)]" : "text-[var(--ll-text)]"}`}>
                      {data?.adaptiveStats?.totalGapsDetected ?? 0}
                    </p>
                    <p className="text-xs text-[var(--ll-text-faint)]">Total gaps detected</p>
                  </div>
                  <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                    <p className="text-2xl font-semibold text-[var(--ll-accent)]">
                      {data?.adaptiveStats?.avgMasteryScore ?? 0}
                    </p>
                    <p className="text-xs text-[var(--ll-text-faint)]">Average mastery score</p>
                  </div>
                  <div className="rounded-xl bg-[var(--ll-surface-muted)] p-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                      Top weak strands
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-[var(--ll-text-muted)]">
                      {(data?.adaptiveStats?.topWeakStrands?.length ?? 0) === 0 ? (
                        <li className="text-[var(--ll-text-faint)]">No adaptive attempts yet.</li>
                      ) : (
                        data?.adaptiveStats?.topWeakStrands?.map((strand) => (
                          <li key={strand}>{strand}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            <section className="ll-section p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--ll-text)]">Class Performance Intelligence</h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                    Lesson completion, lesson quiz performance, and students who have had no activity for 7 or more days.
                  </p>
                </div>
                <Link href="/teacher/weekly-report" className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]">
                  Open weekly report
                </Link>
              </div>

              {(!data?.classPerformance || data.classPerformance.length === 0) ? (
                <div className="mt-4 ll-section p-6 text-center">
                  <p className="text-sm leading-6 text-[var(--ll-text-muted)]">No class data yet. Add students to your classes to see performance here.</p>
                  <Link href="/teacher/students" className="ll-command ll-focus mt-3 inline-flex text-sm font-semibold text-[var(--ll-text)]">View classes</Link>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {data.classPerformance.map((cls) => {
                    const insights = insightState[cls.classId];
                    return (
                      <article key={cls.classId} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-[var(--ll-text)]">{cls.className}</h3>
                            <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                              {cls.subject.replace(/_/g, " ")} · {cls.studentCount} students · {cls.lessonCount} lessons
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleClassInsights(cls.classId)}
                            className="ll-interactive min-h-11 rounded-lg border border-[var(--ll-border-strong)] bg-[var(--ll-surface-muted)] px-4 py-2 text-xs font-semibold text-[var(--ll-text)]"
                          >
                            {insights?.loading ? "Loading insights..." : "AI Class Insights"}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                            <p className="text-xs text-[var(--ll-text-faint)]">Lesson completion</p>
                            <p className="mt-2 text-2xl font-semibold text-[var(--ll-accent)]">{cls.lessonCompletionRate}%</p>
                          </div>
                          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                            <p className="text-xs text-[var(--ll-text-faint)]">Average quiz score</p>
                            <p className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">
                              {cls.averageQuizScore == null ? "No data" : `${cls.averageQuizScore}%`}
                            </p>
                          </div>
                          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                            <p className="text-xs text-[var(--ll-text-faint)]">At-risk students</p>
                            <p className={`mt-2 text-2xl font-semibold ${cls.atRiskStudents.length > 0 ? "text-[var(--ll-warning)]" : "text-[var(--ll-text)]"}`}>{cls.atRiskStudents.length}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">Lesson quiz averages</p>
                            {cls.lessonQuizPerformance.length === 0 ? (
                              <p className="mt-3 text-sm text-[var(--ll-text-faint)]">No lesson quizzes completed yet.</p>
                            ) : (
                              <div className="mt-3 space-y-3">
                                {cls.lessonQuizPerformance.slice(0, 4).map((lesson) => (
                                  <div key={lesson.lessonKey} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-medium text-[var(--ll-text)]">{lesson.lessonTitle}</p>
                                      <span className="text-sm font-semibold text-[var(--ll-text)]">{lesson.averageQuizScore}%</span>
                                    </div>
                                    <p className="mt-1 text-xs text-[var(--ll-text-faint)]">{lesson.attemptCount} quiz attempt(s)</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {cls.strugglingLesson ? (
                              <p className="mt-3 text-xs text-[var(--ll-warning)]">
                                Lowest-performing lesson: {cls.strugglingLesson.lessonTitle}
                              </p>
                            ) : null}
                          </section>

                          {cls.atRiskStudents.length > 0 && (
                            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">At-risk students</p>
                              <div className="mt-3 space-y-2">
                                {cls.atRiskStudents.slice(0, 5).map((student, idx) => (
                                  <Link
                                    key={student.studentId}
                                    href={student.profileHref}
                                    className={`ll-interactive flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3${idx >= 3 ? " hidden sm:flex" : ""}`}
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-[var(--ll-text)]">{student.name}</p>
                                      <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                                        {student.lastActivityAt
                                          ? `Last activity ${new Date(student.lastActivityAt).toLocaleDateString("en-LR")}`
                                          : "No lesson or quiz activity yet"}
                                      </p>
                                    </div>
                                    <span className="text-xs font-semibold text-[var(--ll-warning)]">
                                      {student.daysSinceActivity >= 999 ? "No activity" : `${student.daysSinceActivity} days`}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            </section>
                          )}
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">Top 3 students</p>
                            {cls.topStudents.length === 0 ? (
                              <p className="mt-3 text-sm text-[var(--ll-text-faint)]">No quiz ranking data yet.</p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {cls.topStudents.map((student) => (
                                  <Link key={student.studentId} href={student.profileHref} className="flex items-center justify-between rounded-xl bg-[var(--ll-surface-muted)] px-4 py-3 hover:border hover:border-[var(--ll-accent)]/30">
                                    <span className="text-sm text-[var(--ll-text)]">{student.name}</span>
                                    <span className="text-sm font-semibold text-[var(--ll-accent)]">{student.averageQuizScore}%</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </section>

                          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">Bottom 3 students</p>
                            {cls.bottomStudents.length === 0 ? (
                              <p className="mt-3 text-sm text-[var(--ll-text-faint)]">No quiz ranking data yet.</p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {cls.bottomStudents.map((student) => (
                                  <Link key={student.studentId} href={student.profileHref} className="flex items-center justify-between rounded-xl bg-[var(--ll-surface-muted)] px-4 py-3 hover:border hover:border-[var(--ll-warning)]/30">
                                    <span className="text-sm text-[var(--ll-text)]">{student.name}</span>
                                    <span className="text-sm font-semibold text-[var(--ll-warning)]">{student.averageQuizScore}%</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </section>
                        </div>

                        {insights?.error ? (
                          <div className="mt-4 ll-notice ll-notice-error">
                            {insights.error}
                          </div>
                        ) : null}

                        {insights?.result ? (
                          <section className="mt-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4">
                            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">AI class insights</p>
                            <div className="mt-3 space-y-2 text-sm text-[var(--ll-text-muted)]">
                              {insights.result.recommendations.map((recommendation, index) => (
                                <p key={`${cls.classId}-insight-${index}`}>{index + 1}. {recommendation}</p>
                              ))}
                            </div>
                            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">
                              <span className="font-semibold text-[var(--ll-text)]">Most difficult lesson:</span> {insights.result.strugglingLesson}
                            </p>
                            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
                              <span className="font-semibold text-[var(--ll-text)]">Reteach approach:</span> {insights.result.reteachApproach}
                            </p>
                            {insights.result.hadFallback ? (
                              <p className="mt-2 text-xs text-[var(--ll-warning)]">Fallback guidance was used for this response.</p>
                            ) : null}
                          </section>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <details className="ll-section p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--ll-text-muted)]">
                Today&apos;s scheduled lessons
                <ChevronRight size={14} className="text-[var(--ll-text-faint)]" />
              </summary>
              <div className="mt-3 flex items-center justify-end">
                <Link href="/teacher/schedule" className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]">
                  Open Schedule
                </Link>
              </div>
              {(!data?.todayLessons || data.todayLessons.length === 0) ? (
                <p className="text-sm text-[var(--ll-text-faint)]">No lessons scheduled for today.</p>
              ) : (
                <div className="space-y-3">
                  {data.todayLessons.map((lesson) => (
                    <div key={lesson.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--ll-text)]">{lesson.title}</p>
                          <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                            {lesson.className} · {lesson.teacherName} · {lesson.durationMinutes}-minute{" "}
                            {lesson.durationMinutes >= 90 ? "block" : "period"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            lesson.status === "delivered"
                              ? "bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]"
                              : "bg-[rgba(250,204,21,0.08)] text-[var(--ll-warning)]"
                          }`}
                        >
                          {lesson.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                          <p className="text-lg font-semibold text-[var(--ll-text)]">{lesson.startedCount}</p>
                          <p className="text-[11px] text-[var(--ll-text-faint)]">Started</p>
                        </div>
                        <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                          <p className="text-lg font-semibold text-[var(--ll-text)]">{lesson.completedCount}</p>
                          <p className="text-[11px] text-[var(--ll-text-faint)]">Completed</p>
                        </div>
                        <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                          <p className="text-lg font-semibold text-[var(--ll-text)]">
                            {lesson.averageExitTicketScore ?? "—"}
                          </p>
                          <p className="text-[11px] text-[var(--ll-text-faint)]">Avg exit ticket</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </details>

            <details className="ll-section p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--ll-text-muted)]">
                Recent published lessons
                <ChevronRight size={14} className="text-[var(--ll-text-faint)]" />
              </summary>
              {(!data?.recentLessons || data.recentLessons.length === 0) ? (
                <div className="ll-section mt-3 p-6 text-center">
                  <p className="text-sm leading-6 text-[var(--ll-text-muted)]">You have not created any lessons yet.</p>
                  <Link href="/teacher/create-lesson" className="ll-command ll-focus mt-3 inline-flex text-sm font-semibold text-[var(--ll-text)]">
                    Create a lesson
                  </Link>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.recentLessons.slice(0, 5).map((l) => (
                    <div key={l.contentId} className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-2">
                      <div>
                        <p className="text-sm text-[var(--ll-text)]">{l.title}</p>
                        <p className="text-xs text-[var(--ll-text-faint)]">{new Date(l.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${l.status === "APPROVED" ? "bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]" : "bg-[rgba(250,204,21,0.08)] text-[var(--ll-warning)]"}`}>
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </details>
          </>
        )}
      </div>
    </div>
  );
}
