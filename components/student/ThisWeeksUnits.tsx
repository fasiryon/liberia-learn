"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ActiveUnitSummary } from "@/lib/student/unitSequence.server";

/**
 * "This week's units" — a compact progress rollup of the units the student is
 * actively moving through, shown on the Today page so the lesson-sequencing the
 * platform has is visible at a glance. Renders nothing when there are no active
 * units (graceful — never an empty card).
 */
export function ThisWeeksUnits() {
  const [units, setUnits] = useState<ActiveUnitSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/student/units/active", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (active && Array.isArray(data)) setUnits(data);
      })
      .catch(() => {
        if (active) setUnits([]);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded || units.length === 0) return null;

  return (
    <section data-tour="this-weeks-units" className="ll-section p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[var(--ll-text)]">This week&apos;s units</h2>
        <span className="text-[11px] text-[var(--ll-text-faint)]">Lessons that build on each other</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {units.map((unit) => (
          <Link
            key={unit.unitId}
            href={`/student/units/${encodeURIComponent(unit.unitId)}`}
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 transition hover:border-[var(--ll-yellow)]"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-[var(--ll-text)]">{unit.unitName}</p>
              <span className="shrink-0 text-xs font-semibold text-[var(--ll-yellow)]">
                {unit.completedCount}/{unit.totalCount}
              </span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-[var(--ll-bg)]">
              <div
                className="h-1.5 rounded-full bg-emerald-500/70"
                style={{ width: `${unit.completionPct}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-[var(--ll-text-faint)]">
              {unit.subject.replace(/_/g, " ")} · {unit.completionPct}% complete
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
