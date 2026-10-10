"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UnitSequence } from "@/lib/student/unitSequence";

const STATUS_TEXT = { completed: "completed", current: "current lesson", upcoming: "upcoming" } as const;

/**
 * Lesson-page strip that makes the unit's lesson sequence visible:
 * "Lesson 4 of 12", a completed/current/upcoming step list, and a link to the
 * full unit overview. Renders nothing when the lesson is not part of a unit
 * (graceful degradation for the ~21% of lessons without a unitId); a failed
 * load says the sequence is unavailable instead of hiding silently.
 */
export function UnitSequenceSidebar({
  contentId,
  scheduledWorkId,
}: {
  contentId: string;
  scheduledWorkId?: string;
}) {
  const [sequence, setSequence] = useState<UnitSequence | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const qs = scheduledWorkId ? `?sw=${encodeURIComponent(scheduledWorkId)}` : "";
    fetch(`/api/student/units/by-content/${encodeURIComponent(contentId)}${qs}`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!active) return;
        if (res.status === 404) return setSequence(null);
        if (!res.ok) throw new Error("unavailable");
        const data = await res.json();
        if (active) setSequence(Array.isArray(data?.lessons) ? data : null);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [contentId, scheduledWorkId]);

  if (failed) {
    return (
      <p role="status" className="rounded-xl border border-[var(--ll-border)] p-3 text-sm text-[var(--ll-text-muted)]">
        The unit lesson order is unavailable right now. Your lesson still works.
      </p>
    );
  }
  if (!sequence || sequence.lessons.length === 0) return null;

  const currentIndex = sequence.lessons.findIndex((l) => l.status === "current");
  const position = currentIndex >= 0 ? currentIndex + 1 : sequence.completedCount + 1;

  return (
    <nav
      data-tour="unit-map"
      aria-label={`Unit: ${sequence.unitName}`}
      className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.1em] text-[var(--ll-text-muted)]">
            Lesson sequence
          </p>
          <h2 className="mt-0.5 break-words text-sm font-semibold text-[var(--ll-text)]">
            {sequence.unitName}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[var(--ll-yellow)]">
            Lesson {Math.min(position, sequence.totalCount)} of {sequence.totalCount}
          </p>
          <p className="text-xs text-[var(--ll-text-muted)]">
            {sequence.completedCount} of {sequence.totalCount} lessons completed
          </p>
        </div>
      </div>

      <ol className="mt-3 flex flex-wrap gap-2">
        {sequence.lessons.map((lesson, index) => {
          const base =
            "flex h-11 min-w-11 items-center justify-center rounded-lg border-2 px-2 text-sm font-semibold transition";
          const styles =
            lesson.status === "completed"
              ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
              : lesson.status === "current"
                ? "border-[var(--ll-yellow)] bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]"
                : "border-[var(--ll-border)] bg-[var(--ll-surface)] text-[var(--ll-text-muted)]";
          const label = lesson.status === "completed" ? "✓" : String(index + 1);
          const name = `Lesson ${index + 1}: ${lesson.title}, ${lesson.locked ? "locked, finish earlier lessons first" : STATUS_TEXT[lesson.status]}`;

          return (
            <li key={lesson.contentId}>
              {lesson.locked ? (
                <span
                  role="img"
                  aria-label={name}
                  title="Finish earlier lessons first"
                  className={`${base} cursor-not-allowed border-dashed border-[var(--ll-border)] bg-transparent text-[var(--ll-text-muted)]`}
                >
                  <span aria-hidden="true">🔒</span>
                </span>
              ) : (
                <Link
                  href={lesson.href}
                  title={lesson.title}
                  aria-label={name}
                  aria-current={lesson.status === "current" ? "step" : undefined}
                  className={`${base} ${styles} hover:border-[var(--ll-yellow)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ll-yellow)]`}
                >
                  {label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-3">
        <Link
          href={`/student/units/${encodeURIComponent(sequence.unitId)}`}
          className="inline-flex min-h-11 items-center text-sm font-medium text-[var(--ll-text)] underline underline-offset-2 hover:text-[var(--ll-yellow)]"
        >
          View full unit →
        </Link>
      </div>
    </nav>
  );
}
