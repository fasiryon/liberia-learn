"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { renderSimpleMarkdown } from "@/lib/lessons";
import { parseToSlides } from "@/lib/lessons/parseToSlides";
import { LessonFullscreenButton } from "@/components/lesson/LessonFullscreenButton";
import { TeacherVideoUpload } from "@/components/teacher/TeacherVideoUpload";
import type { StudentSubmissionContext } from "./page";

type CurriculumResponse = {
  metadata: {
    contentId: string;
    grade: number;
    subject: string;
    audioStatus?: string;
  };
  payload: {
    title?: string;
    body?: string;
    body_standard?: string;
    body_block?: string;
    objectives?: string[];
  };
  videos?: Array<{
    id: string;
    title: string;
    description: string | null;
    storageUrl: string;
    durationSeconds: number;
    fileSize: number;
    isActive: boolean;
  }>;
};

type LessonPlan = {
  learningObjectives: string[];
  warmUpActivity: string;
  teachingSequence: Array<{
    segment: string;
    minutes: number;
    teacherMoves: string;
    studentExperience: string;
  }>;
  assessmentCheck: string;
  homeworkSuggestion: string;
  hadFallback: boolean;
};

const TIME_OPTIONS = [30, 45, 60, 90] as const;
type LessonViewMode = "read" | "slides";

function nextWeekdayISO(dayOffset = 7) {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = ((8 - day) % 7) || dayOffset;
  const target = new Date(now);
  target.setDate(now.getDate() + mondayOffset);
  return target.toISOString().slice(0, 10);
}

function weekStartISO(dateIso: string) {
  const date = new Date(dateIso);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export default function TeacherLessonViewClient({
  contentId,
  studentContext,
}: {
  contentId: string;
  studentContext?: StudentSubmissionContext | null;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<CurriculumResponse | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [classSize, setClassSize] = useState("35");
  const [timeAvailableMinutes, setTimeAvailableMinutes] = useState<(typeof TIME_OPTIONS)[number]>(45);
  const [plannedDate, setPlannedDate] = useState(nextWeekdayISO);
  const [specialConsiderations, setSpecialConsiderations] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planSaveMessage, setPlanSaveMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<LessonViewMode>("read");
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const slideFullscreenRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadLesson() {
      try {
        const response = await fetch(`/api/curriculum/${contentId}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load lesson.");
        }
        if (!cancelled) {
          setLesson(data);
          setError(null);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          setError(loadError?.message ?? "Failed to load lesson.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadLesson();
    return () => {
      cancelled = true;
    };
  }, [contentId]);

  const lessonTitle = lesson?.payload?.title ?? contentId;
  const lessonBody =
    lesson?.payload?.body_standard ??
    lesson?.payload?.body_block ??
    lesson?.payload?.body ??
    "";
  const objectives = Array.isArray(lesson?.payload?.objectives)
    ? lesson.payload.objectives
    : [];

  const renderedBody = useMemo(
    () => renderSimpleMarkdown(lessonBody),
    [lessonBody]
  );
  const slides = useMemo(() => {
    return parseToSlides({
      title: lessonTitle,
      content: lessonBody,
    });
  }, [lessonBody, lessonTitle]);
  const currentSlide = slides[Math.min(currentSlideIndex, Math.max(0, slides.length - 1))] ?? null;

  useEffect(() => {
    if (currentSlideIndex > Math.max(0, slides.length - 1)) {
      setCurrentSlideIndex(Math.max(0, slides.length - 1));
    }
  }, [currentSlideIndex, slides.length]);

  const assignmentHref = useMemo(() => {
    const params = new URLSearchParams({
      contentId,
      title: `${lessonTitle} Assignment`,
      description: `Complete the follow-up work for ${lessonTitle}.`,
      generationMethod: "manual",
    });
    return `/teacher/assignments/new?${params.toString()}`;
  }, [contentId, lessonTitle]);

  async function handleGeneratePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!lesson) {
      return;
    }

    setPlanning(true);
    setPlanError(null);

    try {
      const response = await fetch("/api/teacher/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonTitle,
          lessonContent: lessonBody,
          subject: lesson.metadata.subject,
          gradeLevel: lesson.metadata.grade,
          classSize: Number(classSize),
          timeAvailableMinutes,
          specialConsiderations: specialConsiderations.trim() || undefined,
          contentId: lesson.metadata.contentId,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to create lesson plan.");
      }
      setPlan(data);
      setPlanSaveMessage(null);
    } catch (plannerError: any) {
      setPlanError(plannerError?.message ?? "Failed to create lesson plan.");
    } finally {
      setPlanning(false);
    }
  }

  function updatePlanField(field: "warmUpActivity" | "assessmentCheck" | "homeworkSuggestion", value: string) {
    setPlan((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateObjective(index: number, value: string) {
    setPlan((current) => {
      if (!current) return current;
      const learningObjectives = [...current.learningObjectives];
      learningObjectives[index] = value;
      return { ...current, learningObjectives };
    });
  }

  function updatePlanStep(
    index: number,
    field: "segment" | "minutes" | "teacherMoves" | "studentExperience",
    value: string
  ) {
    setPlan((current) => {
      if (!current) return current;
      const teachingSequence = [...current.teachingSequence];
      const step = teachingSequence[index];
      if (!step) return current;
      teachingSequence[index] = {
        ...step,
        [field]: field === "minutes" ? Math.max(1, Number(value) || 1) : value,
      };
      return { ...current, teachingSequence };
    });
  }

  async function handleSavePlan() {
    if (!lesson || !plan) return;
    setSavingPlan(true);
    setPlanSaveMessage(null);
    try {
      const response = await fetch("/api/teacher/lesson-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          contentId: lesson.metadata.contentId,
          lessonTitle,
          subject: lesson.metadata.subject,
          gradeLevel: lesson.metadata.grade,
          plannedDate,
          weekStart: weekStartISO(plannedDate),
          plan,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to save lesson plan.");
      }
      setPlanSaveMessage("Saved");
    } catch (error: any) {
      setPlanSaveMessage(error?.message ?? "Failed to save lesson plan.");
    } finally {
      setSavingPlan(false);
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-[var(--ll-bg)]/60" />;
  }

  if (error || !lesson) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
        {error ?? "Lesson not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/teacher/curriculum"
          className="text-sm text-[var(--ll-yellow)] transition-colors hover:text-[var(--ll-yellow)]"
        >
          &larr; Back to curriculum
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={assignmentHref}
            className="min-h-12 rounded-full border border-emerald-400/30 bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-yellow)] transition-colors hover:border-emerald-300/50 hover:bg-[var(--ll-yellow-soft)]"
          >
            Assign to Class
          </Link>
          <button
            type="button"
            onClick={() => setPlannerOpen(true)}
            className="min-h-12 rounded-full bg-[var(--ll-silver-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] transition-colors hover:bg-[var(--ll-silver-soft)]"
          >
            Plan This Lesson
          </button>
        </div>
      </div>

      {studentContext ? (
        <section className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Reviewing for student</p>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-[var(--ll-text)]">
            <span className="font-semibold">{studentContext.studentName}</span>
            {studentContext.score !== null ? (
              <span>
                Quiz score:{" "}
                <span className={studentContext.score >= 0.7 ? "font-semibold text-emerald-400" : "font-semibold text-[var(--ll-yellow)]"}>
                  {Math.round(studentContext.score * 100)}%
                </span>
              </span>
            ) : (
              <span className="text-[var(--ll-text-muted)]">No quiz submission</span>
            )}
            {studentContext.submittedAt ? (
              <span className="text-[var(--ll-text-muted)]">
                Submitted {new Date(studentContext.submittedAt).toLocaleDateString()}
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ll-text)]">
          <span className="rounded-full bg-[var(--ll-yellow)]/15 px-3 py-1 font-semibold text-[var(--ll-yellow)]">
            {lesson.metadata.subject}
          </span>
          <span>Grade {lesson.metadata.grade}</span>
          <span>{lesson.metadata.contentId}</span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-[var(--ll-text)]">{lessonTitle}</h1>
      </section>

      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-2">
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {(["read", "slides"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setViewMode(entry)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                viewMode === entry
                  ? "bg-[var(--ll-yellow)] text-[var(--ll-text-faint)]"
                  : "bg-[var(--ll-surface)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              }`}
              aria-pressed={viewMode === entry}
            >
              {entry === "read" ? "Read" : "Slides"}
            </button>
          ))}
        </div>
      </div>

      {objectives.length > 0 ? (
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">Learning Objectives</h2>
          <ul className="mt-4 space-y-3 text-base text-[var(--ll-text)]">
            {objectives.map((objective, index) => (
              <li
                key={`${objective}-${index}`}
                className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-3"
              >
                {objective}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {viewMode === "read" ? (
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
          <div
            className="prose prose-invert max-w-[720px] prose-headings:text-[var(--ll-text)] prose-p:text-[var(--ll-text)] prose-p:text-[1rem] prose-p:leading-8 prose-li:text-[var(--ll-text)] prose-li:text-[1rem] prose-li:leading-8"
            dangerouslySetInnerHTML={{ __html: renderedBody }}
          />
        </section>
      ) : (
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
          {currentSlide ? (
            <div ref={slideFullscreenRef} className="ll-slide-fullscreen space-y-5 rounded-xl bg-[var(--ll-bg)]">
              <div className="h-2 overflow-hidden rounded-full bg-[var(--ll-surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--ll-yellow)] transition-all"
                  style={{ width: `${((currentSlideIndex + 1) / Math.max(1, slides.length)) * 100}%` }}
                />
              </div>
              <article className="ll-slide-fullscreen-card min-h-[24rem] rounded-xl border border-[var(--ll-border-strong)] bg-[var(--ll-surface)] p-5 transition-colors sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--ll-text-muted)]">
                    Section {currentSlideIndex + 1} of {slides.length}
                  </p>
                  <LessonFullscreenButton targetRef={slideFullscreenRef} />
                </div>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--ll-text)]">{currentSlide.title}</h2>
                <div
                  className="prose prose-invert mt-5 max-w-none overflow-y-auto prose-headings:text-[var(--ll-text)] prose-p:text-[var(--ll-text)] prose-p:text-[1rem] prose-p:leading-8 prose-li:text-[var(--ll-text)] prose-li:text-[1rem] prose-li:leading-8"
                  style={{ maxHeight: "55vh" }}
                  dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(currentSlide.content) }}
                />
              </article>
              <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
                <button
                  type="button"
                  disabled={currentSlideIndex === 0}
                  onClick={() => setCurrentSlideIndex((value) => Math.max(0, value - 1))}
                  className="ll-touch-target rounded-xl border border-[var(--ll-border)] px-4 py-3 text-sm text-[var(--ll-text)] disabled:opacity-40"
                >
                  Previous slide
                </button>
                <button
                  type="button"
                  disabled={currentSlideIndex >= slides.length - 1}
                  onClick={() => setCurrentSlideIndex((value) => Math.min(slides.length - 1, value + 1))}
                  className="ll-touch-target rounded-xl bg-[var(--ll-silver-soft)] px-4 py-3 text-sm font-semibold text-[var(--ll-text-faint)] disabled:opacity-40"
                >
                  Next slide
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--ll-text-muted)]">Slides are not available for this lesson yet.</p>
          )}
        </section>
      )}

      <TeacherVideoUpload contentId={contentId} initialVideos={lesson.videos ?? []} />

      {plannerOpen ? (
        <div className="fixed inset-0 z-50 bg-[var(--ll-bg)]/70 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close lesson planner"
            className="absolute inset-0"
            onClick={() => setPlannerOpen(false)}
          />
          <section className="absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col overflow-hidden rounded-t-[2rem] border border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text)] shadow-none shadow-black/50 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-[34rem] sm:rounded-none sm:rounded-l-[2rem]">
            <div className="border-b border-[var(--ll-border)] px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--ll-silver)]">
                    Teacher Planner
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">Plan This Lesson</h2>
                  <p className="mt-1 text-sm text-[var(--ll-text)]">
                    Build a low-resource classroom plan grounded in this lesson.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPlannerOpen(false)}
                  className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text)] transition-colors hover:border-[var(--ll-border)] hover:text-[var(--ll-text)]"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <form className="space-y-4" onSubmit={handleGeneratePlan}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm text-[var(--ll-text)]">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-text-muted)]">
                      Class Size
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={300}
                      value={classSize}
                      onChange={(event) => setClassSize(event.target.value)}
                      className="min-h-12 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-base text-[var(--ll-text)] outline-none transition-colors focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/60"
                    />
                  </label>

                  <label className="block text-sm text-[var(--ll-text)]">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-text-muted)]">
                      Time Available
                    </span>
                    <select
                      value={timeAvailableMinutes}
                      onChange={(event) =>
                        setTimeAvailableMinutes(Number(event.target.value) as (typeof TIME_OPTIONS)[number])
                      }
                      className="min-h-12 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-base text-[var(--ll-text)] outline-none transition-colors focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/60"
                    >
                      {TIME_OPTIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {minutes} minutes
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block text-sm text-[var(--ll-text)]">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-text-muted)]">
                    Planned Date
                  </span>
                  <input
                    type="date"
                    value={plannedDate}
                    onChange={(event) => setPlannedDate(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-base text-[var(--ll-text)] outline-none transition-colors focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/60"
                  />
                </label>

                <label className="block text-sm text-[var(--ll-text)]">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-text-muted)]">
                    Special Considerations
                  </span>
                  <textarea
                    value={specialConsiderations}
                    onChange={(event) => setSpecialConsiderations(event.target.value)}
                    placeholder="Optional: large class, mixed readiness, limited materials, short transition time..."
                    className="min-h-24 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-base text-[var(--ll-text)] outline-none transition-colors focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/60"
                  />
                </label>

                <button
                  type="submit"
                  disabled={planning || Number(classSize) < 1}
                  className="min-h-12 w-full rounded-full bg-[var(--ll-silver-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-text-faint)] transition-colors hover:bg-[var(--ll-silver-soft)] disabled:cursor-not-allowed disabled:bg-[var(--ll-surface-muted)] disabled:text-[var(--ll-text-muted)]"
                >
                  {planning ? "Planning..." : "Generate Lesson Plan"}
                </button>
              </form>

              {planError ? (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {planError}
                </div>
              ) : null}

              {plan ? (
                <article className="mt-5 rounded-xl border border-cyan-500/20 bg-[var(--ll-bg)]/80 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ll-silver)]">
                        Classroom Plan
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">{lessonTitle}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="rounded-full border border-cyan-400/30 bg-[var(--ll-silver-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-silver)] transition-colors hover:border-cyan-300/50 hover:bg-[var(--ll-silver-soft)]"
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={handleSavePlan}
                      disabled={savingPlan}
                      className="rounded-full bg-[var(--ll-yellow-soft)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] transition-colors disabled:opacity-60"
                    >
                      {savingPlan ? "Saving..." : "Save Plan"}
                    </button>
                  </div>
                  {planSaveMessage ? (
                    <p className={`mt-3 text-sm ${planSaveMessage === "Saved" ? "text-[var(--ll-yellow)]" : "text-red-300"}`}>
                      {planSaveMessage}
                    </p>
                  ) : null}

                  <section className="mt-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ll-text)]">
                      Learning Objectives
                    </h4>
                    <ul className="mt-3 space-y-2 text-sm text-[var(--ll-text)]">
                      {plan.learningObjectives.map((objective, index) => (
                        <li key={`${index}`} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3">
                          <textarea
                            value={objective}
                            onChange={(event) => updateObjective(index, event.target.value)}
                            className="min-h-16 w-full resize-y bg-transparent text-sm leading-6 text-[var(--ll-text)] outline-none"
                          />
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="mt-5 space-y-4 text-sm text-[var(--ll-text)]">
                    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Warm-Up</p>
                      <textarea
                        value={plan.warmUpActivity}
                        onChange={(event) => updatePlanField("warmUpActivity", event.target.value)}
                        className="mt-2 min-h-24 w-full resize-y bg-transparent text-sm leading-6 text-[var(--ll-text)] outline-none"
                      />
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Teaching Sequence</p>
                      {plan.teachingSequence.map((step, index) => (
                        <div key={`${step.segment}-${index}`} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-4">
                          <div className="grid gap-3 sm:grid-cols-[1fr,6rem]">
                            <input
                              value={step.segment}
                              onChange={(event) => updatePlanStep(index, "segment", event.target.value)}
                              className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]"
                            />
                            <input
                              type="number"
                              min={1}
                              max={180}
                              value={step.minutes}
                              onChange={(event) => updatePlanStep(index, "minutes", event.target.value)}
                              className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                            />
                          </div>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Teacher Moves</p>
                          <textarea
                            value={step.teacherMoves}
                            onChange={(event) => updatePlanStep(index, "teacherMoves", event.target.value)}
                            className="mt-1 min-h-24 w-full resize-y rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm leading-6 text-[var(--ll-text)]"
                          />
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Student Experience</p>
                          <textarea
                            value={step.studentExperience}
                            onChange={(event) => updatePlanStep(index, "studentExperience", event.target.value)}
                            className="mt-1 min-h-24 w-full resize-y rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm leading-6 text-[var(--ll-text)]"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Assessment Check</p>
                      <textarea
                        value={plan.assessmentCheck}
                        onChange={(event) => updatePlanField("assessmentCheck", event.target.value)}
                        className="mt-2 min-h-24 w-full resize-y bg-transparent text-sm leading-6 text-[var(--ll-text)] outline-none"
                      />
                    </div>
                    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Homework Suggestion</p>
                      <textarea
                        value={plan.homeworkSuggestion}
                        onChange={(event) => updatePlanField("homeworkSuggestion", event.target.value)}
                        className="mt-2 min-h-24 w-full resize-y bg-transparent text-sm leading-6 text-[var(--ll-text)] outline-none"
                      />
                    </div>
                    {plan.hadFallback ? (
                      <p className="text-xs text-[var(--ll-yellow)]">
                        Fallback plan used because the AI planner could not return a validated response.
                      </p>
                    ) : null}
                  </section>
                </article>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
