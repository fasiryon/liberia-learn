"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { renderSimpleMarkdown } from "@/lib/lessons";

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

export default function TeacherLessonViewClient({
  contentId,
}: {
  contentId: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<CurriculumResponse | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [classSize, setClassSize] = useState("35");
  const [timeAvailableMinutes, setTimeAvailableMinutes] = useState<(typeof TIME_OPTIONS)[number]>(45);
  const [specialConsiderations, setSpecialConsiderations] = useState("");
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [plan, setPlan] = useState<LessonPlan | null>(null);
  const [videoTitle, setVideoTitle] = useState("Teacher introduction");
  const [videoDescription, setVideoDescription] = useState("");
  const [videoDuration, setVideoDuration] = useState("60");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoMessage, setVideoMessage] = useState<string | null>(null);

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
    lesson?.payload?.body ??
    "";
  const objectives = Array.isArray(lesson?.payload?.objectives)
    ? lesson.payload.objectives
    : [];

  const renderedBody = useMemo(
    () => renderSimpleMarkdown(lessonBody),
    [lessonBody]
  );
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
    } catch (plannerError: any) {
      setPlanError(plannerError?.message ?? "Failed to create lesson plan.");
    } finally {
      setPlanning(false);
    }
  }

  async function handleVideoUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoFile) {
      setVideoMessage("Choose an MP4, WebM, or MOV file.");
      return;
    }
    setUploadingVideo(true);
    setVideoMessage(null);
    try {
      const form = new FormData();
      form.set("file", videoFile);
      form.set("title", videoTitle);
      form.set("description", videoDescription);
      form.set("durationSeconds", videoDuration);
      const response = await fetch(`/api/teacher/lessons/${contentId}/video`, {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Video upload failed.");
      setVideoMessage("Video uploaded. Activate it when ready for students.");
      setVideoFile(null);
      const reload = await fetch(`/api/curriculum/${contentId}`, { cache: "no-store" });
      if (reload.ok) setLesson(await reload.json());
    } catch (error: any) {
      setVideoMessage(error?.message ?? "Video upload failed.");
    } finally {
      setUploadingVideo(false);
    }
  }

  async function toggleVideo(videoId: string, isActive: boolean) {
    const response = await fetch(`/api/teacher/lessons/${contentId}/video/${videoId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (response.ok) {
      setLesson((current) =>
        current
          ? {
              ...current,
              videos: (current.videos ?? []).map((video) =>
                video.id === videoId ? { ...video, isActive } : video
              ),
            }
          : current
      );
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

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
        <div
          className="prose prose-invert max-w-[720px] prose-headings:text-[var(--ll-text)] prose-p:text-[var(--ll-text)] prose-p:text-[1rem] prose-p:leading-8 prose-li:text-[var(--ll-text)] prose-li:text-[1rem] prose-li:leading-8"
          dangerouslySetInnerHTML={{ __html: renderedBody }}
        />
      </section>

      <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-pink)]">Optional video supplement</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--ll-text)]">Teacher video upload</h2>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Short clips support the lesson, but the full text remains primary.</p>
          </div>
        </div>
        <form onSubmit={handleVideoUpload} className="mt-5 grid gap-3">
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,.mov"
            onChange={(event) => setVideoFile(event.target.files?.[0] ?? null)}
            className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={videoTitle}
              onChange={(event) => setVideoTitle(event.target.value)}
              className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
              placeholder="Video title"
            />
            <input
              type="number"
              min={1}
              max={900}
              value={videoDuration}
              onChange={(event) => setVideoDuration(event.target.value)}
              className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
              placeholder="Duration seconds"
            />
          </div>
          <textarea
            value={videoDescription}
            onChange={(event) => setVideoDescription(event.target.value)}
            className="min-h-20 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
            placeholder="Optional description"
          />
          <button
            type="submit"
            disabled={uploadingVideo}
            className="min-h-12 rounded-xl bg-[var(--ll-pink-soft)] px-5 py-3 text-sm font-semibold text-[var(--ll-pink)] disabled:opacity-50"
          >
            {uploadingVideo ? "Uploading..." : "Upload video"}
          </button>
          {videoFile ? <p className="text-xs text-[var(--ll-text-muted)]">Selected: {videoFile.name}</p> : null}
          {videoMessage ? <p className="text-sm text-[var(--ll-text-muted)]">{videoMessage}</p> : null}
        </form>
        {(lesson.videos ?? []).length > 0 ? (
          <div className="mt-5 space-y-3">
            {lesson.videos?.map((video) => (
              <div key={video.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-[var(--ll-text)]">{video.title}</p>
                    <p className="text-xs text-[var(--ll-text-muted)]">{Math.ceil(video.fileSize / 1024 / 1024)}MB, {Math.round(video.durationSeconds / 60)} min</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleVideo(video.id, !video.isActive)}
                    className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-sm text-[var(--ll-text)]"
                  >
                    {video.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
                <video className="mt-3 w-full rounded-xl border border-[var(--ll-border)]" controls src={video.storageUrl} />
              </div>
            ))}
          </div>
        ) : null}
      </section>

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
                  </div>

                  <section className="mt-5">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--ll-text)]">
                      Learning Objectives
                    </h4>
                    <ul className="mt-3 space-y-2 text-sm text-[var(--ll-text)]">
                      {plan.learningObjectives.map((objective, index) => (
                        <li key={`${objective}-${index}`} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-3">
                          {objective}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="mt-5 space-y-4 text-sm text-[var(--ll-text)]">
                    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Warm-Up</p>
                      <p className="mt-2 leading-6">{plan.warmUpActivity}</p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Teaching Sequence</p>
                      {plan.teachingSequence.map((step, index) => (
                        <div key={`${step.segment}-${index}`} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-[var(--ll-text)]">{step.segment}</p>
                            <span className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text)]">
                              {step.minutes} min
                            </span>
                          </div>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Teacher Moves</p>
                          <p className="mt-1 leading-6">{step.teacherMoves}</p>
                          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Student Experience</p>
                          <p className="mt-1 leading-6">{step.studentExperience}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Assessment Check</p>
                      <p className="mt-2 leading-6">{plan.assessmentCheck}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-muted)]">Homework Suggestion</p>
                      <p className="mt-2 leading-6">{plan.homeworkSuggestion}</p>
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
