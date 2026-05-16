"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type ClassOption = { id: string; name: string; subject: string; gradeLevel: number | null };
type Term = { id: string; name: string; startDate: string; endDate: string };
type AcademicYear = { id: string; yearLabel: string; terms: Term[] };
type StudentRow = {
  id: string;
  name: string;
  reportCard: {
    id: string;
    status: string;
    generatedAt: string;
    publishedAt: string | null;
    teacherComment: string | null;
  } | null;
};
type PageData = {
  classes: ClassOption[];
  academicYears: AcademicYear[];
  students?: StudentRow[];
};

function statusBadge(status: string) {
  if (status === "PUBLISHED") {
    return (
      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
        Published
      </span>
    );
  }
  return (
    <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-semibold text-amber-300">
      Draft
    </span>
  );
}

export default function AdminReportCardsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchData = useCallback(
    async (cid = classId, tid = termId) => {
      setLoading(true);
      const url = `/api/admin/report-cards${cid && tid ? `?classId=${cid}&termId=${tid}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      setData(json);
      setLoading(false);
    },
    [classId, termId]
  );

  useEffect(() => {
    fetchData("", "");
  }, [fetchData]);

  function handleClassChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setClassId(e.target.value);
    setTermId("");
    setData((d) => (d ? { classes: d.classes, academicYears: d.academicYears } : null));
  }

  async function handleGenerate() {
    if (!classId || !termId) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/report-cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, termId }),
      });
      const json = await res.json();
      setMsg(`Generated ${json.generated}, skipped ${json.skipped} (already published).`);
      await fetchData(classId, termId);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublishAll() {
    if (!classId || !termId) return;
    if (!confirm("Publish all DRAFT report cards for this class/term? Students will be able to see them.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/report-cards/publish-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, termId }),
      });
      const json = await res.json();
      setMsg(`Published ${json.published} report cards.`);
      await fetchData(classId, termId);
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/report-cards/${id}/publish`, { method: "PATCH" });
      await fetchData(classId, termId);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate(studentId: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/report-cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, termId, studentIds: [studentId] }),
      });
      const json = await res.json();
      setMsg(`Regenerated ${json.generated} report card.`);
      await fetchData(classId, termId);
    } finally {
      setBusy(false);
    }
  }

  const classes = data?.classes ?? [];
  const academicYears = data?.academicYears ?? [];
  const students = data?.students ?? [];
  const terms = academicYears.flatMap((y) => y.terms.map((t) => ({ ...t, yearLabel: y.yearLabel })));

  return (
    <main className="ll-dashboard-shell px-4 py-5 text-[var(--ll-text)]">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-6">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Report Cards</h1>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Generate and publish term report cards for students.
            </p>
          </div>
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap gap-4">
          <label className="flex-1 min-w-40 space-y-1.5 text-sm">
            <span className="text-[var(--ll-text-muted)]">Class</span>
            <select
              value={classId}
              onChange={handleClassChange}
              className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-[var(--ll-text)]"
            >
              <option value="">Select a class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.subject}
                </option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-40 space-y-1.5 text-sm">
            <span className="text-[var(--ll-text-muted)]">Term</span>
            <select
              value={termId}
              onChange={(e) => {
                setTermId(e.target.value);
                if (classId && e.target.value) fetchData(classId, e.target.value);
              }}
              disabled={!classId}
              className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-[var(--ll-text)] disabled:opacity-50"
            >
              <option value="">Select a term…</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.yearLabel})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Actions */}
        {classId && termId ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={busy}
              className="min-h-11 rounded-full bg-[var(--ll-yellow)] px-5 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
            >
              {busy ? "Working…" : "Generate Report Cards"}
            </button>
            <button
              type="button"
              onClick={handlePublishAll}
              disabled={busy}
              className="min-h-11 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 text-sm font-semibold text-emerald-300 disabled:opacity-60"
            >
              Publish All
            </button>
          </div>
        ) : null}

        {msg ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-3 text-sm text-[var(--ll-text-muted)]">
            {msg}
          </div>
        ) : null}

        {/* Student table */}
        {loading ? (
          <div className="h-40 animate-pulse rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70" />
        ) : !classId || !termId ? (
          <div className="rounded-xl border border-dashed border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-6 text-sm text-[var(--ll-text-muted)]">
            Select a class and term above to manage report cards.
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text-muted)]">
            No enrolled students found.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--ll-border)]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ll-border)] bg-[var(--ll-bg)]/80">
                  <th className="px-4 py-3 text-left font-semibold text-[var(--ll-text)]">Student</th>
                  <th className="px-3 py-3 text-center font-medium text-[var(--ll-text-muted)]">Status</th>
                  <th className="px-3 py-3 text-center font-medium text-[var(--ll-text-muted)]">Generated</th>
                  <th className="px-3 py-3 text-center font-medium text-[var(--ll-text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-b border-[var(--ll-border)] last:border-b-0">
                    <td className="px-4 py-3 font-medium text-[var(--ll-text)]">{s.name}</td>
                    <td className="px-3 py-3 text-center">
                      {s.reportCard ? statusBadge(s.reportCard.status) : (
                        <span className="text-xs text-[var(--ll-text-faint)]">Not generated</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-[var(--ll-text-muted)]">
                      {s.reportCard
                        ? new Date(s.reportCard.generatedAt).toLocaleDateString("en-LR")
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {s.reportCard ? (
                          <>
                            <a
                              href={`/api/reports/progress/${s.id}${termId ? `?termId=${termId}` : ""}`}
                              download
                              className="rounded-full border border-emerald-600/40 bg-emerald-950/20 px-3 py-1 text-xs font-semibold text-emerald-400 hover:border-emerald-500/60"
                            >
                              PDF Report
                            </a>
                            <Link
                              href={`/student/report-cards/${s.reportCard.id}/print`}
                              target="_blank"
                              className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                            >
                              Preview
                            </Link>
                            {s.reportCard.status === "DRAFT" ? (
                              <button
                                type="button"
                                onClick={() => handlePublish(s.reportCard!.id)}
                                disabled={busy}
                                className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300 disabled:opacity-60"
                              >
                                Publish
                              </button>
                            ) : null}
                            {s.reportCard.status === "DRAFT" ? (
                              <button
                                type="button"
                                onClick={() => handleRegenerate(s.id)}
                                disabled={busy}
                                className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] disabled:opacity-60"
                              >
                                Regenerate
                              </button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
