"use client";

import { FormEvent, useEffect, useState } from "react";
import { AITrustBadge } from "@/components/ai/AITrustBadge";
import { AITrustDetails } from "@/components/ai/AITrustDetails";

type CurriculumVersionRow = {
  id: string;
  versionName: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  createdAt: string;
  _count?: { contents: number };
};

type VersionDriftSummary = {
  activeVersion: { id: string; versionName: string } | null;
  totals: { schools: number; classes: number; alignedClasses: number; needsReviewClasses: number };
  schools: Array<{
    schoolId: string;
    schoolName: string;
    county: string | null;
    classCount: number;
    alignedClasses: number;
    needsReviewClasses: number;
    status: string;
  }>;
};

type CurriculumHealthData = {
  national: {
    totalContent: number;
    alignedContent: number;
    unalignedContent: number;
    alignmentPct: number;
  };
  bySubject: Array<{
    subject: string;
    total: number;
    aligned: number;
    unaligned: number;
    alignmentPct: number;
  }>;
  generatedAt: string;
};

type YearReadinessRow = {
  grade: number;
  subject: string;
  readinessPct: number;
  mappedLessons: number;
  totalLessons: number;
  missingWeeks: number[];
  unitsCovered: number;
  classification: string;
};

const trustEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_TRUST_INDICATORS === "true";

export default function MoeCurriculumPage() {
  const [versions, setVersions] = useState<CurriculumVersionRow[]>([]);
  const [versionName, setVersionName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [health, setHealth] = useState<CurriculumHealthData | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [yearReadiness, setYearReadiness] = useState<YearReadinessRow[]>([]);
  const [driftSummary, setDriftSummary] = useState<VersionDriftSummary | null>(null);

  async function loadVersions() {
    const res = await fetch("/api/moe/curriculum/version", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || data?.error) {
      throw new Error(data?.error ?? "Failed to load curriculum versions");
    }
    setVersions(data.versions ?? []);
    setDriftSummary(data.driftSummary ?? null);
  }

  useEffect(() => {
    loadVersions().catch((err) => setError(err.message));
    fetch("/api/moe/curriculum-health", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) throw new Error(data.error);
        setHealth(data);
      })
      .catch((err: Error) => setHealthError(err.message));
    fetch("/api/admin/curriculum/year-readiness", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) throw new Error(data.error);
        setYearReadiness(data.rows ?? []);
      })
      .catch(() => setYearReadiness([]));
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/moe/curriculum/version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionName }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? "Failed to create version");
      }
      setVersionName("");
      await loadVersions();
    } catch (err: any) {
      setError(err.message ?? "Failed to create version");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish(versionId: string, archive = false) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/moe/curriculum/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId, archive }),
      });
      const data = await res.json();
      if (!res.ok || data?.error) {
        throw new Error(data?.error ?? "Failed to update curriculum version");
      }
      await loadVersions();
    } catch (err: any) {
      setError(err.message ?? "Failed to update curriculum version");
    } finally {
      setSaving(false);
    }
  }

  const aggregateConfidence = health ? health.national.alignmentPct / 100 : 0;
  const aggregateFallback = health ? health.national.alignmentPct < 50 : false;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-[var(--ll-yellow)]">Curriculum Control</p>
        <h1 className="mt-2 text-3xl font-semibold text-[var(--ll-text)]">National Curriculum Versions</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--ll-text-muted)]">
          Create, activate, and archive national curriculum versions. Version state is enforced server-side before publication.
        </p>
      </section>

      {/* Curriculum Health Panel */}
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
          Curriculum Health
        </p>
        <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">MOE Alignment Coverage</h2>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
          National curriculum content aligned to MOE standards, by subject.
        </p>

        {healthError ? (
          <p className="mt-3 text-sm text-[var(--ll-danger)]">{healthError}</p>
        ) : health ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <p className="text-[10px] text-[var(--ll-text-faint)]">National alignment</p>
                <p className="mt-0.5 text-2xl font-semibold text-[var(--ll-text)]">
                  {health.national.alignmentPct}%
                </p>
                <p className="text-xs text-[var(--ll-text-muted)]">
                  {health.national.alignedContent} / {health.national.totalContent} items aligned
                </p>
              </div>
              {trustEnabled && (
                <div className="flex flex-col gap-2">
                  <AITrustBadge
                    confidenceScore={aggregateConfidence}
                    hadFallback={aggregateFallback}
                    view="admin"
                  />
                  {(aggregateConfidence < 0.66 || aggregateFallback) && (
                    <AITrustDetails
                      confidenceScore={aggregateConfidence}
                      hadFallback={aggregateFallback}
                      generatedAt={health.generatedAt}
                    />
                  )}
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-[var(--ll-text)]">
                <thead className="text-left text-xs uppercase tracking-[0.2em] text-[var(--ll-text-faint)]">
                  <tr>
                    <th className="pb-3">Subject</th>
                    <th className="pb-3">Total</th>
                    <th className="pb-3">Aligned</th>
                    <th className="pb-3">Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {health.bySubject.map((row) => (
                    <tr key={row.subject} className="border-t border-white/5">
                      <td className="py-2 font-medium">{row.subject}</td>
                      <td className="py-2">{row.total}</td>
                      <td className="py-2">{row.aligned}</td>
                      <td className="py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            row.alignmentPct >= 80
                              ? "bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]"
                              : row.alignmentPct >= 50
                                ? "bg-[rgba(250,204,21,0.10)] text-[var(--ll-warning)]"
                                : "bg-[rgba(251,113,133,0.10)] text-[var(--ll-danger)]"
                          }`}
                        >
                          {row.alignmentPct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mt-4 h-24 animate-pulse rounded-xl bg-[var(--ll-surface-muted)]" />
        )}
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
              Full-Year Readiness
            </p>
            <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">Mapped Curriculum Structure</h2>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Grade-subject readiness based only on existing approved content mapped into units and weeks.
            </p>
          </div>
          <a
            href="/api/admin/curriculum/year-readiness?format=csv"
            className="rounded-full border border-[var(--ll-border)] px-3 py-2 text-xs font-semibold text-[var(--ll-text)]"
          >
            Export report
          </a>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm text-[var(--ll-text)]">
            <thead className="text-left text-xs uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
              <tr>
                <th className="pb-3">Grade</th>
                <th className="pb-3">Subject</th>
                <th className="pb-3">Ready</th>
                <th className="pb-3">Mapped</th>
                <th className="pb-3">Missing weeks</th>
                <th className="pb-3">Units</th>
              </tr>
            </thead>
            <tbody>
              {yearReadiness.slice(0, 24).map((row) => (
                <tr key={`${row.grade}-${row.subject}`} className="border-t border-white/5">
                  <td className="py-2">Grade {row.grade}</td>
                  <td className="py-2">{row.subject.replace(/_/g, " ")}</td>
                  <td className="py-2">{row.readinessPct}%</td>
                  <td className="py-2">{row.mappedLessons}/{row.totalLessons}</td>
                  <td className="py-2">{row.missingWeeks.length}</td>
                  <td className="py-2">{row.unitsCovered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
              Version Standardization
            </p>
            <h2 className="mt-2 text-base font-semibold text-[var(--ll-text)]">Active Version Drift</h2>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Schools and classes are marked needs review when exact alignment to the active curriculum version cannot be confirmed.
            </p>
          </div>
          <div className="text-right text-sm text-[var(--ll-text)]">
            <p>{driftSummary?.activeVersion?.versionName ?? "No active version"}</p>
            <p className="text-xs text-[var(--ll-text-muted)]">
              {driftSummary?.totals.needsReviewClasses ?? 0} classes need review
            </p>
          </div>
        </div>
        {driftSummary ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-[var(--ll-text)]">
              <thead className="text-left text-xs uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
                <tr>
                  <th className="pb-3">School</th>
                  <th className="pb-3">County</th>
                  <th className="pb-3">Aligned</th>
                  <th className="pb-3">Needs Review</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {driftSummary.schools.slice(0, 20).map((row) => (
                  <tr key={row.schoolId} className="border-t border-white/5">
                    <td className="py-2">{row.schoolName}</td>
                    <td className="py-2">{row.county ?? "Unassigned"}</td>
                    <td className="py-2">{row.alignedClasses}/{row.classCount}</td>
                    <td className="py-2">{row.needsReviewClasses}</td>
                    <td className="py-2">{row.status.replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={versionName}
            onChange={(event) => setVersionName(event.target.value)}
            placeholder="2026 National Curriculum"
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Create Version"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-[var(--ll-danger)]">{error}</p> : null}
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-[var(--ll-text)]">
            <thead className="text-left text-xs uppercase tracking-[0.2em] text-[var(--ll-text-faint)]">
              <tr>
                <th className="pb-3">Version</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Content Rows</th>
                <th className="pb-3">Created</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((version) => (
                <tr key={version.id} className="border-t border-white/5">
                  <td className="py-3">{version.versionName}</td>
                  <td className="py-3">{version.status}</td>
                  <td className="py-3">{version._count?.contents ?? 0}</td>
                  <td className="py-3">{new Date(version.createdAt).toLocaleString()}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {version.status !== "ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => handlePublish(version.id, false)}
                          className="rounded-full border border-emerald-400/30 px-3 py-1 text-xs text-[var(--ll-yellow)]"
                        >
                          Activate
                        </button>
                      ) : null}
                      {version.status !== "ARCHIVED" ? (
                        <button
                          type="button"
                          onClick={() => handlePublish(version.id, true)}
                          className="rounded-full border border-amber-400/30 px-3 py-1 text-xs text-[var(--ll-yellow)]"
                        >
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
