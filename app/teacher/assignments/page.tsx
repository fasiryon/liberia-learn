"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AITrustBadge } from "@/components/ai/AITrustBadge";
import { TeacherNav } from "@/components/teacher/TeacherNav";

type AssignmentRow = {
  id: string;
  title: string;
  description: string;
  classId: string;
  className: string;
  teacherName: string;
  subject: string;
  points: number;
  dueAt: string | null;
  createdAt: string;
  submittedCount: number;
  completionCount: number;
  gradedCount: number;
  studentCount: number;
  averageScore: number | null;
  pendingStudents: string[];
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
  {
    grade: string;
    feedback: string;
    saving: boolean;
    assisting: boolean;
    message: string | null;
    aiSuggestion?: {
      suggestedScore: number;
      feedback: string;
      strengths: string[];
      improvements: string[];
      confidence: "high" | "medium" | "low";
      warning?: string;
    } | null;
  }
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
                assisting: false,
                message: null,
                aiSuggestion: null,
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
        assisting: current[id]?.assisting ?? false,
        message: null,
        aiSuggestion: current[id]?.aiSuggestion ?? null,
        [field]: value,
      },
    }));
  }

  async function requestAiAssist(submission: AssignmentSubmissionRow) {
    setFormState((state) => ({
      ...state,
      [submission.id]: {
        grade: state[submission.id]?.grade ?? "",
        feedback: state[submission.id]?.feedback ?? "",
        saving: state[submission.id]?.saving ?? false,
        assisting: true,
        message: null,
        aiSuggestion: state[submission.id]?.aiSuggestion ?? null,
      },
    }));

    try {
      const response = await fetch("/api/teacher/grading-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: submission.id,
          studentAnswer: submission.content || "No response recorded.",
          objectives: [submission.assignmentTitle],
          rubric: `Grade this assignment out of ${submission.points} point(s). Use the assignment title and response as the grounding source.`,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "AI grading assistance is unavailable.");
      }

      setFormState((state) => ({
        ...state,
        [submission.id]: {
          ...state[submission.id],
          grade:
            typeof data.suggestedScore === "number"
              ? String(data.suggestedScore)
              : state[submission.id]?.grade ?? "",
          feedback: typeof data.feedback === "string" ? data.feedback : state[submission.id]?.feedback ?? "",
          assisting: false,
          message: "AI suggestion added. Review before saving.",
          aiSuggestion: {
            suggestedScore: typeof data.suggestedScore === "number" ? data.suggestedScore : 0,
            feedback: typeof data.feedback === "string" ? data.feedback : "",
            strengths: Array.isArray(data.strengths) ? data.strengths : [],
            improvements: Array.isArray(data.improvements) ? data.improvements : [],
            confidence:
              data.confidence === "high" || data.confidence === "medium" || data.confidence === "low"
                ? data.confidence
                : "medium",
            warning: typeof data.warning === "string" ? data.warning : undefined,
          },
        },
      }));
    } catch (error: any) {
      setFormState((state) => ({
        ...state,
        [submission.id]: {
          ...state[submission.id],
          assisting: false,
          message: error?.message ?? "AI grading assistance is unavailable.",
        },
      }));
    }
  }

  async function rejectAiAssist(submission: AssignmentSubmissionRow) {
    await fetch("/api/teacher/grading-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "reject",
        submissionId: submission.id,
        studentAnswer: submission.content || "No response recorded.",
        objectives: [submission.assignmentTitle],
      }),
    }).catch(() => null);
    setFormState((state) => ({
      ...state,
      [submission.id]: {
        ...state[submission.id],
        aiSuggestion: null,
        message: "AI suggestion rejected.",
      },
    }));
  }

  async function saveGrade(id: string, aiGradingAssistAction?: "accepted" | "edited") {
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
          aiGradingAssistAction,
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
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link
            href="/teacher/dashboard"
            className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
          >
            &larr; Back to Teacher Dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Assignment Grading</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Review assignment responses, save grades, and notify guardians when grading is complete.
          </p>
        </div>

        <TeacherNav />

        {created ? (
          <div className="rounded-xl border border-emerald-500/20 bg-[var(--ll-yellow)]/10 p-4 text-sm text-[var(--ll-yellow)]">
            Assignment created. Students can now open it from their assignment view, and submissions will appear here for grading.
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                className="h-44 animate-pulse rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
            {error}
          </div>
        ) : submissions.length === 0 ? (
          <div className="space-y-6">
            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--ll-text)]">Recent assignments</h2>
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                    Track what has been assigned even before submissions arrive.
                  </p>
                </div>
                <Link
                  href="/teacher/assignments/new"
                  className="inline-flex rounded-full bg-[var(--ll-yellow-soft)] px-5 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
                >
                  Create Assignment
                </Link>
              </div>

              {assignments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-6 text-sm text-[var(--ll-text)]">
                  No assignments yet. Create your first assignment to get started.
                </div>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {assignments.map((assignment) => (
                    <section
                      key={assignment.id}
                      className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-[var(--ll-text)]">{assignment.title}</h3>
                          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                            {assignment.className} · {assignment.subject.replace(/_/g, " ")}
                          </p>
                        </div>
                        <span className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text)]">
                          {assignment.points} pts
                        </span>
                      </div>
                      {assignment.description ? (
                        <p className="mt-3 line-clamp-3 text-sm text-[var(--ll-text)]">{assignment.description}</p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--ll-text-muted)]">
                        <span>Assigned {new Date(assignment.createdAt).toLocaleDateString("en-LR")}</span>
                        <span>
                          Due {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString("en-LR") : "not set"}
                        </span>
                        <span>{assignment.completionCount}/{assignment.studentCount} completed</span>
                        <span>{assignment.gradedCount} graded</span>
                        <span>{assignment.averageScore == null ? "No score yet" : `Avg score ${assignment.averageScore}%`}</span>
                      </div>
                      <div className="mt-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Completion tracking</p>
                          <a
                            href={`/api/teacher/assignments/${assignment.id}/export`}
                            className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[11px] text-[var(--ll-text)] hover:text-[var(--ll-text)]"
                          >
                            Export CSV
                          </a>
                        </div>
                        <p className="mt-2 text-sm text-[var(--ll-text)]">
                          Assigned by {assignment.teacherName}
                        </p>
                        {assignment.pendingStudents.length === 0 ? (
                          <p className="mt-2 text-sm text-[var(--ll-yellow)]">Everyone in this class has completed the assignment.</p>
                        ) : (
                          <p className="mt-2 text-sm text-[var(--ll-text)]">
                            Not completed: {assignment.pendingStudents.slice(0, 6).join(", ")}
                            {assignment.pendingStudents.length > 6 ? ` +${assignment.pendingStudents.length - 6} more` : ""}
                          </p>
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text)]">
              No submissions need grading yet.
            </section>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--ll-text)]">Recent assignments</h2>
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                    Review assignment coverage before submissions move into grading.
                  </p>
                </div>
                <Link
                  href="/teacher/assignments/new"
                  className="inline-flex rounded-full bg-[var(--ll-yellow-soft)] px-5 py-2 text-sm font-semibold text-[var(--ll-text-faint)]"
                >
                  Create Assignment
                </Link>
              </div>

              {assignments.length === 0 ? (
                <p className="mt-5 text-sm text-[var(--ll-text-muted)]">No assignments created yet.</p>
              ) : (
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {assignments.map((assignment) => (
                    <section
                      key={assignment.id}
                      className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-[var(--ll-text)]">{assignment.title}</h3>
                          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                            {assignment.className} · {assignment.subject.replace(/_/g, " ")}
                          </p>
                        </div>
                        <span className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text)]">
                          {assignment.points} pts
                        </span>
                      </div>
                      {assignment.description ? (
                        <p className="mt-3 line-clamp-3 text-sm text-[var(--ll-text)]">{assignment.description}</p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--ll-text-muted)]">
                        <span>Assigned {new Date(assignment.createdAt).toLocaleDateString("en-LR")}</span>
                        <span>
                          Due {assignment.dueAt ? new Date(assignment.dueAt).toLocaleString("en-LR") : "not set"}
                        </span>
                        <span>{assignment.completionCount}/{assignment.studentCount} completed</span>
                        <span>{assignment.gradedCount} graded</span>
                        <span>{assignment.averageScore == null ? "No score yet" : `Avg score ${assignment.averageScore}%`}</span>
                      </div>
                      <div className="mt-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Completion tracking</p>
                          <a
                            href={`/api/teacher/assignments/${assignment.id}/export`}
                            className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[11px] text-[var(--ll-text)] hover:text-[var(--ll-text)]"
                          >
                            Export CSV
                          </a>
                        </div>
                        <p className="mt-2 text-sm text-[var(--ll-text)]">
                          Assigned by {assignment.teacherName}
                        </p>
                        {assignment.pendingStudents.length === 0 ? (
                          <p className="mt-2 text-sm text-[var(--ll-yellow)]">Everyone in this class has completed the assignment.</p>
                        ) : (
                          <p className="mt-2 text-sm text-[var(--ll-text)]">
                            Not completed: {assignment.pendingStudents.slice(0, 6).join(", ")}
                            {assignment.pendingStudents.length > 6 ? ` +${assignment.pendingStudents.length - 6} more` : ""}
                          </p>
                        )}
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
                assisting: false,
                message: null,
                aiSuggestion: null,
              };

              return (
                <section
                  key={submission.id}
                  className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-semibold text-[var(--ll-text)]">
                        {submission.assignmentTitle}
                      </h2>
                      <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                        {submission.studentName} · {submission.className} ·{" "}
                        {submission.subject.replace(/_/g, " ")}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                        Submitted{" "}
                        {submission.submittedAt
                          ? new Date(submission.submittedAt).toLocaleString("en-LR")
                          : "Not submitted yet"}
                      </p>
                    </div>
                    <span className="rounded-full border border-amber-400/20 bg-[var(--ll-yellow-soft)] px-3 py-1 text-xs font-semibold text-[var(--ll-yellow)]">
                      {submission.score == null
                        ? "Pending grading"
                        : `Scored ${submission.score}/100`}
                    </span>
                  </div>

                  <div className="mt-4 rounded-xl bg-[var(--ll-bg)]/70 p-4">
                    <p className="text-xs uppercase tracking-wide text-[var(--ll-text-faint)]">
                      Student response
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--ll-text)]">
                      {submission.content || "No response recorded."}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-[160px,1fr]">
                    <label className="space-y-2 text-sm">
                      <span className="text-[var(--ll-text)]">Grade (0-100)</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={state.grade}
                        onChange={(event) =>
                          updateField(submission.id, "grade", event.target.value)
                        }
                        className="min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-[var(--ll-text)]"
                      />
                    </label>
                    <label className="space-y-2 text-sm">
                      <span className="text-[var(--ll-text)]">Feedback</span>
                      <textarea
                        value={state.feedback}
                        onChange={(event) =>
                          updateField(submission.id, "feedback", event.target.value)
                        }
                        className="min-h-[120px] w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-[var(--ll-text)]"
                        placeholder="Add clear, constructive feedback for the student and guardian."
                      />
                    </label>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => requestAiAssist(submission)}
                      disabled={state.assisting || !submission.content}
                      className="rounded-full border border-[var(--ll-border)] px-5 py-2 text-sm font-semibold text-[var(--ll-text)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {state.assisting ? "Getting AI help..." : "AI grading assist"}
                    </button>
                    <button
                      type="button"
                      onClick={() => saveGrade(submission.id, state.aiSuggestion ? "edited" : undefined)}
                      disabled={state.saving}
                      className="rounded-full bg-[var(--ll-yellow-soft)] px-5 py-2 text-sm font-semibold text-[var(--ll-text-faint)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {state.saving ? "Saving..." : "Save Grade"}
                    </button>
                    {state.message ? (
                      <p
                        className={`text-sm ${
                          state.message === "Saved" ? "text-[var(--ll-yellow)]" : "text-red-300"
                        }`}
                      >
                        {state.message}
                      </p>
                    ) : null}
                  </div>
                  {state.aiSuggestion ? (
                    <div className="mt-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-sm text-[var(--ll-text)]">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">
                        AI suggestion for teacher review
                      </p>
                      <div className="mt-2">
                        <AITrustBadge
                          confidenceScore={
                            state.aiSuggestion.confidence === "high"
                              ? 0.9
                              : state.aiSuggestion.confidence === "medium"
                                ? 0.68
                                : 0.35
                          }
                          hadFallback={state.aiSuggestion.confidence === "low"}
                          view="teacher"
                        />
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div>
                          <p className="text-xs text-[var(--ll-text-muted)]">Suggested score</p>
                          <p className="mt-1 font-semibold">
                            {state.aiSuggestion.suggestedScore}/100
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--ll-text-muted)]">Strengths</p>
                          <p className="mt-1 text-xs">{state.aiSuggestion.strengths.slice(0, 2).join("; ") || "Review response against rubric."}</p>
                        </div>
                        <div>
                          <p className="text-xs text-[var(--ll-text-muted)]">Improve next</p>
                          <p className="mt-1 text-xs">{state.aiSuggestion.improvements.slice(0, 2).join("; ") || "Add teacher-specific feedback."}</p>
                        </div>
                      </div>
                      {state.aiSuggestion.warning ? (
                        <p className="mt-3 text-xs text-amber-300">{state.aiSuggestion.warning}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => saveGrade(submission.id, "accepted")}
                          disabled={state.saving}
                          className="rounded-full bg-[var(--ll-yellow-soft)] px-4 py-2 text-xs font-semibold text-[var(--ll-text-faint)] disabled:opacity-60"
                        >
                          Accept and save
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormState((current) => ({
                              ...current,
                              [submission.id]: {
                                ...current[submission.id],
                                message: "Edit the grade or feedback above, then save.",
                              },
                            }))
                          }
                          className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-xs font-semibold text-[var(--ll-text)]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => rejectAiAssist(submission)}
                          className="rounded-full border border-[var(--ll-border)] px-4 py-2 text-xs font-semibold text-[var(--ll-text)]"
                        >
                          Reject
                        </button>
                      </div>
                      <p className="mt-3 text-xs text-[var(--ll-text-faint)]">
                        Teacher approval is required. Saving the grade uses the editable fields above.
                      </p>
                    </div>
                  ) : null}
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
