"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Users, ClipboardCheck, CalendarDays, BarChart3 } from "lucide-react";
import { EventCalendar } from "@/components/EventCalendar";
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
  classes?: Array<{ id: string; name: string; subject: string; gradeLevel: number | null }>;
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

type WeeklyPlan = {
  weekTitle: string;
  days: Array<{
    day: string;
    lessonTitle: string;
    contentId: string | null;
    objectives: string[];
    suggestedActivities: string[];
    estimatedMinutes: number;
  }>;
  teacherNotes: string;
};

export default function TeacherDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [newSubmissionCount, setNewSubmissionCount] = useState(0);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planningMessage, setPlanningMessage] = useState<string | null>(null);
  const pendingGradingRef = useRef<number | null>(null);
  const adaptiveEnabled = process.env.NEXT_PUBLIC_ENABLE_ADAPTIVE_ENGINE !== "false";
  const [codeCopied, setCodeCopied] = useState(false);
  const [reportCardNudge, setReportCardNudge] = useState(0);

  useEffect(() => {
    fetch("/api/teacher/report-cards", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setReportCardNudge(d.draftWithoutComment ?? 0))
      .catch(() => null);
  }, []);

  function copySchoolCode() {
    const code = data?.schoolCode;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  const loadDashboard = useCallback(async (source: "page" | "poll" = "page") => {
    const response = await fetch("/api/teacher/dashboard", { cache: "no-store" });
    const nextData = (await response.json()) as DashboardData;
    if (!response.ok) throw new Error("Failed to load dashboard");
    const previousPending = pendingGradingRef.current;
    const nextPending = nextData.assignmentsPendingGrading ?? 0;
    if (source === "poll" && previousPending !== null && nextPending > previousPending) {
      setNewSubmissionCount((current) => current + nextPending - previousPending);
    }
    pendingGradingRef.current = nextPending;
    setData(nextData);
    setLastUpdatedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(teacherWelcomeStorageKey, "true");
    }
    loadDashboard("page").finally(() => setLoading(false));
  }, [loadDashboard]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboard("poll").catch(() => null);
    }, 60000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const atRiskCount =
    data?.classPerformance.reduce((total, cls) => total + cls.atRiskStudents.length, 0) ?? 0;
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

  async function generateWeeklyPlan() {
    const cls = data?.classes?.find((entry) => entry.gradeLevel);
    if (!cls) {
      setPlanningMessage("No class with a grade level is available for planning.");
      return;
    }
    setPlanning(true);
    setPlanningMessage(null);
    const today = new Date();
    const monday = new Date(today);
    const day = today.getDay() || 7;
    monday.setDate(today.getDate() - day + 1);
    const weekStartDate = monday.toISOString().slice(0, 10);
    try {
      const response = await fetch("/api/teacher/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: cls.id, weekStartDate }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to generate weekly plan");
      setWeeklyPlan(result.plan as WeeklyPlan);
      setPlanningMessage(`Draft plan generated for ${cls.name}. Edit before using in class.`);
    } catch (error: any) {
      setPlanningMessage(error?.message ?? "Failed to generate weekly plan");
    } finally {
      setPlanning(false);
    }
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

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="truncate text-xs text-[var(--ll-text-muted)]">
            Last updated{" "}
            {lastUpdatedAt
              ? new Date(lastUpdatedAt).toLocaleTimeString("en-LR", {
                  hour: "numeric",
                  minute: "2-digit",
                })
              : "not checked yet"}
          </p>
          {newSubmissionCount > 0 ? (
            <Link
              href="/teacher/students?recentSubmissions=1"
              onClick={() => setNewSubmissionCount(0)}
              className="w-fit rounded-full bg-[var(--ll-yellow-soft)] px-3 py-1 text-xs font-semibold text-[var(--ll-yellow)]"
            >
              {newSubmissionCount} new submission{newSubmissionCount === 1 ? "" : "s"} since last
              update
            </Link>
          ) : null}
        </div>

        {(() => {
          const greeting = getTeacherGreeting({
            teacherName: data?.schoolName ?? undefined,
            atRiskCount,
            lessonsScheduledToday: data?.scheduledToday,
          });
          return (
            <div>
              <h1 className="text-2xl font-semibold text-[var(--ll-text)]">{greeting.headline}</h1>
              <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                {greeting.subtext}
              </p>
            </div>
          );
        })()}

        {!onboardingDismissed && !loading && (
          <div className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3">
            <p className="text-sm text-[var(--ll-text-muted)]">
              New to LiberiaLearn?{" "}
              <Link
                href="/teacher/onboarding"
                className="font-medium text-[var(--ll-yellow)] hover:underline"
              >
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
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <>
            {/* Warning banner */}
            {data?.classesWithoutLesson && data.classesWithoutLesson.length > 0 && (
              <div className="ll-notice ll-notice-warning">
                {data.classesWithoutLesson.length} class(es) have no lesson scheduled for today:{" "}
                {data.classesWithoutLesson.join(", ")}
              </div>
            )}

            {/* Alert row */}
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
                    {visibleAlerts.length} alert{visibleAlerts.length !== 1 ? "s" : ""} need
                    attention
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

            {/* Report card comment nudge */}
            {reportCardNudge > 0 && (
              <div className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3">
                <p className="text-sm text-[var(--ll-text-muted)]">
                  <span className="font-semibold text-[var(--ll-text)]">{reportCardNudge}</span>{" "}
                  student{reportCardNudge !== 1 ? "s" : ""} awaiting your comment on their report card.
                </p>
                <Link
                  href="/teacher/report-cards"
                  className="shrink-0 text-xs font-medium text-[var(--ll-yellow)] hover:underline"
                >
                  Add comments →
                </Link>
              </div>
            )}

            {/* Today's scheduled lessons — above KPI so teachers see today's work first */}
            <details className="ll-section p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--ll-text-muted)]">
                Today&apos;s scheduled lessons
                <ChevronRight size={14} className="text-[var(--ll-text-faint)]" />
              </summary>
              <div className="mt-3 flex items-center justify-end">
                <Link
                  href="/teacher/schedule"
                  className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
                >
                  Open Schedule
                </Link>
              </div>
              {!data?.todayLessons || data.todayLessons.length === 0 ? (
                <p className="text-sm text-[var(--ll-text-faint)]">
                  No lessons scheduled for today.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.todayLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--ll-text)]">
                            {lesson.title}
                          </p>
                          <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                            {lesson.className} · {lesson.teacherName} · {lesson.durationMinutes}
                            -minute {lesson.durationMinutes >= 90 ? "block" : "period"}
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
                          <p className="text-lg font-semibold text-[var(--ll-text)]">
                            {lesson.startedCount}
                          </p>
                          <p className="text-[11px] text-[var(--ll-text-faint)]">Started</p>
                        </div>
                        <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                          <p className="text-lg font-semibold text-[var(--ll-text)]">
                            {lesson.completedCount}
                          </p>
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

            {/* Recent published lessons — above KPI */}
            <details className="ll-section p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--ll-text-muted)]">
                Recent published lessons
                <ChevronRight size={14} className="text-[var(--ll-text-faint)]" />
              </summary>
              {!data?.recentLessons || data.recentLessons.length === 0 ? (
                <div className="ll-section mt-3 p-6 text-center">
                  <p className="text-sm leading-6 text-[var(--ll-text-muted)]">
                    You have not created any lessons yet.
                  </p>
                  <Link
                    href="/teacher/create-lesson"
                    className="ll-command ll-focus mt-3 inline-flex text-sm font-semibold text-[var(--ll-text)]"
                  >
                    Create a lesson
                  </Link>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {data.recentLessons.slice(0, 5).map((l) => (
                    <div
                      key={l.contentId}
                      className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-2"
                    >
                      <div>
                        <p className="text-sm text-[var(--ll-text)]">{l.title}</p>
                        <p className="text-xs text-[var(--ll-text-faint)]">
                          {new Date(l.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          l.status === "APPROVED"
                            ? "bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]"
                            : "bg-[rgba(250,204,21,0.08)] text-[var(--ll-warning)]"
                        }`}
                      >
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </details>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="ll-kpi border-t-2 border-t-[var(--ll-yellow)]/30">
                <p className="text-xl font-semibold text-[var(--ll-text)]">
                  {data?.scheduledToday || 0}
                </p>
                <p className="text-xs text-[var(--ll-text-faint)]">Lessons today</p>
              </div>
              <div className="ll-kpi border-t-2 border-t-[var(--ll-accent)]/30">
                <p
                  className={`text-xl font-semibold ${
                    (data?.completionRateToday || 0) === 0
                      ? "text-[var(--ll-text-faint)]"
                      : "text-[var(--ll-accent)]"
                  }`}
                >
                  {data?.completionRateToday || 0}%
                </p>
                <p className="text-xs text-[var(--ll-text-faint)]">Completion rate</p>
              </div>
              <div className="ll-kpi border-t-2 border-t-[var(--ll-warning)]/30">
                <p
                  className={`text-xl font-semibold ${
                    (data?.assignmentsPendingGrading || 0) === 0
                      ? "text-[var(--ll-text-faint)]"
                      : "text-[var(--ll-warning)]"
                  }`}
                >
                  {data?.assignmentsPendingGrading || 0}
                </p>
                <p className="text-xs text-[var(--ll-text-faint)]">Pending grading</p>
              </div>
              <div className="ll-kpi border-t-2 border-t-[var(--ll-warning)]/20">
                <p
                  className={`text-xl font-semibold ${
                    (data?.labsPendingReview || 0) === 0
                      ? "text-[var(--ll-text-faint)]"
                      : "text-[var(--ll-warning)]"
                  }`}
                >
                  {data?.labsPendingReview || 0}
                </p>
                <p className="text-xs text-[var(--ll-text-faint)]">Labs to review</p>
              </div>
            </div>

            {/* Events widget */}
            <div className="ll-section p-4">
              <EventCalendar role="TEACHER" compact />
            </div>

            {/* Primary Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Link href="/teacher/students" className="ll-command ll-focus justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ll-text)]">
                  <Users className="h-4 w-4 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
                  View my classes
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
              </Link>
              <Link href="/teacher/assignments" className="ll-command ll-focus justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ll-text)]">
                  <ClipboardCheck
                    className="h-4 w-4 text-[var(--ll-text-faint)]"
                    strokeWidth={1.5}
                  />
                  Grade assignments
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
              </Link>
              <Link href="/teacher/schedule" className="ll-command ll-focus justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ll-text)]">
                  <CalendarDays
                    className="h-4 w-4 text-[var(--ll-text-faint)]"
                    strokeWidth={1.5}
                  />
                  Lesson planner
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
              </Link>
              <button
                type="button"
                onClick={generateWeeklyPlan}
                disabled={planning}
                className="ll-command ll-focus justify-between disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ll-text)]">
                  <CalendarDays
                    className="h-4 w-4 text-[var(--ll-text-faint)]"
                    strokeWidth={1.5}
                  />
                  {planning ? "Generating plan..." : "Generate this week's plan"}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
              </button>
              <Link href="/teacher/weekly-report" className="ll-command ll-focus justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold text-[var(--ll-text)]">
                  <BarChart3 className="h-4 w-4 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
                  Weekly report
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
              </Link>
            </div>

            {(weeklyPlan || planningMessage) && (
              <section className="ll-section p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[var(--ll-text)]">
                      {weeklyPlan?.weekTitle ?? "Weekly lesson plan"}
                    </h2>
                    {planningMessage ? (
                      <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{planningMessage}</p>
                    ) : null}
                  </div>
                  {weeklyPlan ? (
                    <button
                      type="button"
                      className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-xs font-semibold text-[var(--ll-text)]"
                      onClick={() => setPlanningMessage("Plan kept as an editable teacher draft.")}
                    >
                      Save draft
                    </button>
                  ) : null}
                </div>
                {weeklyPlan ? (
                  <div className="mt-4 space-y-3">
                    {weeklyPlan.days.map((day) => (
                      <div
                        key={day.day}
                        className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ll-text-faint)]">
                              {day.day} · {day.estimatedMinutes} min
                            </p>
                            {day.contentId ? (
                              <Link
                                href={`/student/lesson/${day.contentId}`}
                                className="mt-1 block text-sm font-semibold text-[var(--ll-yellow)] hover:underline"
                              >
                                {day.lessonTitle}
                              </Link>
                            ) : (
                              <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">
                                {day.lessonTitle}
                              </p>
                            )}
                          </div>
                          <span className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text-muted)]">
                            {day.contentId ? "Linked lesson" : "No lesson link"}
                          </span>
                        </div>
                        <textarea
                          className="mt-3 min-h-[88px] w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-sm text-[var(--ll-text)]"
                          defaultValue={[
                            ...day.objectives.map((item) => `Objective: ${item}`),
                            ...day.suggestedActivities.map((item) => `Activity: ${item}`),
                          ].join("\n")}
                        />
                      </div>
                    ))}
                    <textarea
                      className="min-h-[88px] w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-sm text-[var(--ll-text)]"
                      defaultValue={weeklyPlan.teacherNotes}
                    />
                  </div>
                ) : null}
              </section>
            )}

            {/* Class Performance Intelligence — compact summary rows */}
            <section className="ll-section p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[var(--ll-text)]">
                    Class Performance Intelligence
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                    Lesson completion, quiz scores, and students needing support.
                  </p>
                </div>
                <Link
                  href="/teacher/weekly-report"
                  className="text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text-muted)]"
                >
                  Open weekly report
                </Link>
              </div>

              {!data?.classPerformance || data.classPerformance.length === 0 ? (
                <div className="mt-4 ll-section p-6 text-center">
                  <p className="text-sm leading-6 text-[var(--ll-text-muted)]">
                    No class data yet. Add students to your classes to see performance here.
                  </p>
                  <Link
                    href="/teacher/students"
                    className="ll-command ll-focus mt-3 inline-flex text-sm font-semibold text-[var(--ll-text)]"
                  >
                    View classes
                  </Link>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.classPerformance.map((cls) => (
                    <div
                      key={cls.classId}
                      className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[var(--ll-text)]">
                            {cls.className}
                          </p>
                          <p className="text-xs text-[var(--ll-text-faint)] mt-0.5">
                            {cls.subject.replace(/_/g, " ")} · {cls.studentCount} students ·{" "}
                            {cls.lessonCount} lessons
                          </p>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-[var(--ll-text-faint)]">Completion</p>
                            <p
                              className={`text-sm font-semibold ${
                                cls.lessonCompletionRate > 60
                                  ? "text-[var(--ll-yellow)]"
                                  : "text-[var(--ll-danger)]"
                              }`}
                            >
                              {cls.lessonCompletionRate}%
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[var(--ll-text-faint)]">Avg score</p>
                            <p className="text-sm font-semibold text-[var(--ll-text)]">
                              {cls.averageQuizScore === null ? "—" : `${cls.averageQuizScore}%`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-[var(--ll-text-faint)]">At risk</p>
                            <p
                              className={`text-sm font-semibold ${
                                cls.atRiskStudents.length > 0
                                  ? "text-[var(--ll-danger)]"
                                  : "text-[var(--ll-text-faint)]"
                              }`}
                            >
                              {cls.atRiskStudents.length}
                            </p>
                          </div>
                          <Link
                            href={`/teacher/students?class=${cls.classId}`}
                            className="text-xs text-[var(--ll-yellow)] hover:opacity-80 transition-opacity flex-shrink-0"
                          >
                            View →
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Students Needing Extra Support — only shown when data exists */}
            {adaptiveEnabled &&
              ((data?.adaptiveStats?.studentsWithGaps ?? 0) > 0 ||
                (data?.adaptiveStats?.totalGapsDetected ?? 0) > 0) && (
                <section className="ll-section p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-[var(--ll-text)]">
                        Students Needing Extra Support
                      </h2>
                      <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
                        Use this section first when deciding who needs intervention today.
                      </p>
                    </div>
                    <span className="text-xs text-[var(--ll-text-faint)]">Closed-loop mastery</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                      <p className="text-xl font-semibold text-[var(--ll-text)]">
                        {data?.adaptiveStats?.studentsWithGaps ?? 0}
                      </p>
                      <p className="text-xs text-[var(--ll-text-faint)]">Students with gaps</p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                      <p
                        className={`text-xl font-semibold ${
                          (data?.adaptiveStats?.totalGapsDetected ?? 0) > 0
                            ? "text-[var(--ll-warning)]"
                            : "text-[var(--ll-text)]"
                        }`}
                      >
                        {data?.adaptiveStats?.totalGapsDetected ?? 0}
                      </p>
                      <p className="text-xs text-[var(--ll-text-faint)]">Total gaps detected</p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
                      <p className="text-xl font-semibold text-[var(--ll-accent)]">
                        {data?.adaptiveStats?.avgMasteryScore ?? 0}
                      </p>
                      <p className="text-xs text-[var(--ll-text-faint)]">Average mastery score</p>
                    </div>
                    <div className="rounded-xl bg-[var(--ll-surface-muted)] p-3">
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

            {/* School registration code — moved to bottom */}
            {data?.schoolCode && (
              <section className="ll-section p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                      School registration code
                    </p>
                    <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-[var(--ll-text)]">
                      {data.schoolCode}
                    </p>
                    <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                      Share this code so students and guardians can self-register.
                    </p>
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
          </>
        )}
      </div>
    </div>
  );
}
