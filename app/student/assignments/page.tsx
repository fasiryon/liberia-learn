"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { GuidedEmptyState } from "@/components/onboarding/GuidedEmptyState";
import { useAssignmentPolling } from "@/lib/hooks/useAssignmentPolling";

type AssignmentRow = {
  id: string;
  title: string;
  description: string;
  className: string;
  subject: string;
  dueAt: string | null;
  createdAt: string;
  points: number;
  isNew: boolean;
  isOverdue: boolean;
  submission: { id: string; score: number | null; turnedInAt: string | null } | null;
};

type AssignmentResponse = {
  assignments: AssignmentRow[];
  count: number;
  newCount: number;
  serverTime?: string;
};

function formatTime(value: string | null) {
  if (!value) return "not checked yet";
  return new Date(value).toLocaleTimeString("en-LR", { hour: "numeric", minute: "2-digit" });
}

export default function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewBanner, setShowNewBanner] = useState(false);
  const lastCountRef = useRef<number | null>(null);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchAssignments = useCallback(async (source: "poll" | "manual" = "poll") => {
    const previousCount = lastCountRef.current;
    const query = new URLSearchParams({ source });
    if (previousCount !== null) query.set("previousCount", String(previousCount));

    const response = await fetch(`/api/student/assignments?${query.toString()}`, { cache: "no-store" });
    const data = (await response.json()) as AssignmentResponse & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "Failed to load assignments");

    if (previousCount !== null && data.count > previousCount) {
      setShowNewBanner(true);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = setTimeout(() => setShowNewBanner(false), 10000);
    }

    lastCountRef.current = data.count;
    setAssignments(data.assignments ?? []);
    setLastUpdatedAt(data.serverTime ?? new Date().toISOString());
    setLoading(false);
  }, []);

  const { manualRefresh } = useAssignmentPolling(() => fetchAssignments("poll"));

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await manualRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  function scrollToNew() {
    setShowNewBanner(false);
    document.querySelector("[data-new-assignment='true']")?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              &larr; Back to Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">Assignments</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Work assigned by your teachers.</p>
          </div>
          <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
            <p className="max-w-full truncate text-xs text-[var(--ll-text-muted)]">
              Last updated at {formatTime(lastUpdatedAt)}
            </p>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface)] px-5 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-60"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {showNewBanner ? (
          <div className="ll-notice ll-notice-warning flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>New assignment available</span>
            <button
              type="button"
              onClick={scrollToNew}
              className="min-h-11 rounded-full border border-[var(--ll-border-strong)] px-4 text-sm font-semibold"
            >
              View
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-28 animate-pulse rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)]" />
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <GuidedEmptyState
            Icon={ClipboardList}
            heading="No assignments yet"
            body="Your teacher will assign work here."
            actions={[]}
          />
        ) : (
          <section className="space-y-3">
            {assignments.map((assignment) => {
              const done = Boolean(assignment.submission?.turnedInAt);
              return (
                <Link
                  key={assignment.id}
                  href={`/student/assignments/${assignment.id}`}
                  data-new-assignment={assignment.isNew ? "true" : undefined}
                  className="ll-card ll-focus block transition-colors hover:border-[var(--ll-border-strong)]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-[var(--ll-text)]">{assignment.title}</h2>
                        {assignment.isNew ? (
                          <span className="rounded-full bg-[var(--ll-yellow-soft)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--ll-yellow)]">
                            New
                          </span>
                        ) : null}
                        {assignment.isOverdue ? (
                          <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-red-300">
                            Overdue
                          </span>
                        ) : null}
                        {done ? (
                          <span className="rounded-full bg-[var(--ll-accent-soft)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--ll-accent)]">
                            Done{assignment.submission?.score != null ? `: ${assignment.submission.score}/${assignment.points}` : ""}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                        {assignment.className} &middot; {assignment.subject.replace(/_/g, " ")}
                      </p>
                      {assignment.description ? (
                        <p className="mt-2 line-clamp-2 text-sm text-[var(--ll-text)]">{assignment.description}</p>
                      ) : null}
                    </div>
                    <p className="shrink-0 text-xs text-[var(--ll-text-muted)]">
                      Due {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString("en-LR") : "not set"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
