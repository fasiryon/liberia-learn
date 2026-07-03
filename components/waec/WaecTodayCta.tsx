"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GraduationCap, ArrowRight } from "lucide-react";

/** Grade 9+ only: a prominent WAEC Prep call-to-action for the Today page. */
export function WaecTodayCta() {
  const [eligible, setEligible] = useState(false);
  useEffect(() => {
    fetch("/api/student/waec/eligibility", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEligible(!!d?.eligible))
      .catch(() => null);
  }, []);
  if (!eligible) return null;
  return (
    <Link
      href="/student/waec"
      className="flex items-center gap-3 rounded-xl border border-[var(--ll-yellow)]/40 bg-gradient-to-r from-[var(--ll-yellow)]/10 to-transparent px-4 py-3 transition hover:border-[var(--ll-yellow)]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ll-yellow)]/15 text-[var(--ll-yellow)]">
        <GraduationCap className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-[var(--ll-text)]">WAEC Prep</p>
        <p className="text-xs text-[var(--ll-text-muted)]">Check your WASSCE readiness and start exam-style practice</p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-[var(--ll-yellow)]" />
    </Link>
  );
}
