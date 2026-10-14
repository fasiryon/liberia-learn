"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MasteryBadge } from "@/components/adaptive/MasteryBadge";
import { InteractiveButton } from "@/components/ui/InteractiveButton";
import { Chip, Meter, PageFrame, PageHeader, Panel } from "@/components/experience/Frame";
import { StateNotice } from "@/components/experience/StateNotice";

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
  badges: Array<{
    id: string;
    label: string;
    earned: boolean;
    earnedAt: string | null;
    criteria: string;
    evidence: string[];
  }>;
  examReadiness: {
    readinessScore: number | null;
    weakSubjects: string[];
    strongSubjects: string[];
    nextBestAction: { label: string; href: string; reason: string } | null;
  } | null;
};

const EMPTY_SUMMARY: StudentProgressSummary = {
  totalLessonsCompleted: 0,
  totalLessonsAssigned: 0,
  averageQuizScorePercent: 0,
  currentStreakDays: 0,
  overallCurriculumCompletionPercent: 0,
  subjectProgress: [],
  recentActivity: [],
  badges: [],
  examReadiness: null,
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

type AdaptiveMasteryRow = {
  skillKey: string;
  score: number;
  consecutiveCorrect: number;
  masteredAt: string | null;
};

export default function StudentProgressDashboard() {
  const [summary, setSummary] = useState<StudentProgressSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adaptiveMastery, setAdaptiveMastery] = useState<AdaptiveMasteryRow[]>([]);
  // A failed read is "unknown", never an empty or zero mastery record.
  const [adaptiveState, setAdaptiveState] = useState<"loading" | "ready" | "error">("loading");

  // NR-14B: Load adaptive mastery records
  useEffect(() => {
    fetch("/api/adaptive/mastery", { cache: "no-store" })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (!r.ok || !Array.isArray(data?.records)) throw new Error("unavailable");
        setAdaptiveMastery(data.records);
        setAdaptiveState("ready");
      })
      .catch(() => setAdaptiveState("error"));
  }, []);

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
          badges: Array.isArray(data?.badges) ? data.badges : [],
          examReadiness: data?.examReadiness ?? null,
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

  const intelligence = summary.learningIntelligence;
  const nextActions = intelligence.recommendedNextActions.slice().sort((a, b) => a.priority - b.priority);
  const primaryNext = nextActions[0] ?? null;
  const earnedBadges = summary.badges.filter((badge) => badge.earned);
  const records: Array<[string, string, string]> = [
    ["Report cards", "/student/report-cards", "Term results from your school"],
    ["Transcript", "/student/transcript", "Your official course record"],
    ["Certificates", "/student/certificates", "Certificates you have earned"],
    ["Certifications", "/student/certifications", "Skill certifications"],
    ["Portfolio", "/student/portfolio", "Work you chose to keep"],
    ["Passport", "/student/passport", "Your learning passport"],
    ["Leaderboard", "/student/leaderboard", "Class standings, if your school uses them"],
  ];

  return (
    <PageFrame labelledBy="progress-heading">
      <PageHeader eyebrow="Progress" title="Your progress" titleId="progress-heading"
        lede="Skill learning, schoolwork and official records are kept apart, so each one means exactly what it says." />

      {loading ? <StateNotice kind="loading" title="Loading your progress…">Checking your learning evidence and schoolwork.</StateNotice> : null}

      {error ? (
        <StateNotice kind="error" title="Your progress could not load" action={<button type="button" className="pdv2-action" onClick={() => window.location.reload()}>Try again</button>}>
          {error} This does not mean you have no progress. Your records below are still available.
        </StateNotice>
      ) : null}

      {!loading && !error ? (
        <div className="ll3-stack">
          <Panel eyebrow="Next step" title={primaryNext ? primaryNext.label : "No suggestion right now"} titleId="progress-next"
            note={primaryNext ? primaryNext.reason : "No next step was suggested from your recent work. Today shows your assigned lessons and work."}
            actions={primaryNext ? <InteractiveButton primary href={primaryNext.href}>Open →</InteractiveButton> : <InteractiveButton href="/student/today">Go to Today →</InteractiveButton>}>
            {nextActions.length > 1 && <ul className="ll3-rows">{nextActions.slice(1, 4).map((action) => <li key={`${action.type}-${action.href}`}>
              <div><p className="font-semibold">{action.label}</p><p className="ll3-muted ll3-small">{action.reason}</p></div>
              <InteractiveButton href={action.href} aria-label={`Open: ${action.label}`}>Open →</InteractiveButton>
            </li>)}</ul>}
          </Panel>

          <div className="ll3-split">
            <Panel eyebrow="Skill learning" title="What your work shows you can do" titleId="progress-skills"
              note="Built from answers and checks you completed. Confidence grows as there is more evidence.">
              {intelligence.masteryBySubject.length === 0
                ? <StateNotice kind="empty" title="No skill evidence yet" compact>Skill evidence appears after you finish lessons, practice or checks.</StateNotice>
                : <div className="ll3-cards">{intelligence.masteryBySubject.map((subject) => (
                  <article key={subject.subject} className="ll3-card" aria-labelledby={`skill-${subject.subject}`}>
                    <div className="flex items-start justify-between gap-3">
                      <h3 id={`skill-${subject.subject}`} className="ll3-card-title">{subject.label}</h3>
                      <p className="text-xl font-bold">{subject.masteryPercent}%</p>
                    </div>
                    <Meter value={subject.masteryPercent} max={100} label={`${subject.label}: ${subject.masteryPercent}% skill evidence`} />
                    <p className="ll3-muted ll3-small">Confidence {subject.confidenceTier} · based on {subject.evidenceCount} piece{subject.evidenceCount === 1 ? "" : "s"} of evidence</p>
                    {subject.weakConcepts.length > 0 && <div><p className="ll3-small font-semibold">Needs more practice</p><ul className="mt-1 flex flex-wrap gap-2">{subject.weakConcepts.map((concept) => <li key={concept.conceptKey}><Chip tone="accent">{concept.label}: {concept.masteryPercent}%</Chip></li>)}</ul></div>}
                  </article>
                ))}</div>}
              <h3 className="pdv2-subhead">Lesson-unit practice</h3>
              {adaptiveState === "loading" ? <p role="status" className="ll3-muted">Loading practice results…</p>
                : adaptiveState === "error" ? <StateNotice kind="unknown" compact title="Practice results unknown">They could not load just now. This is not a score of zero.</StateNotice>
                : adaptiveMastery.length === 0 ? <p className="ll3-muted">No practice results yet.</p>
                : <ul className="flex flex-wrap gap-3">{adaptiveMastery.slice(0, 12).map((row) => {
                  // skillKey format: SUBJECT:GN:unitId — show subject and grade only
                  const parts = row.skillKey.split(":");
                  const readableLabel = `${(parts[0] ?? "").replace(/_/g, " ")} G${parts[1]?.replace("G", "") ?? ""}`;
                  return <li key={row.skillKey} className="flex items-center gap-2 rounded-xl border border-[#41453c] px-3 py-2" title={row.skillKey}>
                    <MasteryBadge score={row.score} mastered={row.masteredAt !== null} masteredAt={row.masteredAt} size="sm" />
                    <span className="text-sm">{readableLabel}</span>
                  </li>;
                })}</ul>}
              {intelligence.weaknesses.length > 0 && <>
                <h3 className="pdv2-subhead">Worth reviewing</h3>
                <ul className="ll3-rows">{intelligence.weaknesses.map((weakness) => <li key={`${weakness.type}-${weakness.label}`}>
                  <div><p className="font-semibold">{weakness.label}</p><p className="ll3-muted ll3-small">{weakness.reason}</p></div>
                  {weakness.href ? <InteractiveButton href={weakness.href} aria-label={`Review: ${weakness.label}`}>Review →</InteractiveButton> : null}
                </li>)}</ul>
              </>}
            </Panel>

            <div className="ll3-stack">
              <Panel eyebrow="Schoolwork" title="Lessons and quizzes" titleId="progress-coursework"
                note="Finishing work is not the same as mastering it. These numbers count what you completed.">
                <dl className="grid grid-cols-2 gap-3">
                  <div className="ll3-card"><dt className="ll3-muted ll3-small">Assigned lessons finished</dt><dd className="text-2xl font-bold">{summary.totalLessonsCompleted} <span className="text-base font-normal ll3-muted">of {summary.totalLessonsAssigned}</span></dd></div>
                  <div className="ll3-card"><dt className="ll3-muted ll3-small">Lesson quiz average</dt><dd className="text-2xl font-bold">{summary.recentActivity.some((activity) => activity.type === "quiz_submitted") || summary.averageQuizScorePercent > 0 ? `${summary.averageQuizScorePercent}%` : "No quizzes yet"}</dd></div>
                  <div className="ll3-card"><dt className="ll3-muted ll3-small">Days active in a row</dt><dd className="text-2xl font-bold">{summary.currentStreakDays}</dd></div>
                  <div className="ll3-card"><dt className="ll3-muted ll3-small">Exam readiness</dt><dd className="text-2xl font-bold">{summary.examReadiness?.readinessScore != null ? `${Math.round(summary.examReadiness.readinessScore)}%` : "Not enough data"}</dd></div>
                </dl>
                {summary.subjectProgress.length > 0 && <ul className="ll3-rows mt-3">{summary.subjectProgress.map((subject) => <li key={subject.subject}>
                  <div>
                    <p className="font-semibold">{subject.label}</p>
                    <p className="ll3-muted ll3-small">{subject.completedLessons} of {subject.totalLessons} lessons finished</p>
                    <div className="mt-2 max-w-xs"><Meter value={subject.completedLessons} max={subject.totalLessons} label={`${subject.label}: ${subject.completedLessons} of ${subject.totalLessons} lessons finished`} /></div>
                  </div>
                </li>)}</ul>}
                {summary.examReadiness?.nextBestAction && <div className="mt-3"><InteractiveButton href={summary.examReadiness.nextBestAction.href}>{summary.examReadiness.nextBestAction.label} →</InteractiveButton></div>}
              </Panel>

              <Panel eyebrow="Recent" title="Recent activity" titleId="progress-recent">
                {summary.recentActivity.length === 0 ? <p className="ll3-muted">No recent activity yet.</p>
                  : <ul className="ll3-rows">{summary.recentActivity.map((activity) => <li key={activity.id}>
                    <div>
                      <p className="ll3-muted ll3-small">{activityLabel(activity.type)} · {activity.subject.replace(/_/g, " ")}</p>
                      <p className="font-semibold">{activity.title}{activity.scorePercent != null ? ` · ${activity.scorePercent}%` : ""}</p>
                    </div>
                    <p className="ll3-muted ll3-small">{new Date(activity.occurredAt).toLocaleDateString("en-LR", { day: "numeric", month: "short" })}</p>
                  </li>)}</ul>}
                {earnedBadges.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{earnedBadges.map((badge) => <span key={badge.id} title={badge.criteria}><Chip tone="success">{badge.label}</Chip></span>)}</div>}
              </Panel>
            </div>
          </div>
        </div>
      ) : null}

      <section className="ll3-panel mt-5" aria-labelledby="progress-records">
        <p className="ll3-eyebrow">Official records</p>
        <h2 id="progress-records" className="ll3-panel-title">Your records</h2>
        <p className="ll3-panel-note">Records come from your school and are separate from practice and skill evidence.</p>
        <ul className="ll3-cards">{records.map(([label, href, description]) => <li key={href}>
          <Link href={href} className="ll3-card min-h-[var(--pdv2-target)] hover:border-[var(--ll-accent)]"><span className="ll3-card-title">{label} →</span><span className="ll3-muted ll3-small">{description}</span></Link>
        </li>)}</ul>
      </section>
    </PageFrame>
  );
}
