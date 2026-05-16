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
  aiGrade: number | null;
  aiFeedback: string | null;
  aiRationale: string | null;
  aiGradedAt: string | null;
  teacherApproved: boolean;
  approvedAt: string | null;
  autoReleasedAt: string | null;
};

type FormState = Record<
  string,
  { grade: string; feedback: string; saving: boolean; message: string | null; expanded: boolean; overriding: boolean }
>;

type FilterTab = "all" | "ungraded" | "graded" | "pending_ai";

export default function GradingInboxPage() {
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [formState, setFormState] = useState<FormState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>("pending_ai");
  const [bulkApproving, setBulkApproving] = useState<Record<string, boolean>>({});

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
                grade: r.score?.toString() ?? r.aiGrade?.toString() ?? "",
                feedback: r.feedback ?? "",
                saving: false,
                message: null,
                expanded: false,
                overriding: false,
              },
            ])
          )
        );
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const pendingAiCount = useMemo(
    () => submissions.filter((s) => s.aiGrade !== null && !s.teacherApproved && !s.autoReleasedAt).length,
    [submissions]
  );
  const ungradedCount = useMemo(() => submissions.filter((s) => s.score === null).length, [submissions]);

  const filtered = useMemo(() => {
    if (tab === "ungraded") return submissions.filter((s) => s.score === null);
    if (tab === "graded") return submissions.filter((s) => s.score !== null);
    if (tab === "pending_ai")
      return submissions.filter((s) => s.aiGrade !== null && !s.teacherApproved && !s.autoReleasedAt);
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

  function startOverride(id: string, aiGrade: number) {
    setFormState((s) => ({
      ...s,
      [id]: { ...s[id], grade: aiGrade.toString(), overriding: true, message: null },
    }));
  }

  async function approveGrade(submissionId: string, overrideGrade?: number) {
    setFormState((s) => ({ ...s, [submissionId]: { ...s[submissionId], saving: true, message: null } }));
    try {
      const body: Record<string, unknown> = {};
      if (overrideGrade !== undefined) body.overrideGrade = overrideGrade;
      const res = await fetch(`/api/teacher/assignments/submissions/${submissionId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to approve");
      setSubmissions((rows) =>
        rows.map((r) =>
          r.id === submissionId
            ? { ...r, score: data.submission.grade, teacherApproved: true, approvedAt: data.submission.approvedAt }
            : r
        )
      );
      setFormState((s) => ({ ...s, [submissionId]: { ...s[submissionId], saving: false, message: "Approved", overriding: false } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to approve";
      setFormState((s) => ({ ...s, [submissionId]: { ...s[submissionId], saving: false, message: msg } }));
    }
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
      setFormState((s) => ({ ...s, [id]: { ...s[id], saving: false, message: "Saved", overriding: false } }));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save grade";
      setFormState((s) => ({ ...s, [id]: { ...s[id], saving: false, message: msg } }));
    }
  }

  async function bulkApprove(assignmentId: string, assignmentTitle: string, count: number) {
    if (!confirm(`Approve all ${count} AI-generated grades for "${assignmentTitle}"?`)) return;
    setBulkApproving((s) => ({ ...s, [assignmentId]: true }));
    try {
      const res = await fetch("/api/teacher/assignments/bulk-approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSubmissions((rows) =>
        rows.map((r) =>
          r.assignmentId === assignmentId && r.aiGrade !== null && !r.teacherApproved
            ? { ...r, score: r.aiGrade, teacherApproved: true }
            : r
        )
      );
    } catch {
      // silent
    } finally {
      setBulkApproving((s) => ({ ...s, [assignmentId]: false }));
    }
  }

  const tabs: { key: FilterTab; label: string; count?: number }[] = [
    { key: "pending_ai", label: "Pending AI", count: pendingAiCount },
    { key: "ungraded", label: "Ungraded", count: ungradedCount },
    { key: "graded", label: "Graded" },
    { key: "all", label: "All" },
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
            {pendingAiCount > 0 ? (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                {pendingAiCount} pending AI grades
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Review student submissions and approve or override AI-suggested grades.
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
              {t.count !== undefined && t.count > 0 ? (
                <span className="ml-1 text-xs">({t.count})</span>
              ) : null}
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
            {tab === "pending_ai"
              ? "No submissions awaiting AI grade approval."
              : tab === "ungraded"
              ? "No ungraded submissions."
              : tab === "graded"
              ? "No graded submissions yet."
              : "No submissions yet."}
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => {
              const pendingInGroup = group.rows.filter(
                (r) => r.aiGrade !== null && !r.teacherApproved && !r.autoReleasedAt
              );
              return (
                <section key={group.title} className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-[var(--ll-text)]">{group.title}</h2>
                    {pendingInGroup.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => bulkApprove(group.rows[0].assignmentId, group.title, pendingInGroup.length)}
                        disabled={bulkApproving[group.rows[0].assignmentId]}
                        className="rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 disabled:opacity-60"
                      >
                        {bulkApproving[group.rows[0].assignmentId]
                          ? "Approving…"
                          : `Approve All AI Grades (${pendingInGroup.length})`}
                      </button>
                    ) : null}
                  </div>

                  {group.rows.map((sub) => {
                    const st = formState[sub.id] ?? {
                      grade: "",
                      feedback: "",
                      saving: false,
                      message: null,
                      expanded: false,
                      overriding: false,
                    };
                    const isGraded = sub.score !== null;
                    const hasPendingAI = sub.aiGrade !== null && !sub.teacherApproved && !sub.autoReleasedAt;

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

                          <div className="flex flex-wrap gap-2">
                            {sub.teacherApproved && isGraded ? (
                              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                                Graded: {sub.score}/100
                              </span>
                            ) : hasPendingAI ? (
                              <span className="rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-300">
                                AI Suggests: {sub.aiGrade}/100
                              </span>
                            ) : isGraded ? (
                              <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                  sub.score! >= 80
                                    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                    : sub.score! >= 60
                                    ? "border border-amber-400/20 bg-amber-400/10 text-amber-300"
                                    : "border border-red-500/20 bg-red-500/10 text-red-300"
                                }`}
                              >
                                {sub.score}/100
                              </span>
                            ) : (
                              <span className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-1 text-xs font-semibold text-[var(--ll-text-muted)]">
                                Ungraded
                              </span>
                            )}
                          </div>
                        </div>

                        {hasPendingAI && sub.aiRationale ? (
                          <p className="mt-2 text-xs text-[var(--ll-text-muted)] italic">
                            AI rationale: {sub.aiRationale}
                          </p>
                        ) : null}

                        {sub.teacherApproved ? (
                          <p className="mt-1 text-xs text-[var(--ll-text-faint)]">AI assisted</p>
                        ) : null}

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

                        {hasPendingAI && !st.overriding ? (
                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() => approveGrade(sub.id)}
                              disabled={st.saving}
                              className="rounded-full bg-emerald-500/20 px-5 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-60"
                            >
                              {st.saving ? "Approving…" : "Approve"}
                            </button>
                            <button
                              type="button"
                              onClick={() => startOverride(sub.id, sub.aiGrade!)}
                              className="rounded-full border border-[var(--ll-border)] px-5 py-2 text-sm font-medium text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                            >
                              Override
                            </button>
                            {st.message ? (
                              <p className={`text-sm ${st.message === "Approved" ? "text-emerald-300" : "text-red-300"}`}>
                                {st.message}
                              </p>
                            ) : null}
                          </div>
                        ) : st.overriding ? (
                          <div className="mt-4 space-y-3">
                            <div className="grid gap-3 md:grid-cols-[140px,1fr]">
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
                                  placeholder="Add feedback for the student…"
                                />
                              </label>
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const g = Number(st.grade);
                                  if (!Number.isInteger(g) || g < 0 || g > 100) {
                                    setFormState((prev) => ({
                                      ...prev,
                                      [sub.id]: { ...prev[sub.id], message: "Grade must be 0–100" },
                                    }));
                                    return;
                                  }
                                  approveGrade(sub.id, g);
                                }}
                                disabled={st.saving}
                                className="rounded-full bg-[var(--ll-yellow-soft)] px-5 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
                              >
                                {st.saving ? "Saving…" : "Save Override"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setFormState((prev) => ({
                                    ...prev,
                                    [sub.id]: { ...prev[sub.id], overriding: false },
                                  }))
                                }
                                className="text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                              >
                                Cancel
                              </button>
                              {st.message ? (
                                <p className={`text-sm ${st.message === "Approved" ? "text-emerald-300" : "text-red-300"}`}>
                                  {st.message}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        ) : !isGraded ? (
                          <div className="mt-4 space-y-3">
                            <div className="grid gap-3 md:grid-cols-[140px,1fr]">
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
                            <div className="flex flex-wrap items-center gap-3">
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
                        ) : null}
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
