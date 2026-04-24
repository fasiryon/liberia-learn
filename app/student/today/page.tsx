"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, FlaskConical, ListChecks } from "lucide-react";
import { SkeletonCard } from "@/components/ui/Skeleton";

type WorkItem = {
  id: string;
  title: string;
  subject: string;
  contentType: string;
  grade: number;
  estimatedDuration: number;
  periodNumber: number | null;
  startTime: string | null;
  endTime: string | null;
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
  order: number;
  lessonHref: string;
  quizHref: string;
  lab: { labId: string; label: string; href: string } | null;
};

type ActiveAction = {
  id: string;
  actionType: string;
  reason: string;
  severity: "low" | "medium" | "high" | "critical";
  href: string;
  sourceSignal: string | null;
};

type TodayResponse = {
  items: WorkItem[];
  subjects: string[];
  completedCount: number;
  remainingCount: number;
  currentItemId: string | null;
  nextItemId: string | null;
  contentGap?: boolean;
  activeAction?: ActiveAction | null;
  adaptivePlan?: {
    generatedAt: string;
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

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  not_started: { label: "Not Started", cls: "bg-[var(--ll-surface-muted)] text-[var(--ll-text-muted)]" },
  in_progress: { label: "In Progress", cls: "bg-[rgba(250,204,21,0.10)] text-[var(--ll-warning)]" },
  completed: { label: "Completed", cls: "bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]" },
};

export default function StudentTodayPage() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [remainingCount, setRemainingCount] = useState(0);
  const [currentItemId, setCurrentItemId] = useState<string | null>(null);
  const [nextItemId, setNextItemId] = useState<string | null>(null);
  const [adaptivePlan, setAdaptivePlan] = useState<TodayResponse["adaptivePlan"] | null>(null);
  const [contentGap, setContentGap] = useState(false);
  const [activeAction, setActiveAction] = useState<ActiveAction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/student/today")
      .then((r) => r.json())
      .then((d: TodayResponse) => {
        setItems(d.items || []);
        setSubjects(d.subjects || []);
        setCompletedCount(d.completedCount || 0);
        setRemainingCount(d.remainingCount || 0);
        setCurrentItemId(d.currentItemId ?? null);
        setNextItemId(d.nextItemId ?? null);
        setAdaptivePlan(d.adaptivePlan ?? null);
        setContentGap(d.contentGap ?? false);
        setActiveAction(d.activeAction ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  const currentItem = items.find((item) => item.id === currentItemId && item.status !== "completed") ?? null;
  const nextItem = items.find((item) => item.id === nextItemId) ?? null;
  const smartAction = adaptivePlan?.orderedActions?.[0] ?? null;

  function timeLabel(item: WorkItem) {
    const period = item.periodNumber ? `Period ${item.periodNumber}` : `Lesson ${item.order}`;
    const time = item.startTime && item.endTime ? `, ${item.startTime}-${item.endTime}` : "";
    return `${period}${time}`;
  }

  const ACTION_SEVERITY_STYLE: Record<string, { border: string; bg: string; badge: string; dot: string }> = {
    critical: {
      border: "border-red-500/50",
      bg: "bg-red-500/10",
      badge: "bg-red-500/20 text-red-300",
      dot: "bg-red-400",
    },
    high: {
      border: "border-orange-500/50",
      bg: "bg-orange-500/10",
      badge: "bg-orange-500/20 text-orange-300",
      dot: "bg-orange-400",
    },
    medium: {
      border: "border-[var(--ll-warning)]/40",
      bg: "bg-[var(--ll-warning)]/8",
      badge: "bg-[var(--ll-warning)]/20 text-[var(--ll-warning)]",
      dot: "bg-[var(--ll-warning)]",
    },
    low: {
      border: "border-[var(--ll-accent)]/35",
      bg: "bg-[var(--ll-accent-soft)]",
      badge: "bg-[var(--ll-accent)]/20 text-[var(--ll-accent)]",
      dot: "bg-[var(--ll-accent)]",
    },
  };

  const ACTION_LABEL: Record<string, string> = {
    ASSIGN_REVIEW_LESSON: "Review Required",
    ASSIGN_PRACTICE: "Practice Required",
    RECOMMEND_TEACHER_SUPPORT: "Teacher Support Needed",
    CONTENT_GAP_NOTICE: "Curriculum Gap",
  };

  function ActiveActionCard({ action }: { action: ActiveAction }) {
    const style = ACTION_SEVERITY_STYLE[action.severity] ?? ACTION_SEVERITY_STYLE.medium;
    const label = ACTION_LABEL[action.actionType] ?? "Required Action";
    return (
      <section
        data-testid="active-action-card"
        className={`rounded-xl border ${style.border} ${style.bg} p-5 sm:p-6`}
      >
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${style.dot}`} />
          <p className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.badge}`}>
            {label}
          </p>
        </div>
        <p className="mt-3 text-sm leading-6 text-[var(--ll-text)]">{action.reason}</p>
        <Link
          href={action.href}
          className="ll-touch-target mt-4 inline-flex items-center justify-center rounded-lg bg-[var(--ll-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)]"
        >
          Act Now
        </Link>
      </section>
    );
  }

  function LessonActions({ item }: { item: WorkItem }) {
    return (
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <Link
          href={item.lessonHref}
          className="ll-touch-target inline-flex items-center justify-center rounded-lg bg-[var(--ll-accent)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)]"
        >
          Continue lesson
        </Link>
        <Link
          href={item.quizHref}
          className="ll-touch-target inline-flex items-center justify-center rounded-lg border border-[var(--ll-border-strong)] px-4 py-3 text-sm font-semibold text-[var(--ll-text)]"
        >
          Take quiz
        </Link>
        {item.lab ? (
          <Link
            href={item.lab.href}
            className="ll-touch-target inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--ll-text)]"
          >
            <FlaskConical className="h-4 w-4" strokeWidth={1.5} />
            Open lab
          </Link>
        ) : (
          <span className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[var(--ll-border)] px-4 py-3 text-sm text-[var(--ll-text-faint)]">
            No lab for this lesson
          </span>
        )}
      </div>
    );
  }

  return (
    <main className="ll-dashboard-shell">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-5 px-4 py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              &larr; Back to Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">Today&apos;s Lessons</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">
              {new Date().toLocaleDateString("en-LR", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          {!loading && items.length > 0 ? (
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-3 text-sm text-[var(--ll-text)]">
              <span className="font-semibold text-[var(--ll-accent)]">{completedCount}</span> completed
              <span className="mx-2 text-[var(--ll-text-faint)]">/</span>
              <span className="font-semibold text-[var(--ll-warning)]">{remainingCount}</span> remaining
            </div>
          ) : null}
        </div>

        {activeAction && !loading && (
          <ActiveActionCard action={activeAction} />
        )}

        {contentGap && !loading && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            <span className="font-semibold">Curriculum gap detected</span> — some content for your grade is still being
            prepared. Your teacher will assign available lessons shortly. Contact your teacher if this persists.
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          smartAction ? (
            <section className="rounded-xl border border-[var(--ll-accent)]/35 bg-[var(--ll-accent-soft)] p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-accent)]">
                Recommended for today
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--ll-text)]">{smartAction.label}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--ll-text-muted)]">{smartAction.reason}</p>
              <Link
                href={adaptivePlan?.smartContinueHref ?? smartAction.href}
                className="ll-touch-target mt-5 inline-flex items-center justify-center rounded-lg bg-[var(--ll-accent)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)]"
              >
                Continue
              </Link>
            </section>
          ) : (
            <div className="ll-section p-6 text-center">
              <BookOpen className="mx-auto mb-3 h-8 w-8 text-[var(--ll-text-faint)]" strokeWidth={1.5} />
              <p className="text-sm leading-6 text-[var(--ll-text-muted)]">
                Nothing scheduled yet. Browse the curriculum to start learning.
              </p>
              <Link
                href="/student/lessons"
                className="ll-command ll-focus mt-4 inline-flex text-sm font-semibold text-[var(--ll-text)]"
              >
                Browse lessons
              </Link>
            </div>
          )
        ) : (
          <div className="space-y-5">
            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
                Today&apos;s subjects
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {subjects.map((subject, index) => (
                  <span
                    key={subject}
                    className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] px-3 py-1 text-xs font-medium text-[var(--ll-text)]"
                  >
                    {index + 1}. {subject.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </section>

            {currentItem ? (
              <section className="rounded-xl border border-[var(--ll-accent)]/35 bg-[var(--ll-accent-soft)] p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-accent)]">
                  Current lesson
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold text-[var(--ll-text)]">{currentItem.title}</h2>
                    <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
                      {timeLabel(currentItem)} · {currentItem.subject.replace(/_/g, " ")} · Grade {currentItem.grade} · {currentItem.estimatedDuration} min
                    </p>
                  </div>
                  <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${STATUS_BADGE[currentItem.status].cls}`}>
                    {STATUS_BADGE[currentItem.status].label}
                  </span>
                </div>
                <LessonActions item={currentItem} />
              </section>
            ) : null}

            {!currentItem && smartAction ? (
              <section className="rounded-xl border border-[var(--ll-accent)]/35 bg-[var(--ll-accent-soft)] p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-accent)]">
                  Smart continue
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--ll-text)]">{smartAction.label}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--ll-text-muted)]">{smartAction.reason}</p>
                <Link
                  href={adaptivePlan?.smartContinueHref ?? smartAction.href}
                  className="ll-touch-target mt-5 inline-flex items-center justify-center rounded-lg bg-[var(--ll-accent)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)]"
                >
                  Continue
                </Link>
              </section>
            ) : null}

            {nextItem ? (
              <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
                <div className="flex items-start gap-3">
                  <ListChecks className="mt-1 h-5 w-5 text-[var(--ll-warning)]" strokeWidth={1.5} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
                      Next lesson
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">{nextItem.title}</h2>
                    <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                      {timeLabel(nextItem)} · {nextItem.subject.replace(/_/g, " ")}
                    </p>
                    <LessonActions item={nextItem} />
                  </div>
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[var(--ll-text)]">Full day plan</h2>
              {items.map((item) => {
                const badge = STATUS_BADGE[item.status];
                return (
                  <Link
                    key={item.id}
                    href={item.lessonHref}
                    className="ll-card ll-focus flex items-center gap-4 transition-colors hover:border-[var(--ll-border-strong)]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ll-accent-soft)] text-sm font-semibold text-[var(--ll-accent)]">
                      {item.status === "completed" ? <CheckCircle2 className="h-5 w-5" strokeWidth={1.5} /> : item.order}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--ll-text)]">{item.title}</p>
                      <p className="text-xs text-[var(--ll-text-muted)]">
                        {timeLabel(item)} · {item.subject.replace(/_/g, " ")} · {item.estimatedDuration} min
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </Link>
                );
              })}
            </section>

            {adaptivePlan?.orderedActions?.length ? (
              <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
                  Recommended next actions
                </p>
                <div className="mt-3 grid gap-2">
                  {adaptivePlan.orderedActions.slice(0, 4).map((action) => (
                    <Link
                      key={`${action.type}-${action.href}`}
                      href={action.href}
                      className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-3 text-sm transition-colors hover:border-[var(--ll-border-strong)]"
                    >
                      <span className="block font-semibold text-[var(--ll-text)]">{action.label}</span>
                      <span className="mt-1 block text-xs text-[var(--ll-text-muted)]">{action.reason}</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
