"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ComponentScore = { name: string; score: number; max: number; detail: string };
type ScoreResult = { total: number; components: ComponentScore[]; grade: string };

const GRADE_COLOR: Record<string, string> = {
  A: "bg-emerald-500", B: "bg-emerald-500/70", C: "bg-amber-500",
  D: "bg-orange-500", F: "bg-red-500",
};

const IMPROVE_LINKS: Record<string, { href: string; label: string }> = {
  "Attendance Coverage": { href: "/admin", label: "Take Attendance" },
  "Curriculum Adoption": { href: "/admin/curriculum", label: "Generate Lessons" },
  "Student Engagement": { href: "/teacher/students", label: "View Students" },
  "Guardian Connection": { href: "/admin/guardian-link", label: "Link Guardians" },
  "Platform Setup": { href: "/admin/onboarding", label: "Complete Setup" },
};

export default function PilotScorePage() {
  const [result, setResult] = useState<ScoreResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/pilot-score")
      .then((r) => r.json())
      .then((d) => setResult(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-40 rounded-2xl bg-slate-800/50 animate-pulse" />;
  if (!result) return <p className="text-red-400">Failed to load score</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pilot Readiness Score</h1>
        <p className="text-sm text-slate-400 mt-1">Your school&apos;s readiness for the MOE pilot</p>
      </div>

      {/* Overall score */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 text-center">
        <div className="inline-flex items-center gap-4">
          <div className="text-5xl font-bold text-slate-100">{result.total}</div>
          <div>
            <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold text-white ${GRADE_COLOR[result.grade] || "bg-slate-500"}`}>
              Grade {result.grade}
            </span>
            <p className="text-xs text-slate-400 mt-1">out of 100</p>
          </div>
        </div>
        <div className="mt-4 h-3 rounded-full bg-slate-800 max-w-md mx-auto">
          <div
            className={`h-3 rounded-full ${result.total >= 60 ? "bg-emerald-500" : result.total >= 40 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${result.total}%` }}
          />
        </div>
      </div>

      {/* Component breakdown */}
      <div className="space-y-3">
        {result.components.map((c) => {
          const pct = c.max > 0 ? Math.round((c.score / c.max) * 100) : 0;
          const link = IMPROVE_LINKS[c.name];
          return (
            <div key={c.name} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-200">{c.name}</h3>
                <span className="text-sm font-bold text-slate-300">{c.score}/{c.max}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 mb-2">
                <div
                  className={`h-2 rounded-full ${pct >= 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">{c.detail}</p>
              {c.score < c.max && link && (
                <Link href={link.href} className="text-xs text-emerald-400 hover:underline mt-1 inline-block">
                  Improve this score &rarr; {link.label}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
