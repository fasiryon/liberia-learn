"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { useAssignmentPolling } from "@/lib/hooks/useAssignmentPolling";
import { completedScoreLabel, isNewSubmission, sortSubmissionsNewestFirst } from "@/lib/assignments/pollingPresentation";

type ProgressRecord = {
  id: string;
  contentId: string;
  title: string;
  subject: string;
  completedAt: string | null;
  startedAt: string | null;
  scheduledDate: string;
  quizScore: number | null;
};

type TrendsData = {
  recentScores: number[];
  scoreTrend: "improving" | "declining" | "stable";
  subjectAvg: Array<{ subject: string; avg: number }>;
  lastActiveDaysAgo: number | null;
  lessonsThisWeek: number;
  lessonsThisMonth: number;
};

type SubmissionRecord = {
  id: string;
  assignmentId: string;
  assignmentTitle: string;
  className: string;
  subject: string;
  points: number;
  dueAt: string | null;
  submittedAt: string | null;
  score: number | null;
  feedback: string;
  content: string;
};

export default function TeacherStudentDetailPage() {
  const params = useParams();
  const studentId = params.studentId as string;
  const [student, setStudent] = useState<{ id: string; name: string; email: string } | null>(null);
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [trends, setTrends] = useState<TrendsData | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [refreshingSubmissions, setRefreshingSubmissions] = useState(false);
  const [hasNewSubmission, setHasNewSubmission] = useState(false);
  const submissionCountRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStudent = useCallback(async (source: "page" | "poll" | "manual" = "page") => {
    const query = new URLSearchParams({ source });
    if (submissionCountRef.current !== null) {
      query.set("previousSubmissionCount", String(submissionCountRef.current));
    }
    const response = await fetch(`/api/teacher/students/${studentId}?${query.toString()}`, { cache: "no-store" });
    const d = await response.json();
    if (!response.ok || d.error) throw new Error(d.error ?? "Failed to load student");
    setStudent(d.student);
    setRecords(d.records || []);
    setTrends(d.trends ?? null);
    const nextSubmissions = (d.submissions || []) as SubmissionRecord[];
    if (submissionCountRef.current !== null && nextSubmissions.length > submissionCountRef.current) {
      setHasNewSubmission(true);
    }
    submissionCountRef.current = nextSubmissions.length;
    setSubmissions(sortSubmissionsNewestFirst(nextSubmissions));
    setLastCheckedAt(d.serverTime ?? new Date().toISOString());
    setError(null);
  }, [studentId]);

  useEffect(() => {
    loadStudent("page")
      .catch((loadError: Error) => {
        setError(loadError.message);
      })
      .finally(() => setLoading(false));
  }, [loadStudent]);

  const { manualRefresh } = useAssignmentPolling(() => loadStudent("poll"));

  async function refreshSubmissions() {
    setRefreshingSubmissions(true);
    try {
      await manualRefresh();
    } finally {
      setRefreshingSubmissions(false);
    }
  }

  function reviewSubmission(assignmentId: string) {
    setHasNewSubmission(false);
    window.location.href = `/teacher/assignments?assignmentId=${assignmentId}`;
  }

  function formatCheckedAt() {
    if (!lastCheckedAt) return "not checked yet";
    return new Date(lastCheckedAt).toLocaleTimeString("en-LR", { hour: "numeric", minute: "2-digit" });
  }

  if (loading) {
    return (
      <div className="ll-dashboard-shell px-4 py-5">
        <div className="ll-page-enter mx-auto max-w-5xl">
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-[var(--ll-surface)]/50 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ll-dashboard-shell px-4 py-5">
        <div className="ll-page-enter mx-auto max-w-5xl">
          <div className="rounded-xl border border-red-500/20 bg-[var(--ll-bg)]/70 p-8 text-center">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Subject breakdown
  const bySubject: Record<string, { completed: number; total: number }> = {};
  for (const r of records) {
    if (!bySubject[r.subject]) bySubject[r.subject] = { completed: 0, total: 0 };
    bySubject[r.subject].total++;
    if (r.completedAt) bySubject[r.subject].completed++;
  }

  return (
    <div className="ll-dashboard-shell px-4 py-5">
    <div className="ll-page-enter mx-auto max-w-5xl space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--ll-text-faint)]">
        <Link href="/teacher" className="hover:text-[var(--ll-yellow)]">
          Dashboard
        </Link>
        <span>/</span>
        <Link href="/teacher/students" className="hover:text-[var(--ll-yellow)]">
          My Students
        </Link>
        <span>/</span>
        <span className="text-[var(--ll-text-muted)]">{student?.name ?? "Student"}</span>
      </nav>

      <Link
        href="/teacher/students"
        className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] mb-4 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        My Students
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold mt-1">{student?.name || "Student"}</h1>
          {hasNewSubmission ? (
            <span className="rounded-full bg-[var(--ll-yellow-soft)] px-3 py-1 text-xs font-semibold text-[var(--ll-yellow)]">
              New submission received
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[var(--ll-text-muted)]">{student?.email}</p>
      </div>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--ll-text)]">Assignment Submissions</h2>
            <p className="mt-1 max-w-full truncate text-xs text-[var(--ll-text-muted)]">
              Last checked: {formatCheckedAt()}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshSubmissions}
            disabled={refreshingSubmissions}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[var(--ll-border)] px-4 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-60"
          >
            {refreshingSubmissions ? "Refreshing..." : "Refresh submissions"}
          </button>
        </div>
        {submissions.length === 0 ? (
          <p className="mt-4 text-xs text-[var(--ll-text-faint)]">No assignment submissions yet.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {submissions.map((submission) => {
              const submittedAt = submission.submittedAt ? new Date(submission.submittedAt) : null;
              const isRecent = isNewSubmission(submission.submittedAt);
              const scoreLabel = completedScoreLabel(submission);
              return (
                <div
                  key={submission.id}
                  className="flex flex-col gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm ${isRecent ? "font-bold" : "font-medium"} text-[var(--ll-text)]`}>
                        {student?.name ?? "Student"}
                      </p>
                      {isRecent ? (
                        <span className="rounded-full bg-[var(--ll-yellow-soft)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--ll-yellow)]">
                          New
                        </span>
                      ) : null}
                      {scoreLabel ? (
                        <span className="rounded-full bg-[var(--ll-accent-soft)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--ll-accent)]">
                          {scoreLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                      {submission.assignmentTitle} &middot; {submission.subject.replace(/_/g, " ")}
                    </p>
                    <p className="mt-1 text-xs text-[var(--ll-text-faint)]">
                      Submitted {submittedAt ? submittedAt.toLocaleString("en-LR") : "not submitted"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => reviewSubmission(submission.assignmentId)}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--ll-yellow-soft)] px-4 text-sm font-semibold text-[var(--ll-text-faint)]"
                  >
                    Review
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Learning Trends */}
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
        <h2 className="text-sm font-semibold text-[var(--ll-text)] mb-3">Learning Trends</h2>
        {trends ? (
          <div className="space-y-4">
            {/* Activity stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-center">
                <p className="text-lg font-semibold text-[var(--ll-text)]">{trends.lessonsThisWeek}</p>
                <p className="text-xs text-[var(--ll-text-faint)]">Lessons this week</p>
              </div>
              <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-center">
                <p className="text-lg font-semibold text-[var(--ll-text)]">{trends.lessonsThisMonth}</p>
                <p className="text-xs text-[var(--ll-text-faint)]">Lessons this month</p>
              </div>
              <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 text-center">
                <p className="text-lg font-semibold text-[var(--ll-text)]">
                  {trends.lastActiveDaysAgo == null ? "—" : trends.lastActiveDaysAgo === 0 ? "Today" : `${trends.lastActiveDaysAgo}d ago`}
                </p>
                <p className="text-xs text-[var(--ll-text-faint)]">Last active</p>
              </div>
            </div>

            {/* Quiz score trend */}
            {trends.recentScores.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-medium text-[var(--ll-text)]">Recent quiz scores</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    trends.scoreTrend === "improving" ? "bg-emerald-500/20 text-emerald-400" :
                    trends.scoreTrend === "declining" ? "bg-red-500/20 text-red-400" :
                    "bg-[var(--ll-surface)] text-[var(--ll-text-muted)]"
                  }`}>
                    {trends.scoreTrend === "improving" ? "↑ Improving" : trends.scoreTrend === "declining" ? "↓ Declining" : "→ Stable"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {trends.recentScores.map((score, i) => (
                    <span
                      key={i}
                      className={`rounded-full px-2.5 py-0.5 font-medium ${
                        score >= 80 ? "bg-emerald-500/20 text-emerald-400" :
                        score >= 60 ? "bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]" :
                        "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {score}%
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Subject averages */}
            {trends.subjectAvg.length > 0 && (
              <div>
                <p className="text-xs font-medium text-[var(--ll-text)] mb-2">Subject averages</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {trends.subjectAvg.map(({ subject, avg }) => (
                    <span key={subject} className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-1 text-[var(--ll-text-muted)]">
                      {subject}: <span className="font-semibold text-[var(--ll-text)]">{avg}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-[var(--ll-text-faint)]">No quiz data available yet.</p>
        )}
      </section>

      {/* Subject breakdown */}
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
        <h2 className="text-sm font-semibold text-[var(--ll-text)] mb-3">Progress by Subject</h2>
        <div className="space-y-3">
          {Object.entries(bySubject).map(([subject, data]) => {
            const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            return (
              <div key={subject}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[var(--ll-text)]">{subject}</span>
                  <span className="text-[var(--ll-text-muted)]">
                    {data.completed}/{data.total} ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[var(--ll-surface)]">
                  <div
                    className="h-2 rounded-full bg-[var(--ll-yellow)]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* All assigned work */}
      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
        <h2 className="text-sm font-semibold text-[var(--ll-text)] mb-3">All Assigned Work</h2>
        {records.length === 0 ? (
          <p className="text-xs text-[var(--ll-text-faint)]">No work assigned yet.</p>
        ) : (
          <div className="space-y-2">
            {records.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/50 px-4 py-2"
              >
                <div>
                  <p className="text-sm text-[var(--ll-text)]">{r.title}</p>
                  <p className="text-xs text-[var(--ll-text-faint)]">
                    {r.subject} &middot; {new Date(r.scheduledDate).toLocaleDateString()}
                    {r.quizScore !== null && (
                      <span className="ml-2 font-medium text-[var(--ll-yellow)]">
                        Quiz: {r.quizScore}%
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.completedAt ? (
                    <>
                      <Link
                        href={`/teacher/lesson/${r.contentId}?studentId=${studentId}`}
                        className="rounded-full border border-[var(--ll-border)] px-2.5 py-0.5 text-[10px] font-medium text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] hover:border-[var(--ll-yellow)]/40"
                      >
                        Review
                      </Link>
                      <span className="rounded-full bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)] px-2.5 py-0.5 text-[10px]">
                        Completed
                      </span>
                    </>
                  ) : r.startedAt ? (
                    <span className="rounded-full bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)] px-2.5 py-0.5 text-[10px]">
                      In Progress
                    </span>
                  ) : (
                    <span className="rounded-full bg-[var(--ll-surface-muted)] text-[var(--ll-text)] px-2.5 py-0.5 text-[10px]">
                      Not Started
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
    </div>
  );
}
