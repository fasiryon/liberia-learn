"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { UnitSequence } from "@/lib/student/unitSequence";

/**
 * Lesson-page strip that makes the unit's lesson sequence visible:
 * "Lesson 4 of 12", a completed/current/upcoming dot-strip, and a link to the
 * full unit overview. Renders nothing when the lesson is not part of a unit
 * (graceful degradation for the ~21% of lessons without a unitId).
 */
export function UnitSequenceSidebar({
  contentId,
  scheduledWorkId,
}: {
  contentId: string;
  scheduledWorkId?: string;
}) {
  const [sequence, setSequence] = useState<UnitSequence | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const qs = scheduledWorkId ? `?sw=${encodeURIComponent(scheduledWorkId)}` : "";
    fetch(`/api/student/units/by-content/${encodeURIComponent(contentId)}${qs}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active) setSequence(data);
      })
      .catch(() => {
        if (active) setSequence(null);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [contentId, scheduledWorkId]);

  if (!loaded || !sequence || sequence.lessons.length === 0) return null;

  const currentIndex = sequence.lessons.findIndex((l) => l.status === "current");
  const position = currentIndex >= 0 ? currentIndex + 1 : sequence.completedCount + 1;

  return (
    <section
      data-tour="unit-map"
      className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
            Lesson Sequence
          </p>
          <h2 className="mt-0.5 text-sm font-semibold text-[var(--ll-text)]">
            {sequence.unitName}
          </h2>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-[var(--ll-yellow)]">
            Lesson {position} of {sequence.totalCount}
          </p>
          <p className="text-[11px] text-[var(--ll-text-faint)]">
            {sequence.completionPct}% of unit complete
          </p>
        </div>
      </div>

      {/* Dot strip */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sequence.lessons.map((lesson, index) => {
          const base =
            "flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold transition";
          const styles =
            lesson.status === "completed"
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : lesson.status === "current"
                ? "border-[var(--ll-yellow)] bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]"
                : "border-[var(--ll-border)] bg-[var(--ll-surface)] text-[var(--ll-text-muted)]";
          const label = lesson.status === "completed" ? "✓" : String(index + 1);

          if (lesson.locked) {
            return (
              <span
                key={lesson.contentId}
                title="Complete earlier lessons first"
                className={`${base} cursor-not-allowed border-[var(--ll-border)] bg-[var(--ll-surface)] text-[var(--ll-text-faint)] opacity-60`}
              >
                🔒
              </span>
            );
          }
          return (
            <Link
              key={lesson.contentId}
              href={lesson.href}
              title={lesson.title}
              aria-current={lesson.status === "current" ? "step" : undefined}
              className={`${base} ${styles} hover:border-[var(--ll-yellow)]`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="mt-3">
        <Link
          href={`/student/units/${encodeURIComponent(sequence.unitId)}`}
          className="text-xs font-medium text-[var(--ll-text-muted)] underline-offset-2 hover:text-[var(--ll-yellow)] hover:underline"
        >
          View full unit →
        </Link>
      </div>
    </section>
  );
}
