"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type SubmissionRow = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  className: string;
  subject: string;
  points: number;
  dueAt: string | null;
  studentId: string;
  studentName: string;
  submittedAt: string | null;
  score: number | null;
  feedback: string;
  content: string;
};

type FormState = Record<
  string,
  { grade: string; feedback: string; saving: boolean; message: string | null; expanded: boolean }
>;

type FilterTab = "all" | "ungraded" | "graded";

export default function GradingInboxPage() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [formState, setFormState] = useState<FormState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("ungraded");

  useEffect(() => {
    fetch("/api/teacher/assignments", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load submissions");
        return (data.submissions ?? []) as SubmissionRow[];
      })
      .then((rows) => {
        setSubmissions(rows);
        setFormState(
          Object.fromEntries(
            rows.map((r) => [
              r.id,
              {
                grade: r.score?.toString() ?? "",
                feedback: r.feedback ?? "",
                saving: false,
                message: null,
                expanded: false,
              },
            ])
          )
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const ungradedCount = useMemo(() => submissions.filter((s) => s.score === null).length, [submissions]);

  const filtered = useMemo(() => {
    if (tab === "ungraded") return submissions.filter((s) => s.score === null);
    if (tab === "graded") return submissions.filter((s) => s.score !== null);
    return submissions;
  }, [submissions, tab]);

  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; rows: SubmissionRow[] }>();
    for (const row of filtered) {
      if (!map.has(row.assignmentId)) {
        map.set(row.assignmentId, { title: row.assignmentTitle, rows: [] });
      }
      map.get(row.assignmentId)!.rows.push(row);
    }
    return Array.from(map.values());
  }, [filtered]);

  function update(id: string, field: "grade" | "feedback", value: string) {
    setFormState((s) => ({ ...s, [id]: { ...s[id], [field]: value, message: null } }));
  }

  function toggleExpand(id: string) {
    setFormState((s) => ({ ...s, [id]: { ...s[id], expanded: !s[id]?.expanded } }));
  }

  async function saveGrade(id: string) {
    const cur = formState[id];
    if (!cur) return;
    const gradeNum = Number(cur.grade);
    if (!Number.isInteger(gradeNum) || gradeNum < 0 || gradeNum > 100) {
      setFormState((s) => ({ ...s, [id]: { ...s[id], message: "Grade must be 0–100" } }));
      return;
    }
    setFormState((s) => ({ ...s, [id]: { ...s[id], saving: true, message: null } }));
    try {
      const res = await fetch(`/api/teacher/assignments/submissions/${id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: gradeNum, feedback: cur.feedback }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save grade");
      setSubmissions((rows) =>
        rows.map((r) => (r.id === id ? { ...r, score: data.submission.grade, feedback: data.submission.feedback } : r))
      );
      setFormState((s) => ({ ...s, [id]: { ...s[id], saving: false, message: "Saved" } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save grade";
      setFormState((s) => ({ ...s, [id]: { ...s[id], saving: false, message: msg } }));
    }
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "ungraded", label: "Ungraded" },
    { key: "graded", label: "Graded" },
  ];

  return (
    <main className="ll-dashboard-shell px-4 py-5 text-[var(--ll-text)]">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-6">
        <div>
          <Link
            href="/teacher/assignments"
            className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Assignments
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">Grading Inbox</h1>
            {ungradedCount > 0 ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                {ungradedCount} ungraded
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Review student submissions and save grades.
          </p>
        </div>

        <div className="flex gap-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-[var(--ll-yellow-soft)] text-[var(--ll-text-faint)]"
                  : "text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : grouped.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text-muted)]">
            {tab === "ungraded" ? "No ungraded submissions." : tab === "graded" ? "No graded submissions yet." : "No submissions yet."}
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.title} className="space-y-3">
                <h2 className="text-base font-semibold text-[var(--ll-text)]">{group.title}</h2>
                {group.rows.map((sub) => {
                  const st = formState[sub.id] ?? { grade: "", feedback: "", saving: false, message: null, expanded: false };
                  const isGraded = sub.score !== null;
                  return (
                    <div
                      key={sub.id}
                      className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-[var(--ll-text)]">{sub.studentName}</p>
                          <p className="mt-0.5 text-xs text-[var(--ll-text-muted)]">
                            {sub.className} ·{" "}
                            {sub.submittedAt
                              ? new Date(sub.submittedAt).toLocaleDateString("en-LR")
                              : "Not submitted"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            isGraded
                              ? sub.score! >= 80
                                ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                : sub.score! >= 60
                                  ? "border border-amber-400/20 bg-amber-400/10 text-amber-300"
                                  : "border border-red-500/20 bg-red-500/10 text-red-300"
                              : "border border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text-muted)]"
                          }`}
                        >
                          {isGraded ? `${sub.score}/100` : "Ungraded"}
                        </span>
                      </div>

                      {sub.content ? (
                        <div className="mt-3">
                          <p className="text-sm text-[var(--ll-text)]">
                            {st.expanded ? sub.content : sub.content.slice(0, 150)}
                            {sub.content.length > 150 ? (
                              <button
                                type="button"
                                onClick={() => toggleExpand(sub.id)}
                                className="ml-1 text-xs text-[var(--ll-yellow)] hover:underline"
                              >
                                {st.expanded ? " show less" : "… show more"}
                              </button>
                            ) : null}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-4 grid gap-3 md:grid-cols-[140px,1fr]">
                        <label className="space-y-1.5 text-sm">
                          <span className="text-[var(--ll-text-muted)]">Grade (0–100)</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={st.grade}
                            onChange={(e) => update(sub.id, "grade", e.target.value)}
                            className="min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-[var(--ll-text)]"
                          />
                        </label>
                        <label className="space-y-1.5 text-sm">
                          <span className="text-[var(--ll-text-muted)]">Feedback</span>
                          <textarea
                            value={st.feedback}
                            onChange={(e) => update(sub.id, "feedback", e.target.value)}
                            rows={2}
                            className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm text-[var(--ll-text)]"
                            placeholder="Add constructive feedback for the student…"
                          />
                        </label>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => saveGrade(sub.id)}
                          disabled={st.saving}
                          className="rounded-full bg-[var(--ll-yellow-soft)] px-5 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
                        >
                          {st.saving ? "Saving…" : "Save Grade"}
                        </button>
                        {st.message ? (
                          <p className={`text-sm ${st.message === "Saved" ? "text-emerald-300" : "text-red-300"}`}>
                            {st.message}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
