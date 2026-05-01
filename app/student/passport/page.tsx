"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SubjectEntry = {
  subject: string;
  strandCount: number;
  masteredStrandCount: number;
  avgCurrentScore: number | null;
  avgGrowthDelta: number | null;
  dominantMasteryState: string | null;
  openInterventionChainCount: number;
  lastAssessedAt: string | null;
};

type Passport = {
  studentId: string;
  generatedAt: string;
  totalStrands: number;
  masteredStrands: number;
  overallMasteryPct: number | null;
  avgCurrentScore: number | null;
  subjects: SubjectEntry[];
  interventionSummary: { total: number; open: number; inProgress: number; closed: number };
  latestActivityAt: string | null;
  badges: Array<{
    id: string;
    label: string;
    category: string;
    earned: boolean;
    earnedAt: string | null;
    evidence: string[];
    criteria: string;
  }>;
  examReadiness: {
    readinessScore: number | null;
    strongSubjects: string[];
    weakSubjects: string[];
    recommendedPractice: string[];
    nextBestAction: { label: string; href: string; reason: string } | null;
  } | null;
  pathwayHooks: Array<{
    id: string;
    pathwayKey: string;
    label: string;
    readinessLevel: string;
    supportingBadges: string[];
    supportingSubjects: string[];
    gaps: string[];
    recommendedNextActions: string[];
    readinessTags: string[];
    skillSignals: string[];
  }>;
};

function StatBadge({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-5 py-4 text-center">
      <span className="text-2xl font-bold text-[var(--ll-yellow)]">{value ?? "--"}</span>
      <span className="mt-1 text-xs text-[var(--ll-text-muted)]">{label}</span>
    </div>
  );
}

function MasteryBar({ pct }: { pct: number | null }) {
  const width = pct ?? 0;
  return (
    <div className="h-2 w-full rounded-full bg-[var(--ll-surface-muted)]">
      <div
        className="h-2 rounded-full bg-[var(--ll-yellow)] transition-all"
        style={{ width: `${Math.min(100, Math.max(0, width))}%` }}
      />
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function StudentPassportPage() {
  const [passport, setPassport] = useState<Passport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/passport")
      .then((res) => {
        if (res.status === 401 || res.status === 403) throw new Error("auth");
        if (!res.ok) throw new Error("fetch");
        return res.json();
      })
      .then(setPassport)
      .catch((e) => setError(e.message === "auth" ? "Please log in to view your passport." : "Could not load your learning passport."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)]">
        <div className="w-full max-w-3xl space-y-4 px-4 py-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-[var(--ll-surface)]" />
          ))}
        </div>
      </main>
    );
  }

  if (error || !passport) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-400">{error ?? "No passport data found."}</p>
          <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <Link href="/dashboard" className="inline-block text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            &larr; Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-[var(--ll-text)]">My Learning Passport</h1>
          <p className="text-xs text-[var(--ll-text-faint)]">
            Generated {formatDate(passport.generatedAt)} · Last activity{" "}
            {formatDate(passport.latestActivityAt)}
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBadge label="Strands tracked" value={passport.totalStrands} />
          <StatBadge label="Strands mastered" value={passport.masteredStrands} />
          <StatBadge
            label="Overall mastery"
            value={passport.overallMasteryPct != null ? `${passport.overallMasteryPct}%` : null}
          />
          <StatBadge
            label="Avg score"
            value={passport.avgCurrentScore != null ? passport.avgCurrentScore.toFixed(1) : null}
          />
        </div>

        {/* Interventions */}
        {passport.interventionSummary.total > 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text)]">
              Support History
            </h2>
            <div className="flex flex-wrap gap-4 text-sm text-[var(--ll-text)]">
              <span>{passport.interventionSummary.total} total</span>
              <span className="text-[var(--ll-yellow)]">{passport.interventionSummary.open} open</span>
              <span className="text-sky-400">{passport.interventionSummary.inProgress} in progress</span>
              <span className="text-[var(--ll-yellow)]">{passport.interventionSummary.closed} resolved</span>
            </div>
          </div>
        )}

        {passport.examReadiness || passport.badges?.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
            {passport.examReadiness ? (
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text)]">
                  Exam Readiness
                </h2>
                <p className="mt-3 text-3xl font-bold text-[var(--ll-yellow)]">
                  {passport.examReadiness.readinessScore != null
                    ? `${Math.round(passport.examReadiness.readinessScore)}%`
                    : "--"}
                </p>
                <p className="mt-2 text-xs text-[var(--ll-text-muted)]">
                  {passport.examReadiness.nextBestAction?.reason ?? "Readiness builds from mastery, lessons, quizzes, and exams."}
                </p>
                {passport.examReadiness.nextBestAction ? (
                  <Link
                    href={passport.examReadiness.nextBestAction.href}
                    className="mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--ll-yellow)] px-4 text-sm font-semibold text-[var(--ll-text-faint)]"
                  >
                    {passport.examReadiness.nextBestAction.label}
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text)]">
                Skill Badges
              </h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {(passport.badges ?? []).filter((badge) => badge.earned).length === 0 ? (
                  <p className="text-sm text-[var(--ll-text-muted)]">
                    Badges appear here when your work meets the published criteria.
                  </p>
                ) : (
                  passport.badges
                    .filter((badge) => badge.earned)
                    .map((badge) => (
                      <span
                        key={badge.id}
                        title={badge.criteria}
                        className="rounded-full border border-[var(--ll-yellow)]/30 bg-[var(--ll-yellow)]/10 px-3 py-1 text-xs font-semibold text-[var(--ll-yellow)]"
                      >
                        {badge.label}
                        {badge.earnedAt ? ` - ${formatDate(badge.earnedAt)}` : ""}
                      </span>
                    ))
                )}
              </div>
            </div>
          </div>
        ) : null}

        {passport.pathwayHooks?.length > 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text)]">
              Future Pathway Signals
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {passport.pathwayHooks.map((hook) => (
                <div key={hook.id} className="rounded-lg border border-[var(--ll-border)] bg-white/5 p-3">
                  <p className="text-sm font-semibold text-[var(--ll-text)]">{hook.label}</p>
                  <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                    {hook.readinessLevel.replace(/_/g, " ")} - {hook.skillSignals.join(", ")}
                  </p>
                  {hook.recommendedNextActions.length > 0 ? (
                    <p className="mt-2 text-xs text-[var(--ll-text-faint)]">
                      {hook.recommendedNextActions[0]}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Subject breakdown */}
        {passport.subjects.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]">
              By Subject
            </h2>
            {passport.subjects.map((s) => {
              const pct =
                s.strandCount > 0
                  ? Math.round((s.masteredStrandCount / s.strandCount) * 100)
                  : 0;
              return (
                <div
                  key={s.subject}
                  className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="font-semibold text-[var(--ll-text)]">{s.subject}</span>
                      {s.dominantMasteryState && (
                        <span className="ml-2 rounded-full bg-[var(--ll-yellow)]/20 border border-emerald-400/30 px-2 py-0.5 text-xs text-[var(--ll-yellow)]">
                          {s.dominantMasteryState}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--ll-text-muted)]">
                      {s.masteredStrandCount}/{s.strandCount} strands mastered
                    </span>
                  </div>
                  <MasteryBar pct={pct} />
                  <div className="flex flex-wrap gap-4 text-xs text-[var(--ll-text-muted)]">
                    {s.avgCurrentScore != null && (
                      <span>Avg score: {s.avgCurrentScore.toFixed(1)}</span>
                    )}
                    {s.avgGrowthDelta != null && (
                      <span>
                        Growth:{" "}
                        <span className={s.avgGrowthDelta >= 0 ? "text-[var(--ll-yellow)]" : "text-red-400"}>
                          {s.avgGrowthDelta >= 0 ? "+" : ""}{s.avgGrowthDelta.toFixed(2)}
                        </span>
                      </span>
                    )}
                    {s.openInterventionChainCount > 0 && (
                      <span className="text-[var(--ll-yellow)]">{s.openInterventionChainCount} open interventions</span>
                    )}
                    {s.lastAssessedAt && (
                      <span>Last assessed: {formatDate(s.lastAssessedAt)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-8 text-center text-sm text-[var(--ll-text-muted)]">
            No subject data yet. Complete some lessons to build your passport.
          </div>
        )}

        <p className="text-center text-[11px] text-[var(--ll-text-faint)] pb-4">
          Your learning passport is a private longitudinal record of your progress.
        </p>
      </div>
    </main>
  );
}
