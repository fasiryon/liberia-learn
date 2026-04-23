"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type SubjectProgressSummary = {
  subject: string;
  label: string;
  completedLessons: number;
  totalLessons: number;
  completionPercent: number;
  latestDerivedScore: number | null;
  latestMasteryState: string | null;
};

type ProgressActivity = {
  id: string;
  type: "lesson_completed" | "quiz_submitted" | "certificate_awarded";
  title: string;
  subject: string;
  occurredAt: string;
  scorePercent?: number | null;
};

type ConceptMastery = {
  conceptKey: string;
  label: string;
  masteryPercent: number;
  confidenceTier: "low" | "medium" | "high";
  evidenceCount: number;
};

type SubjectMastery = {
  subject: string;
  label: string;
  masteryPercent: number;
  confidenceTier: "low" | "medium" | "high";
  evidenceCount: number;
  completedLessons: number;
  totalLessons: number;
  latestQuizScorePercent: number | null;
  weakConcepts: ConceptMastery[];
};

type WeaknessSignal = {
  type:
    | "repeated_low_performance"
    | "incomplete_learning_loop"
    | "concept_weakness"
    | "overdue_review";
  subject: string;
  label: string;
  severity: "low" | "medium" | "high";
  reason: string;
  evidenceCount: number;
  href: string | null;
};

type RecommendedNextAction = {
  type:
    | "continue_current_lesson"
    | "review_weak_lesson"
    | "retry_quiz"
    | "recommended_next_lesson";
  label: string;
  reason: string;
  href: string;
  priority: number;
};

type StudentLearningIntelligence = {
  generatedAt: string;
  masteryBySubject: SubjectMastery[];
  weaknesses: WeaknessSignal[];
  recommendedNextActions: RecommendedNextAction[];
};

type StudentProgressSummary = {
  totalLessonsCompleted: number;
  totalLessonsAssigned: number;
  averageQuizScorePercent: number;
  currentStreakDays: number;
  overallCurriculumCompletionPercent: number;
  subjectProgress: SubjectProgressSummary[];
  recentActivity: ProgressActivity[];
  learningIntelligence: StudentLearningIntelligence;
};

const EMPTY_SUMMARY: StudentProgressSummary = {
  totalLessonsCompleted: 0,
  totalLessonsAssigned: 0,
  averageQuizScorePercent: 0,
  currentStreakDays: 0,
  overallCurriculumCompletionPercent: 0,
  subjectProgress: [],
  recentActivity: [],
  learningIntelligence: {
    generatedAt: "",
    masteryBySubject: [],
    weaknesses: [],
    recommendedNextActions: [],
  },
};

function activityLabel(type: ProgressActivity["type"]) {
  switch (type) {
    case "lesson_completed":
      return "Lesson";
    case "quiz_submitted":
      return "Quiz";
    case "certificate_awarded":
      return "Certificate";
    default:
      return "Activity";
  }
}

export default function StudentProgressDashboard() {
  const [summary, setSummary] = useState<StudentProgressSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/progress", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load progress.");
        }

        setSummary({
          ...EMPTY_SUMMARY,
          ...data,
          subjectProgress: Array.isArray(data?.subjectProgress) ? data.subjectProgress : [],
          recentActivity: Array.isArray(data?.recentActivity) ? data.recentActivity : [],
          learningIntelligence: {
            ...EMPTY_SUMMARY.learningIntelligence,
            ...(data?.learningIntelligence ?? {}),
            masteryBySubject: Array.isArray(data?.learningIntelligence?.masteryBySubject)
              ? data.learningIntelligence.masteryBySubject
              : [],
            weaknesses: Array.isArray(data?.learningIntelligence?.weaknesses)
              ? data.learningIntelligence.weaknesses
              : [],
            recommendedNextActions: Array.isArray(
              data?.learningIntelligence?.recommendedNextActions
            )
              ? data.learningIntelligence.recommendedNextActions
              : [],
          },
        });
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              &larr; Back to Dashboard
            </Link>
            <h1 className="text-3xl font-semibold text-[var(--ll-text)]">My Progress</h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
              Track lesson completion, quiz performance, streaks, and subject mastery.
            </p>
          </div>
          <Link
            href="/student/certificates"
            className="inline-flex min-h-12 items-center justify-center rounded-full border border-emerald-400/30 bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-yellow)] transition-colors hover:bg-[var(--ll-yellow-soft)]"
          >
            View Certificates
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70"
              />
            ))}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">
                  Lessons Completed
                </p>
                <p className="mt-3 text-3xl font-semibold text-[var(--ll-text)]">
                  {summary.totalLessonsCompleted}
                </p>
                <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                  of {summary.totalLessonsAssigned} assigned lessons
                </p>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">
                  Average Quiz Score
                </p>
                <p className="mt-3 text-3xl font-semibold text-[var(--ll-silver)]">
                  {summary.averageQuizScorePercent}%
                </p>
                <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                  Based on lesson quiz attempts
                </p>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">
                  Current Streak
                </p>
                <p className="mt-3 text-3xl font-semibold text-[var(--ll-yellow)]">
                  {summary.currentStreakDays}
                </p>
                <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                  Consecutive active days
                </p>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">
                  Curriculum Completion
                </p>
                <p className="mt-3 text-3xl font-semibold text-[var(--ll-yellow)]">
                  {summary.overallCurriculumCompletionPercent}%
                </p>
                <div className="mt-4 h-2 rounded-full bg-[var(--ll-surface)]">
                  <div
                    className="h-2 rounded-full bg-[var(--ll-yellow-soft)]"
                    style={{ width: `${summary.overallCurriculumCompletionPercent}%` }}
                  />
                </div>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-[var(--ll-text)]">
                  Recommended Next Actions
                </h2>
                <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                  Determined from scheduled lessons, quiz results, and active support signals.
                </p>
                <div className="mt-5 space-y-3">
                  {summary.learningIntelligence.recommendedNextActions.length === 0 ? (
                    <p className="text-sm text-[var(--ll-text-muted)]">
                      No recommendations yet. Open Today to start your next assigned lesson.
                    </p>
                  ) : (
                    summary.learningIntelligence.recommendedNextActions.map((action) => (
                      <Link
                        key={`${action.type}-${action.href}`}
                        href={action.href}
                        className="block rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 transition-colors hover:border-[var(--ll-yellow)]/50"
                      >
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ll-yellow)]">
                          {action.type.replace(/_/g, " ")}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
                          {action.label}
                        </p>
                        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                          {action.reason}
                        </p>
                      </Link>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-[var(--ll-text)]">
                  Learning Intelligence
                </h2>
                <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                  Subject mastery, confidence level, and weak areas from real activity.
                </p>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {summary.learningIntelligence.masteryBySubject.length === 0 ? (
                    <p className="text-sm text-[var(--ll-text-muted)]">
                      Mastery signals will appear after lessons or quizzes are completed.
                    </p>
                  ) : (
                    summary.learningIntelligence.masteryBySubject.map((subject) => (
                      <article
                        key={subject.subject}
                        className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-[var(--ll-text)]">
                              {subject.label}
                            </h3>
                            <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                              Confidence {subject.confidenceTier} &middot; {subject.evidenceCount} signal
                              {subject.evidenceCount === 1 ? "" : "s"}
                            </p>
                          </div>
                          <p className="text-lg font-semibold text-[var(--ll-yellow)]">
                            {subject.masteryPercent}%
                          </p>
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-[var(--ll-surface)]">
                          <div
                            className="h-2 rounded-full bg-[var(--ll-yellow-soft)]"
                            style={{ width: `${subject.masteryPercent}%` }}
                          />
                        </div>
                        {subject.weakConcepts.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {subject.weakConcepts.map((concept) => (
                              <span
                                key={concept.conceptKey}
                                className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-xs text-red-200"
                              >
                                {concept.label}: {concept.masteryPercent}%
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-[var(--ll-text)]">Weakness Signals</h2>
              <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                Patterns that may need review before moving too far ahead.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {summary.learningIntelligence.weaknesses.length === 0 ? (
                  <p className="text-sm text-[var(--ll-text-muted)]">
                    No repeated weak signals are active right now.
                  </p>
                ) : (
                  summary.learningIntelligence.weaknesses.map((weakness) => {
                    const content = (
                      <article className="h-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--ll-text-faint)]">
                          {weakness.severity} &middot; {weakness.type.replace(/_/g, " ")}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-[var(--ll-text)]">
                          {weakness.label}
                        </p>
                        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                          {weakness.reason}
                        </p>
                      </article>
                    );

                    return weakness.href ? (
                      <Link
                        key={`${weakness.type}-${weakness.label}-${weakness.href}`}
                        href={weakness.href}
                        className="block transition-colors hover:border-[var(--ll-yellow)]/50"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div key={`${weakness.type}-${weakness.label}`}>{content}</div>
                    );
                  })
                )}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-[var(--ll-text)]">Subject Progress</h2>
                    <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                      Lesson completion and latest derived mastery signal by subject.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {summary.subjectProgress.length === 0 ? (
                    <p className="text-sm text-[var(--ll-text-muted)]">No lesson progress yet.</p>
                  ) : (
                    summary.subjectProgress.map((subject) => (
                      <article
                        key={subject.subject}
                        className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4"
                      >
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-[var(--ll-text)]">
                              {subject.label}
                            </h3>
                            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                              {subject.completedLessons} of {subject.totalLessons} lessons completed
                            </p>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="text-sm font-semibold text-[var(--ll-yellow)]">
                              {subject.completionPercent}%
                            </p>
                            <p className="text-xs text-[var(--ll-text-faint)]">
                              {subject.latestMasteryState
                                ? `Mastery: ${subject.latestMasteryState.replace(/_/g, " ")}`
                                : "Mastery pending"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 h-3 rounded-full bg-[var(--ll-surface)]">
                          <div
                            className="h-3 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                            style={{ width: `${subject.completionPercent}%` }}
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--ll-text-muted)]">
                          <span>Completion: {subject.completionPercent}%</span>
                          <span>
                            Derived score:{" "}
                            {subject.latestDerivedScore != null
                              ? `${subject.latestDerivedScore}%`
                              : "Not available"}
                          </span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-6">
                <h2 className="text-lg font-semibold text-[var(--ll-text)]">Recent Activity</h2>
                <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                  Your latest 10 lesson, quiz, and certificate actions.
                </p>

                <div className="mt-5 space-y-3">
                  {summary.recentActivity.length === 0 ? (
                    <p className="text-sm text-[var(--ll-text-muted)]">No recent activity yet.</p>
                  ) : (
                    summary.recentActivity.map((activity) => (
                      <article
                        key={activity.id}
                        className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-[var(--ll-text-faint)]">
                              {activityLabel(activity.type)}
                            </p>
                            <p className="mt-1 text-sm font-medium text-[var(--ll-text)]">
                              {activity.title}
                            </p>
                            <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                              {activity.subject.replace(/_/g, " ")}
                              {activity.scorePercent != null
                                ? ` - Score ${activity.scorePercent}%`
                                : ""}
                            </p>
                          </div>
                          <p className="text-xs text-[var(--ll-text-faint)]">
                            {new Date(activity.occurredAt).toLocaleString()}
                          </p>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
