"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type ClassOption = { id: string; name: string; subject: string };
type Term = { id: string; name: string; yearLabel?: string };
type AcademicYear = { id: string; yearLabel: string; terms: Term[] };
type StudentRow = {
  id: string;
  name: string;
  reportCard: {
    id: string;
    status: string;
    generatedAt: string;
    teacherComment: string | null;
  } | null;
};
type PageData = { classes: ClassOption[]; academicYears: AcademicYear[]; students?: StudentRow[] };

export default function TeacherReportCardsPage() {
  const [data, setData] = useState<PageData | null>(null);
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (cid = classId, tid = termId) => {
    setLoading(true);
    const url = `/api/admin/report-cards${cid && tid ? `?classId=${cid}&termId=${tid}` : ""}`;
    const res = await fetch(url, { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [classId, termId]);

  useEffect(() => { fetchData("", ""); }, [fetchData]);

  function handleClassChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setClassId(e.target.value);
    setTermId("");
    setData((d) => (d ? { classes: d.classes, academicYears: d.academicYears } : null));
  }

  async function saveComment(cardId: string) {
    setSaving(cardId);
    try {
      await fetch(`/api/report-cards/${cardId}/comment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherComment: commentDraft[cardId] ?? "" }),
      });
      await fetchData(classId, termId);
    } finally {
      setSaving(null);
    }
  }

  const classes = data?.classes ?? [];
  const terms = (data?.academicYears ?? []).flatMap((y) =>
    y.terms.map((t) => ({ ...t, yearLabel: y.yearLabel }))
  );
  const students = data?.students ?? [];

  return (
    <main className="ll-dashboard-shell px-4 py-5 text-[var(--ll-text)]">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Report Cards</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Add your teacher comments. Grades and publishing are managed by the admin.
          </p>
        </div>

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
                <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>
              ))}
            </select>
          </label>
          <label className="flex-1 min-w-40 space-y-1.5 text-sm">
            <span className="text-[var(--ll-text-muted)]">Term</span>
            <select
              value={termId}
              onChange={(e) => { setTermId(e.target.value); if (classId && e.target.value) fetchData(classId, e.target.value); }}
              disabled={!classId}
              className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-[var(--ll-text)] disabled:opacity-50"
            >
              <option value="">Select a term…</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.yearLabel})</option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="h-40 animate-pulse rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70" />
        ) : !classId || !termId ? (
          <div className="rounded-xl border border-dashed border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-6 text-sm text-[var(--ll-text-muted)]">
            Select a class and term to view report cards.
          </div>
        ) : students.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] p-6 text-sm text-[var(--ll-text-muted)]">
            No enrolled students found.
          </div>
        ) : (
          <div className="space-y-4">
            {students.map((s) => (
              <div key={s.id} className="ll-card space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[var(--ll-text)]">{s.name}</p>
                    {s.reportCard ? (
                      <p className="text-xs text-[var(--ll-text-muted)] mt-0.5">
                        Status: {s.reportCard.status === "PUBLISHED" ? "Published" : "Draft"} &middot; Generated {new Date(s.reportCard.generatedAt).toLocaleDateString("en-LR")}
                      </p>
                    ) : (
                      <p className="text-xs text-[var(--ll-text-faint)] mt-0.5">Not generated yet</p>
                    )}
                  </div>
                  {s.reportCard ? (
                    <Link
                      href={`/student/report-cards/${s.reportCard.id}/print`}
                      target="_blank"
                      className="shrink-0 rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                    >
                      Preview
                    </Link>
                  ) : null}
                </div>

                {s.reportCard ? (
                  <div className="space-y-2">
                    <label className="block text-sm text-[var(--ll-text-muted)]">
                      Teacher Comment
                    </label>
                    <textarea
                      rows={3}
                      value={commentDraft[s.reportCard.id] ?? s.reportCard.teacherComment ?? ""}
                      onChange={(e) =>
                        setCommentDraft((d) => ({ ...d, [s.reportCard!.id]: e.target.value }))
                      }
                      placeholder="Add your comment for this student…"
                      className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)]"
                    />
                    <button
                      type="button"
                      onClick={() => saveComment(s.reportCard!.id)}
                      disabled={saving === s.reportCard.id}
                      className="min-h-9 rounded-full bg-[var(--ll-yellow)] px-4 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
                    >
                      {saving === s.reportCard.id ? "Saving…" : "Save Comment"}
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
