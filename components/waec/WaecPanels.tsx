"use client";

import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";

type SubjectAggregate = {
  subjectId: string; name: string; assessedStudents: number;
  avgReadiness: number | null; atRisk: number; onTrack: number;
};
type CountyAggregate = { county: string; assessedStudents: number; avgReadiness: number | null };

function readinessColor(v: number | null): string {
  if (v == null) return "var(--ll-text-faint)";
  if (v >= 75) return "#22c55e";
  if (v >= 50) return "var(--ll-yellow)";
  return "#f87171";
}

function SubjectRow({ s }: { s: SubjectAggregate }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm text-[var(--ll-text)]">{s.name.replace(/^WAEC /, "")}</span>
          <span className="shrink-0 text-sm font-semibold" style={{ color: readinessColor(s.avgReadiness) }}>
            {s.avgReadiness == null ? "—" : `${s.avgReadiness}%`}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ll-surface-muted)]">
          <div className="h-full rounded-full" style={{ width: `${s.avgReadiness ?? 0}%`, background: readinessColor(s.avgReadiness) }} />
        </div>
      </div>
      <div className="shrink-0 text-right text-[11px] text-[var(--ll-text-faint)]">
        {s.assessedStudents > 0 ? (
          <><span className="text-red-400">{s.atRisk} at risk</span> · <span className="text-emerald-400">{s.onTrack} on track</span></>
        ) : "no data"}
      </div>
    </div>
  );
}

function PanelShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--ll-yellow)]/25 bg-[var(--ll-surface)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-[var(--ll-yellow)]" strokeWidth={1.75} />
        <div>
          <h3 className="text-sm font-bold text-[var(--ll-text)]">WAEC Readiness</h3>
          <p className="text-[11px] text-[var(--ll-text-faint)]">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

/** Teacher dashboard panel — hidden unless the teacher has Grade 9+ students. */
export function WaecTeacherPanel() {
  const [data, setData] = useState<{ studentCount: number; subjects: SubjectAggregate[] } | null>(null);
  useEffect(() => {
    fetch("/api/teacher/waec-readiness", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => null);
  }, []);
  if (!data || data.studentCount === 0) return null;
  return (
    <PanelShell subtitle={`Class aggregate · ${data.studentCount} Grade 9+ students`}>
      <div className="divide-y divide-[var(--ll-border)]">
        {data.subjects.map((s) => <SubjectRow key={s.subjectId} s={s} />)}
      </div>
    </PanelShell>
  );
}

/** MOE dashboard panel — national WAEC readiness + county ranking. */
export function WaecMoePanel() {
  const [data, setData] = useState<{ studentCount: number; subjects: SubjectAggregate[]; byCounty: CountyAggregate[] } | null>(null);
  useEffect(() => {
    fetch("/api/moe/waec-readiness", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then(setData).catch(() => null);
  }, []);
  if (!data) return null;
  return (
    <PanelShell subtitle={`National · ${data.studentCount} Grade 9+ students`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="divide-y divide-[var(--ll-border)]">
          {data.subjects.map((s) => <SubjectRow key={s.subjectId} s={s} />)}
        </div>
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--ll-text-faint)]">Ranked by county</p>
          <div className="flex flex-col gap-1.5">
            {data.byCounty.slice(0, 8).map((c, i) => (
              <div key={c.county} className="flex items-center justify-between text-sm">
                <span className="text-[var(--ll-text-muted)]">{i + 1}. {c.county}</span>
                <span className="font-semibold" style={{ color: readinessColor(c.avgReadiness) }}>
                  {c.avgReadiness == null ? "—" : `${c.avgReadiness}%`}
                </span>
              </div>
            ))}
            {data.byCounty.length === 0 && <p className="text-xs text-[var(--ll-text-faint)]">No readiness data yet.</p>}
          </div>
        </div>
      </div>
    </PanelShell>
  );
}
