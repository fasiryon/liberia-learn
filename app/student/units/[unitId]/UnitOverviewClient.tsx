"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { SkeletonCard } from "@/components/ui/Skeleton";
import type { UnitSequence } from "@/lib/student/unitSequence";

function statusBadge(status: string) {
  if (status === "completed")
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (status === "current")
    return "border-[var(--ll-yellow)] bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)]";
  return "border-[var(--ll-border)] bg-[var(--ll-surface)] text-[var(--ll-text-muted)]";
}

function statusLabel(status: string) {
  if (status === "completed") return "Completed";
  if (status === "current") return "Up next";
  return "Upcoming";
}

export default function UnitOverviewClient({ unitId }: { unitId: string }) {
  const router = useRouter();
  const [sequence, setSequence] = useState<UnitSequence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/student/units/${encodeURIComponent(unitId)}`, { cache: "no-store" })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return null;
        }
        if (res.status === 404) throw new Error("This unit isn't available.");
        if (!res.ok) throw new Error("Could not load this unit.");
        return res.json();
      })
      .then((data) => {
        if (active && data) setSequence(data);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [unitId, router]);

  return (
    <main className="ll-dashboard-shell px-4 py-6 text-[var(--ll-text)]">
      <div className="ll-page-enter mx-auto max-w-3xl space-y-5">
        <Link
          href="/student/today"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to today
        </Link>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div className="ll-notice ll-notice-error">{error}</div>
        ) : sequence ? (
          <>
            <header className="ll-section p-5">
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
                {sequence.subject.replace(/_/g, " ")} · Grade {sequence.grade} · Unit
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-[var(--ll-text)]">
                {sequence.unitName}
              </h1>
              <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
                {sequence.totalCount} lessons in sequence · {sequence.completedCount} completed
              </p>
              <div className="mt-3 h-2 rounded-full bg-[var(--ll-surface)]">
                <div
                  className="h-2 rounded-full bg-emerald-500/70"
                  style={{ width: `${sequence.completionPct}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                {sequence.completionPct}% of this unit complete
              </p>
            </header>

            {/* Ordered stepper — this is the "1-2-3-4" stack the lessons follow */}
            <ol className="relative space-y-2 border-l border-[var(--ll-border)] pl-5">
              {sequence.lessons.map((lesson, index) => {
                const inner = (
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--ll-text)]">
                        {lesson.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--ll-text-faint)]">
                        Lesson {index + 1}
                        {lesson.lessonType ? ` · ${lesson.lessonType}` : ""}
                        {lesson.locked ? " · complete earlier lessons first" : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium ${statusBadge(lesson.status)}`}
                    >
                      {lesson.locked ? "Locked" : statusLabel(lesson.status)}
                    </span>
                  </div>
                );
                return (
                  <li key={lesson.contentId} className="relative">
                    <span
                      className={`absolute -left-[27px] top-5 h-3 w-3 rounded-full border-2 ${
                        lesson.status === "completed"
                          ? "border-emerald-400 bg-emerald-400"
                          : lesson.status === "current"
                            ? "border-[var(--ll-yellow)] bg-[var(--ll-yellow)]"
                            : "border-[var(--ll-border)] bg-[var(--ll-bg)]"
                      }`}
                    />
                    {lesson.locked ? (
                      <div className="opacity-60">{inner}</div>
                    ) : (
                      <Link href={lesson.href} className="block hover:opacity-90">
                        {inner}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}
      </div>
    </main>
  );
}
