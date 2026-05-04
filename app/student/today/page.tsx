"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, Clock3, ListChecks, RefreshCw, TrendingUp } from "lucide-react";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { useAssignmentPolling } from "@/lib/hooks/useAssignmentPolling";

type WorkStatus = "not_started" | "in_progress" | "completed";
type ScheduleStatus = "current" | "upcoming" | "completed" | "missed";
type TabKey = "schedule" | "catch-up" | "support" | "progress";

type WorkItem = {
  id: string;
  title: string;
  subject: string;
  grade: number;
  status: WorkStatus;
  lessonHref: string;
  assignment?: { id: string; title: string; href: string; dueAt?: string | null; status: "open" | "submitted" } | null;
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

type AdaptiveAction = {
  type: string;
  label: string;
  reason: string;
  href: string;
  priority: number;
  source: string;
};

type TodayResponse = {
  items: WorkItem[];
  catchUpItems: WorkItem[];
  subjects: string[];
  completedCount: number;
  remainingCount: number;
  pacingSignal?: string;
  weakTopicSequence?: Array<{ lessonId?: string; reason?: string; priorityOrder?: number }>;
  masteryAlerts?: Array<{ title?: string; message?: string; subject?: string; severity?: string }>;
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
    orderedActions: AdaptiveAction[];
    signals: {
      scheduledToday: number;
      incompleteToday: number;
      weaknessCount: number;
      recommendationCount: number;
    };
  };
};

function fallbackTodayResponse(): TodayResponse {
  return {
    items: [],
    catchUpItems: [],
    subjects: [],
    completedCount: 0,
    remainingCount: 0,
    pacingSignal: "on_track",
    weakTopicSequence: [],
    masteryAlerts: [],
    schoolDay: {
      mode: "setup_needed",
      title: "Today's School Day",
      note: null,
      items: [],
    },
    todayFocus: {
      primaryLabel: "Browse lessons",
      primaryHref: "/student/lessons",
      currentOrNext: "No current class",
      status: null,
    },
    progressSnapshot: {
      lessonsCompleted: 0,
      assignmentsDue: 0,
      masterySummary: "No mastery alerts",
    },
    adaptivePlan: {
      smartContinueHref: "/student/lessons",
      smartContinueLabel: "Browse lessons",
      smartContinueReason: "No scheduled, incomplete, or weak-area recommendation is available right now.",
      orderedActions: [],
      signals: {
        scheduledToday: 0,
        incompleteToday: 0,
        weaknessCount: 0,
        recommendationCount: 0,
      },
    },
  };
}

function safeArray<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

function formatTimeRange(value: string | null) {
  if (!value) return "Today";
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
  return subject ? subject.replace(/_/g, " ") : "General";
}

function statusLabel(status: WorkStatus | ScheduleStatus) {
  return status.replace(/_/g, " ");
}

function dueLabel(item: WorkItem) {
  if (!item.assignment?.dueAt) return "Due today";
  return `Due ${new Date(item.assignment.dueAt).toLocaleDateString("en-LR", { month: "short", day: "numeric" })}`;
}

export default function StudentTodayPage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("schedule");

  const loadToday = useCallback(async () => {
    try {
      const response = await fetch("/api/student/today", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as TodayResponse | null;
      if (!response.ok || !payload || typeof payload !== "object") {
        setData(fallbackTodayResponse());
      } else {
        const fallback = fallbackTodayResponse();
        setData({
          ...fallback,
          ...payload,
          items: safeArray(payload.items),
          catchUpItems: safeArray(payload.catchUpItems),
          subjects: safeArray(payload.subjects),
          weakTopicSequence: safeArray(payload.weakTopicSequence),
          masteryAlerts: safeArray(payload.masteryAlerts),
          schoolDay: {
            ...fallback.schoolDay!,
            ...payload.schoolDay,
            note: payload.schoolDay?.note ?? null,
            items: safeArray(payload.schoolDay?.items),
          },
          todayFocus: {
            ...fallback.todayFocus!,
            ...payload.todayFocus,
          },
          progressSnapshot: {
            ...fallback.progressSnapshot!,
            ...payload.progressSnapshot,
          },
          adaptivePlan: {
            ...fallback.adaptivePlan!,
            ...payload.adaptivePlan,
            orderedActions: safeArray(payload.adaptivePlan?.orderedActions),
            signals: {
              ...fallback.adaptivePlan!.signals,
              ...payload.adaptivePlan?.signals,
            },
          },
        });
      }
      setLastUpdatedAt(new Date().toISOString());
    } catch {
      setData(fallbackTodayResponse());
      setLastUpdatedAt(new Date().toISOString());
    }
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
  const scheduleItems = safeArray(schoolDay?.items);
  const assignedWork = safeArray(data?.items).filter((item) => item.status !== "completed");
  const adaptiveAction = data?.adaptivePlan?.orderedActions?.[0] ?? null;
  const currentOrNext = useMemo(
    () => scheduleItems.find((item) => item.status === "current") ?? scheduleItems.find((item) => item.status === "upcoming") ?? scheduleItems[0] ?? null,
    [scheduleItems]
  );
  const priorityTitle =
    currentOrNext?.title ??
    assignedWork[0]?.title ??
    adaptiveAction?.label ??
    data?.todayFocus?.currentOrNext ??
    "No lessons scheduled yet";
  const priorityReason =
    currentOrNext
      ? `${formatTimeRange(currentOrNext.timeRange)} - ${subjectLabel(currentOrNext.subject)}`
      : assignedWork[0]
        ? `${subjectLabel(assignedWork[0].subject)} - ${dueLabel(assignedWork[0])}`
        : adaptiveAction?.reason ?? "Check assignments or browse the curriculum.";
  const priorityHref =
    currentOrNext?.primaryAction.href ??
    assignedWork[0]?.lessonHref ??
    adaptiveAction?.href ??
    data?.todayFocus?.primaryHref ??
    "/student/lessons";
  const priorityLabel =
    currentOrNext?.primaryAction.label ??
    (assignedWork[0] ? "Open lesson" : adaptiveAction ? "Start lesson" : "Browse curriculum");
  const dateLabel = new Date().toLocaleDateString("en-LR", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="ll-dashboard-shell">
      <div className="ll-page-enter mx-auto max-w-6xl space-y-4 px-4 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              &larr; Back to Dashboard
            </Link>
            <p className="mt-2 text-lg font-semibold text-[var(--ll-text)]">{dateLabel}</p>
          </div>
          {!loading ? (
            <button
              type="button"
              onClick={refreshToday}
              disabled={refreshing}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-60"
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
          <TrueEmptyState />
        ) : (
          <>
            <section className="grid gap-3 rounded-lg border border-[var(--ll-accent)]/35 bg-[var(--ll-accent-soft)] p-4 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <h1 className="text-lg font-semibold text-[var(--ll-text)]">{priorityTitle}</h1>
                <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{priorityReason}</p>
              </div>
              <Link
                href={priorityHref}
                className="ll-touch-target inline-flex items-center justify-center rounded-lg bg-[var(--ll-accent)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
              >
                {priorityLabel}
              </Link>
            </section>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {[
                ["schedule", "Schedule"],
                ["catch-up", "Catch Up"],
                ["support", "Support"],
                ["progress", "Progress"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key as TabKey)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold ${
                    activeTab === key
                      ? "border-[var(--ll-accent)] bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]"
                      : "border-[var(--ll-border)] bg-[var(--ll-surface)] text-[var(--ll-text-muted)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <section className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              {activeTab === "schedule" ? (
                <ScheduleTab schoolDay={schoolDay} assignedWork={assignedWork} adaptiveAction={adaptiveAction} />
              ) : null}
              {activeTab === "catch-up" ? <CatchUpTab items={safeArray(data.catchUpItems)} /> : null}
              {activeTab === "support" ? (
                <SupportTab
                  adaptiveAction={adaptiveAction}
                  weakTopicSequence={safeArray(data.weakTopicSequence)}
                  masteryAlerts={safeArray(data.masteryAlerts)}
                  pacingSignal={data.pacingSignal}
                />
              ) : null}
              {activeTab === "progress" ? (
                <ProgressTab
                  snapshot={data.progressSnapshot}
                  completedCount={data.completedCount}
                  remainingCount={data.remainingCount}
                  lastUpdatedAt={lastUpdatedAt}
                />
              ) : null}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function ScheduleTab({
  schoolDay,
  assignedWork,
  adaptiveAction,
}: {
  schoolDay: TodayResponse["schoolDay"];
  assignedWork: WorkItem[];
  adaptiveAction: AdaptiveAction | null;
}) {
  const scheduleItems = safeArray(schoolDay?.items);

  if (schoolDay?.mode === "timetable" && scheduleItems.length > 0) {
    return (
      <div className="space-y-2">
        {scheduleItems.map((item) => (
          <article key={item.id} className="grid gap-2 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3 sm:grid-cols-[120px_1fr_auto] sm:items-center">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ll-text)]">
              <Clock3 className="h-4 w-4 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
              {formatTimeRange(item.timeRange)}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--ll-text)]">{subjectLabel(item.subject)}</p>
              <p className="text-xs text-[var(--ll-text-muted)]">{item.periodLabel}</p>
            </div>
            <Link href={item.primaryAction.href} className="ll-touch-target inline-flex items-center justify-center rounded-lg border border-[var(--ll-border-strong)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]">
              Open
            </Link>
          </article>
        ))}
      </div>
    );
  }

  if (assignedWork.length > 0) {
    return (
      <div>
        <h2 className="text-base font-semibold text-[var(--ll-text)]">Today&apos;s assigned work</h2>
        <div className="mt-3 space-y-2">
          {assignedWork.map((item) => (
            <article key={item.id} className="grid gap-2 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-sm font-semibold text-[var(--ll-text)]">{item.title}</p>
                <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                  {subjectLabel(item.subject)} - {dueLabel(item)}
                </p>
              </div>
              <Link href={item.lessonHref} className="ll-touch-target inline-flex items-center justify-center rounded-lg bg-[var(--ll-accent)] px-3 py-2 text-sm font-semibold text-[var(--ll-text-faint)]">
                Open lesson
              </Link>
            </article>
          ))}
        </div>
      </div>
    );
  }

  if (adaptiveAction) {
    return (
      <div>
        <h2 className="text-base font-semibold text-[var(--ll-text)]">Recommended for today</h2>
        <Link href={adaptiveAction.href} className="mt-3 block rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3">
          <p className="text-sm font-semibold text-[var(--ll-text)]">{adaptiveAction.label}</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{adaptiveAction.reason}</p>
          <span className="mt-3 inline-flex rounded-lg bg-[var(--ll-accent)] px-3 py-2 text-sm font-semibold text-[var(--ll-text-faint)]">
            Start lesson
          </span>
        </Link>
      </div>
    );
  }

  return <TrueEmptyState compact />;
}

function CatchUpTab({ items }: { items: WorkItem[] }) {
  const incomplete = items.filter((item) => item.status !== "completed");
  if (incomplete.length === 0) {
    return <p className="text-sm text-[var(--ll-text-muted)]">You&apos;re all caught up.</p>;
  }
  return (
    <div className="space-y-2">
      {incomplete.map((item) => (
        <Link key={item.id} href={item.lessonHref} className="block rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3">
          <p className="text-sm font-semibold text-[var(--ll-text)]">{item.title}</p>
          <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
            {subjectLabel(item.subject)} - Older work - {statusLabel(item.status)}
          </p>
        </Link>
      ))}
    </div>
  );
}

function SupportTab({
  adaptiveAction,
  weakTopicSequence,
  masteryAlerts,
  pacingSignal,
}: {
  adaptiveAction: AdaptiveAction | null;
  weakTopicSequence: Array<{ lessonId?: string; reason?: string; priorityOrder?: number }>;
  masteryAlerts: Array<{ title?: string; message?: string; subject?: string; severity?: string }>;
  pacingSignal?: string;
}) {
  const hasSupport = adaptiveAction || weakTopicSequence.length > 0 || masteryAlerts.length > 0;
  if (!hasSupport) return <p className="text-sm text-[var(--ll-text-muted)]">No support needed right now.</p>;
  return (
    <div className="space-y-3">
      {adaptiveAction ? (
        <Link href={adaptiveAction.href} className="block rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3">
          <p className="text-sm font-semibold text-[var(--ll-text)]">{adaptiveAction.label}</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{adaptiveAction.reason}</p>
        </Link>
      ) : null}
      {masteryAlerts.map((alert, index) => (
        <div key={`${alert.title ?? "alert"}-${index}`} className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3">
          <p className="text-sm font-semibold text-[var(--ll-text)]">{alert.title ?? alert.subject ?? "Mastery alert"}</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{alert.message ?? alert.severity ?? "Review this area soon."}</p>
        </div>
      ))}
      {weakTopicSequence.map((item, index) => (
        <div key={`${item.lessonId ?? "weak"}-${index}`} className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3">
          <p className="text-sm font-semibold text-[var(--ll-text)]">Weak concept suggestion</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{item.reason ?? "Practice this concept again."}</p>
        </div>
      ))}
      <p className="text-xs text-[var(--ll-text-faint)]">Pacing: {pacingSignal ?? "on_track"}</p>
    </div>
  );
}

function ProgressTab({
  snapshot,
  completedCount,
  remainingCount,
  lastUpdatedAt,
}: {
  snapshot: TodayResponse["progressSnapshot"];
  completedCount: number;
  remainingCount: number;
  lastUpdatedAt: string | null;
}) {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="ll-kpi">
          <CheckCircle2 className="mb-2 h-5 w-5 text-[var(--ll-accent)]" strokeWidth={1.5} />
          <p className="text-xl font-semibold text-[var(--ll-text)]">{snapshot?.lessonsCompleted ?? completedCount}</p>
          <p className="text-xs text-[var(--ll-text-muted)]">Lessons this week</p>
        </div>
        <div className="ll-kpi">
          <ListChecks className="mb-2 h-5 w-5 text-[var(--ll-warning)]" strokeWidth={1.5} />
          <p className="text-xl font-semibold text-[var(--ll-text)]">{snapshot?.assignmentsDue ?? remainingCount}</p>
          <p className="text-xs text-[var(--ll-text-muted)]">Average grade</p>
        </div>
        <div className="ll-kpi">
          <TrendingUp className="mb-2 h-5 w-5 text-[var(--ll-accent)]" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-[var(--ll-text)]">{snapshot?.masterySummary ?? "No mastery alerts"}</p>
          <p className="text-xs text-[var(--ll-text-muted)]">Streak</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/student/progress" className="text-sm font-semibold text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          View full progress
        </Link>
        {lastUpdatedAt ? (
          <p className="text-xs text-[var(--ll-text-faint)]">
            Updated {new Date(lastUpdatedAt).toLocaleTimeString("en-LR", { hour: "numeric", minute: "2-digit" })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TrueEmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] ${compact ? "p-4" : "p-6"}`}>
      <div className="flex items-start gap-3">
        <BookOpen className="mt-0.5 h-5 w-5 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
        <div>
          <p className="font-semibold text-[var(--ll-text)]">No lessons scheduled yet.</p>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Your school hasn&apos;t set up today&apos;s schedule yet. Check your assignments or browse the curriculum.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/assignments" className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]">
              View assignments
            </Link>
            <Link href="/student/lessons" className="rounded-lg bg-[var(--ll-accent)] px-3 py-2 text-sm font-semibold text-[var(--ll-text-faint)]">
              Browse curriculum
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
