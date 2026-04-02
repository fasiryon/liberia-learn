"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TeacherNav } from "@/components/teacher/TeacherNav";

type AssignmentRow = {
  id: string;
  title: string;
  description: string;
  classId: string;
  className: string;
  subject: string;
  points: number;
  dueAt: string | null;
  createdAt: string;
  submittedCount: number;
  gradedCount: number;
  studentCount: number;
};

type AssignmentSubmissionRow = {
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
  { grade: string; feedback: string; saving: boolean; message: string | null }
>;

export default function TeacherAssignmentsPage() {
  const searchParams = useSearchParams();
  const created = searchParams.get("created") === "1";
  const [submissions, setSubmissions] = useState<AssignmentSubmissionRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [formState, setFormState] = useState<FormState>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/teacher/assignments", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to load assignment grading queue");
        }
        return data;
      })
      .then((data) => {
        if (!active) return;
        setAssignments((data.assignments ?? []) as AssignmentRow[]);
        const rows = (data.submissions ?? []) as AssignmentSubmissionRow[];
        setSubmissions(rows);
        setFormState(
          Object.fromEntries(
            rows.map((row) => [
              row.id,
              {
                grade: row.score?.toString() ?? "",
                feedback: row.feedback ?? "",
                saving: false,
                message: null,
              },
            ])
          )
        );
      })
      .catch((fetchError: Error) => {
        if (active) setError(fetchError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function updateField(id: string, field: "grade" | "feedback", value: string) {
    setFormState((current) => ({
      ...current,
      [id]: {
        grade: current[id]?.grade ?? "",
        feedback: current[id]?.feedback ?? "",
        saving: current[id]?.saving ?? false,
        message: null,
        [field]: value,
      },
    }));
  }

  async function saveGrade(id: string) {
    const current = formState[id];
    if (!current) return;

    setFormState((state) => ({
      ...state,
      [id]: { ...state[id], saving: true, message: null },
    }));

    try {
      const response = await fetch(`/api/teacher/assignments/${id}/grade`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: Number(current.grade),
          feedback: current.feedback,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save grade");
      }

      setSubmissions((rows) =>
        rows.map((row) =>
          row.id === id
            ? { ...row, score: data.submission.score, feedback: data.submission.feedback }
            : row
        )
      );
      setFormState((state) => ({
        ...state,
        [id]: {
          ...state[id],
          saving: false,
          grade: data.submission.score?.toString() ?? "",
          feedback: data.submission.feedback ?? "",
          message: "Saved",
        },
      }));
    } catch (saveError: any) {
      setFormState((state) => ({
        ...state,
        [id]: {
          ...state[id],
          saving: false,
          message: saveError?.message ?? "Failed to save grade",
        },
      }));
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link
            href="/teacher/dashboard"
            className="text-sm text-emerald-300 hover:text-emerald-200"
          >
            &larr; Back to Teacher Dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Assignment Grading</h1>
          <p className="mt-2 text-sm text-slate-400">
            Review assignment responses, save grades, and notify guardians when grading is complete.
          </p>
        </div>

        <TeacherNav />

        {created ? (
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Assignment created. Students can now open it from their assignment view, and submissions will appear here for grading.
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded-3xl border border-white/10 bg-slate-900/70"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
            {error}
          </div>
        ) : submissions.length === 0 ? (
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Recent assignments</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Track what has been assigned even before submissions arrive.
                  </p>
                </div>
                <Link
                  href="/teacher/assignments/new"
                  className="inline-flex rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950"
                >
                  Create Assignment
                </Link>
              </div>

              {assignments.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-sm text-slate-300">
                  No assignments yet. Create your first assignment to get started.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {assignments.map((assignment) => (
                    <section
                      key={assignment.id}
                      className="rounded-3xl border border-white/10 bg-slate-950/60 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-100">{assignment.title}</h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {assignment.className} · {assignment.subject.replace(/_/g, " ")}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                          {assignment.points} pts
                        </span>
                      </div>
                      {assignment.description ? (
                        <p className="mt-3 line-clamp-3 text-sm text-slate-300">{assignment.description}</p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                        <span>Assigned {new Date(assignment.createdAt).toLocaleDateString("en-LR")}</span>
                        <span>
                          Due {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString("en-LR") : "not set"}
                        </span>
                        <span>{assignment.submittedCount} submitted</span>
                        <span>{assignment.gradedCount} graded</span>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
              No submissions need grading yet.
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">Recent assignments</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Review assignment coverage before submissions move into grading.
                  </p>
                </div>
                <Link
                  href="/teacher/assignments/new"
                  className="inline-flex rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950"
                >
                  Create Assignment
                </Link>
              </div>

              {assignments.length === 0 ? (
                <p className="mt-5 text-sm text-slate-400">No assignments created yet.</p>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {assignments.map((assignment) => (
                    <section
                      key={assignment.id}
                      className="rounded-3xl border border-white/10 bg-slate-950/60 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-100">{assignment.title}</h3>
                          <p className="mt-1 text-sm text-slate-400">
                            {assignment.className} · {assignment.subject.replace(/_/g, " ")}
                          </p>
                        </div>
                        <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300">
                          {assignment.points} pts
                        </span>
                      </div>
                      {assignment.description ? (
                        <p className="mt-3 line-clamp-3 text-sm text-slate-300">{assignment.description}</p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
                        <span>Assigned {new Date(assignment.createdAt).toLocaleDateString("en-LR")}</span>
                        <span>
                          Due {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString("en-LR") : "not set"}
                        </span>
                        <span>{assignment.submittedCount} submitted</span>
                        <span>{assignment.gradedCount} graded</span>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>

            <div className="space-y-4">
            {submissions.map((submission) => {
              const state = formState[submission.id] ?? {
                grade: "",
                feedback: "",
                saving: false,
                message: null,
              };

              return (
                <section
                  key={submission.id}
                  className="rounded-3xl border border-white/10 bg-slate-900/70 p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-slate-50">
                        {submission.assignmentTitle}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {submission.studentName} · {submission.className} ·{" "}
                        {submission.subject.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Submitted{" "}
                        {submission.submittedAt
                          ? new Date(submission.submittedAt).toLocaleString("en-LR")
                          : "Not submitted yet"}
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                      {submission.score == null
                        ? "Pending grading"
                        : `Scored ${submission.score}/100`}
                    </span>
                  </div>

                  <div className="mt-4 rounded-2xl bg-slate-950/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-slate-500">
                      Student response
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
                      {submission.content || "No response recorded."}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[160px,1fr]">
                    <label className="space-y-2 text-sm">
                      <span className="text-slate-300">Grade (0-100)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={state.grade}
                        onChange={(event) =>
                          updateField(submission.id, "grade", event.target.value)
                        }
                        className="min-h-11 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="text-slate-300">Feedback</span>
                      <textarea
                        value={state.feedback}
                        onChange={(event) =>
                          updateField(submission.id, "feedback", event.target.value)
                        }
                        className="min-h-[120px] w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100"
                        placeholder="Add clear, constructive feedback for the student and guardian."
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => saveGrade(submission.id)}
                      disabled={state.saving}
                      className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {state.saving ? "Saving..." : "Save Grade"}
                    </button>
                    {state.message ? (
                      <p
                        className={`text-sm ${
                          state.message === "Saved" ? "text-emerald-300" : "text-red-300"
                        }`}
                      >
                        {state.message}
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
