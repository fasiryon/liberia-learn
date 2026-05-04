"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Clock3, ListChecks, RefreshCw, TrendingUp } from "lucide-react";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { GuidedEmptyState } from "@/components/onboarding/GuidedEmptyState";
import { useAssignmentPolling } from "@/lib/hooks/useAssignmentPolling";

type WorkStatus = "not_started" | "in_progress" | "completed";
type ScheduleStatus = "current" | "upcoming" | "completed" | "missed";

type WorkItem = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  status: WorkStatus;
  lessonHref: string;
  assignment?: { id: string; title: string; href: string; status: "open" | "submitted" } | null;
};

type SchoolDayItem = {
  id: string;
  source: "timetable" | "scheduled_work";
  timeRange: string | null;
  periodLabel: string;
  subject: string | null;
  teacherName: string | null;
  title: string | null;
  status: ScheduleStatus;
  primaryAction: { label: "Start Lesson" | "Continue" | "Open Assignment" | "Review"; href: string };
};

type TodayResponse = {
  items: WorkItem[];
  catchUpItems: WorkItem[];
  subjects: string[];
  completedCount: number;
  remainingCount: number;
  contentGap?: boolean;
  pacingSignal?: string;
  weakTopicSequence?: Array<{ lessonId?: string; reason?: string; priorityOrder?: number }>;
  schoolDay?: {
    mode: "timetable" | "learning_plan" | "setup_needed";
    title: string;
    note: string | null;
    items: SchoolDayItem[];
  };
  todayFocus?: {
    primaryLabel: string;
    primaryHref: string;
    currentOrNext: string;
    status: ScheduleStatus | null;
  };
  progressSnapshot?: {
    lessonsCompleted: number;
    assignmentsDue: number;
    masterySummary: string;
  };
  adaptivePlan?: {
    smartContinueHref: string;
    smartContinueLabel: string;
    smartContinueReason: string;
    orderedActions: Array<{
      type: string;
      label: string;
      reason: string;
      href: string;
      priority: number;
      source: string;
    }>;
    signals: {
      scheduledToday: number;
      incompleteToday: number;
      weaknessCount: number;
      recommendationCount: number;
    };
  };
};

const STATUS_STYLE: Record<ScheduleStatus, string> = {
  current: "border-[var(--ll-accent)] bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]",
  upcoming: "border-[var(--ll-border)] bg-[var(--ll-surface-muted)] text-[var(--ll-text-muted)]",
  completed: "border-[var(--ll-accent)]/30 bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]",
  missed: "border-[var(--ll-warning)]/40 bg-[rgba(250,204,21,0.10)] text-[var(--ll-warning)]",
};

function formatTimeRange(value: string | null) {
  if (!value) return "Time to be announced";
  return value
    .split("-")
    .map((part) => {
      const [hStr, mStr = "00"] = part.split(":");
      const hour = Number(hStr);
      if (!Number.isFinite(hour)) return part;
      const suffix = hour >= 12 ? "PM" : "AM";
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      return `${h12}:${mStr} ${suffix}`;
    })
    .join(" - ");
}

function subjectLabel(subject: string | null | undefined) {
  return subject ? subject.replace(/_/g, " ") : "School period";
}

export default function StudentTodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    const response = await fetch("/api/student/today", { cache: "no-store" });
    const payload = (await response.json()) as TodayResponse;
    if (!response.ok) throw new Error("Failed to load today");
    setData(payload);
    setLastUpdatedAt(new Date().toISOString());
  }, []);

  useEffect(() => {
    loadToday().finally(() => setLoading(false));
  }, [loadToday]);

  const { manualRefresh } = useAssignmentPolling(loadToday);

  async function refreshToday() {
    setRefreshing(true);
    try {
      await manualRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  const schoolDay = data?.schoolDay;
  const focus = data?.todayFocus;
  const currentOrNext = useMemo(
    () => schoolDay?.items.find((item) => item.status === "current") ?? schoolDay?.items.find((item) => item.status === "upcoming") ?? schoolDay?.items[0] ?? null,
    [schoolDay]
  );
  const adaptiveAction = data?.adaptivePlan?.orderedActions?.[0] ?? null;

  return (
    <main className="ll-dashboard-shell">
      <div className="ll-page-enter mx-auto max-w-6xl space-y-5 px-4 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              &larr; Back to Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">Today Focus</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
              {new Date().toLocaleDateString("en-LR", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          {!loading ? (
            <button
              type="button"
              onClick={refreshToday}
              disabled={refreshing}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((index) => <SkeletonCard key={index} />)}
          </div>
        ) : !data ? (
          <GuidedEmptyState
            Icon={BookOpen}
            heading="No school day schedule has been configured yet."
            body="Your teacher or school admin needs to configure the school day before lessons can appear here."
            actions={[{ label: "Browse lessons", href: "/student/lessons", primary: true }]}
          />
        ) : (
          <>
            <section className="rounded-xl border border-[var(--ll-accent)]/35 bg-[var(--ll-accent-soft)] p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-accent)]">Layer 1 - Today Focus</p>
              <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <h2 className="text-2xl font-semibold text-[var(--ll-text)]">
                    {focus?.currentOrNext ?? currentOrNext?.title ?? "No current class"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--ll-text-muted)]">
                    {currentOrNext
                      ? `${formatTimeRange(currentOrNext.timeRange)} - ${subjectLabel(currentOrNext.subject)}`
                      : "No school day schedule has been configured yet."}
                  </p>
                </div>
                <Link
                  href={focus?.primaryHref ?? currentOrNext?.primaryAction.href ?? "/student/lessons"}
                  className="ll-touch-target inline-flex items-center justify-center rounded-lg bg-[var(--ll-accent)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)]"
                >
                  {focus?.primaryLabel ?? currentOrNext?.primaryAction.label ?? "Browse lessons"}
                </Link>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">Layer 2</p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--ll-text)]">Todays School Day</h2>
                </div>
                {lastUpdatedAt ? (
                  <p className="text-xs text-[var(--ll-text-faint)]">
                    Updated {new Date(lastUpdatedAt).toLocaleTimeString("en-LR", { hour: "numeric", minute: "2-digit" })}
                  </p>
                ) : null}
              </div>

              {schoolDay?.note ? (
                <p className="mt-3 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-2 text-sm text-[var(--ll-text-muted)]">
                  {schoolDay.note}
                </p>
              ) : null}

              {schoolDay?.mode === "setup_needed" || !schoolDay?.items.length ? (
                <div className="mt-4 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4">
                  <p className="font-semibold text-[var(--ll-text)]">No school day schedule has been configured yet.</p>
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                    Once your school configures timetable periods or today&apos;s learning plan, it will appear here.
                  </p>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {schoolDay.items.map((item) => (
                    <article
                      key={item.id}
                      className="grid gap-3 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4 md:grid-cols-[150px_1fr_auto]"
                    >
                      <div className="flex items-start gap-2 text-sm font-semibold text-[var(--ll-text)]">
                        <Clock3 className="mt-0.5 h-4 w-4 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
                        <div>
                          <p>{formatTimeRange(item.timeRange)}</p>
                          <p className="mt-1 text-xs font-medium text-[var(--ll-text-faint)]">{item.periodLabel}</p>
                        </div>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--ll-text)]">{subjectLabel(item.subject)}</p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_STYLE[item.status]}`}>
                            {item.status}
                          </span>
                        </div>
                        {item.teacherName ? <p className="mt-1 text-xs text-[var(--ll-text-muted)]">Teacher: {item.teacherName}</p> : null}
                        <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
                          {item.title ?? "No lesson or assignment attached yet"}
                        </p>
                      </div>
                      <Link
                        href={item.primaryAction.href}
                        className="ll-touch-target inline-flex items-center justify-center rounded-lg border border-[var(--ll-border-strong)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)]"
                      >
                        {item.primaryAction.label}
                      </Link>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">Layer 3 - Learning Support</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">Adaptive recommendation</h2>
                {adaptiveAction ? (
                  <Link href={adaptiveAction.href} className="mt-4 block rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4">
                    <p className="font-semibold text-[var(--ll-text)]">{adaptiveAction.label}</p>
                    <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{adaptiveAction.reason}</p>
                  </Link>
                ) : (
                  <p className="mt-3 text-sm text-[var(--ll-text-muted)]">No adaptive recommendation is needed right now.</p>
                )}
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3">
                    <p className="text-xs uppercase text-[var(--ll-text-faint)]">Pacing Signal</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">{data.pacingSignal ?? "on_track"}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3">
                    <p className="text-xs uppercase text-[var(--ll-text-faint)]">Weak Topic Sequence</p>
                    <p className="mt-1 text-sm font-semibold text-[var(--ll-text)]">{data.weakTopicSequence?.length ?? 0} items</p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">Catch Up</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">Older incomplete work</h2>
                {data.catchUpItems.length === 0 ? (
                  <p className="mt-3 text-sm text-[var(--ll-text-muted)]">No catch-up work right now.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {data.catchUpItems.map((item) => (
                      <Link key={item.id} href={item.lessonHref} className="block rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3">
                        <p className="text-sm font-semibold text-[var(--ll-text)]">{item.title}</p>
                        <p className="mt-1 text-xs text-[var(--ll-text-muted)]">{subjectLabel(item.subject)} - {item.status}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">Layer 4 - Progress Snapshot</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="ll-kpi">
                  <CheckCircle2 className="mb-2 h-5 w-5 text-[var(--ll-accent)]" strokeWidth={1.5} />
                  <p className="text-2xl font-semibold text-[var(--ll-text)]">{data.progressSnapshot?.lessonsCompleted ?? data.completedCount}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Lessons completed</p>
                </div>
                <div className="ll-kpi">
                  <ListChecks className="mb-2 h-5 w-5 text-[var(--ll-warning)]" strokeWidth={1.5} />
                  <p className="text-2xl font-semibold text-[var(--ll-text)]">{data.progressSnapshot?.assignmentsDue ?? 0}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Assignments due</p>
                </div>
                <div className="ll-kpi">
                  <TrendingUp className="mb-2 h-5 w-5 text-[var(--ll-accent)]" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-[var(--ll-text)]">{data.progressSnapshot?.masterySummary ?? "No mastery alerts"}</p>
                  <p className="text-xs text-[var(--ll-text-muted)]">Mastery summary</p>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
