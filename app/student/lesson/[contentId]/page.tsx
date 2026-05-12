"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import { trackEvent, EVENTS } from "@/lib/trackEvent";
import { cacheLessonContent, loadCachedLesson } from "@/lib/lesson-offline-cache";
import { LessonAudioPlayer, type LessonAudioPart } from "@/components/student/LessonAudioPlayer";
import { getLessonLabLinks } from "@/lib/lessons/labLinks";

type LessonMode = "read" | "slides" | "listen" | "discussion";

type LessonMetadata = {
  grade?: number;
  subject?: string;
  moeAlignments?: string[];
  [key: string]: unknown;
};

type AudioScript = {
  mode?: string;
  script?: string;
  fallbackText?: string;
};

type LessonPayload = {
  title?: string;
  objectives?: string[];
  activities?: string[];
  body?: string;
  body_standard?: string;
  body_block?: string;
  content?: string;
  lessonFormat?: string;
  slideDeckSpecs?: Array<{ deckTitle?: string; slides?: Array<{ slideNumber: number; title: string; bullets: string[]; teacherNote?: string }> }>;
  audioScriptSpecs?: AudioScript[];
  [key: string]: unknown;
};

type LessonAudio = {
  id?: string;
  storageUrl?: string | null;
  status: string;
  durationSeconds?: number | null;
  estimatedCostUsd?: number;
  audioParts?: LessonAudioPart[] | null;
};

const MODE_LABELS: Record<LessonMode, string> = {
  read: "Read",
  slides: "Slides",
  listen: "Listen",
  discussion: "Discussion",
};

export default function LessonViewerPage() {
  const router = useRouter();
  const params = useParams();
  const contentId = params.contentId as string;

  const [loading, setLoading] = useState(true);
  const [metadata, setMetadata] = useState<LessonMetadata | null>(null);
  const [payload, setPayload] = useState<LessonPayload | null>(null);
  const [audio, setAudio] = useState<LessonAudio | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [servedFromCache, setServedFromCache] = useState(false);
  const [mode, setMode] = useState<LessonMode>("read");
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    if (!contentId) return;

    trackEvent(EVENTS.LESSON_VIEW, { contentId });

    fetch(`/api/curriculum/${contentId}`)
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          router.push("/login");
          return null;
        }
        if (!res.ok) throw new Error("Lesson not found");
        return res.json();
      })
      .then((data) => {
        if (data) {
          setMetadata(data.metadata);
          setPayload(data.payload);
          setAudio(data.audio ?? null);
          // Cache lesson content for offline use after first successful load
          cacheLessonContent(contentId, { metadata: data.metadata, payload: data.payload, audio: data.audio ?? null });
        }
      })
      .catch(async () => {
        // Network failure — attempt to serve from local cache
        const cached = await loadCachedLesson(contentId);
        if (cached) {
          setMetadata(cached.metadata);
          setPayload(cached.payload);
          setAudio((cached.audio as LessonAudio | undefined) ?? null);
          setServedFromCache(true);
        } else {
          setError("This lesson isn't available offline yet. Please connect to the internet to load it for the first time.");
        }
      })
      .finally(() => setLoading(false));
  }, [contentId, router]);

  const handleComplete = () => {
    trackEvent(EVENTS.LESSON_COMPLETE, { contentId });
    setCompleted(true);
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-8">
        <div className="w-full max-w-3xl space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-[var(--ll-surface)]" />
          <div className="h-4 w-full animate-pulse rounded-lg bg-[var(--ll-surface)]" />
          <div className="h-4 w-5/6 animate-pulse rounded-lg bg-[var(--ll-surface)]" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ll-bg)] px-4 py-8">
        <div className="w-full max-w-3xl space-y-4 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Back to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  const objectives: string[] = Array.isArray(payload?.objectives) ? payload.objectives : [];
  const activities: string[] = Array.isArray(payload?.activities) ? payload.activities : [];
  const scienceSubjects = ["SCIENCE", "BIOLOGY", "CHEMISTRY", "PHYSICS"];
  const subjectUpper = (metadata?.subject ?? "").toString().toUpperCase();
  const isScienceLesson = scienceSubjects.some((s) => subjectUpper.includes(s));
  const relatedLabs = isScienceLesson
    ? getLessonLabLinks({ subject: subjectUpper.toLowerCase(), grade: Number(metadata?.grade ?? 8) })
    : [];
  const relatedLab = relatedLabs[0] ?? null;
  const isBlockOnly = Boolean(payload?.lessonFormat === "block" && payload?.body_block && !payload?.body_standard);
  const standardBodyText: string = isBlockOnly ? "" : payload?.body_standard ?? payload?.body ?? payload?.content ?? "";
  const blockBodyText: string = payload?.body_block ?? "";
  const hasBothFormats = Boolean(payload?.body_standard && payload?.body_block);
  const moeAlignments: string[] = Array.isArray(metadata?.moeAlignments) ? metadata.moeAlignments : [];
  const slideDeck = Array.isArray(payload?.slideDeckSpecs) ? payload.slideDeckSpecs[0] : null;
  const slides = Array.isArray(slideDeck?.slides)
    ? slideDeck.slides
    : [
        {
          slideNumber: 1,
          title: payload?.title ?? contentId,
          bullets: objectives.length > 0 ? objectives : [standardBodyText.slice(0, 180)],
          teacherNote: "Use the full lesson text for detail.",
        },
        ...activities.slice(0, 5).map((activity, index) => ({
          slideNumber: index + 2,
          title: `Activity ${index + 1}`,
          bullets: [activity],
          teacherNote: "Pause for student explanation.",
        })),
      ].filter((slide) => slide.bullets.some((bullet: string) => bullet.trim().length > 0));
  const currentSlide = slides[currentSlideIndex] ?? slides[0] ?? null;
  const audioScripts = Array.isArray(payload?.audioScriptSpecs) ? payload.audioScriptSpecs : [];
  const generatedAudioReady = audio?.status === "GENERATED" && (audio?.storageUrl || audio?.audioParts?.length);

  function switchMode(nextMode: LessonMode) {
    setMode(nextMode);
    trackEvent("lesson_mode_changed", { contentId, mode: nextMode, source: "library_lesson" });
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Back */}
        <Link href="/student/today" className="inline-block text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          &larr; Back to today
        </Link>

        {/* Offline cache indicator */}
        {servedFromCache && (
          <div className="rounded-xl border border-amber-500/30 bg-[var(--ll-yellow-soft)] px-4 py-2 text-xs text-[var(--ll-yellow)]">
            Viewing cached version — you are offline
          </div>
        )}

        {/* Title + badges */}
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-[var(--ll-text)]">
            {payload?.title ?? contentId}
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-[var(--ll-yellow)]/20 border border-emerald-400/30 px-3 py-0.5 text-xs font-medium text-[var(--ll-yellow)]">
              Grade {metadata?.grade}
            </span>
            <span className="rounded-full bg-[var(--ll-yellow)]/20 border border-emerald-400/30 px-3 py-0.5 text-xs font-medium text-[var(--ll-yellow)]">
              {metadata?.subject}
            </span>
          </div>

          {/* MOE alignment chips */}
          {moeAlignments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {moeAlignments.map((a: string, i: number) => (
                <span key={i} className="rounded-full bg-sky-500/20 border border-sky-400/30 px-3 py-0.5 text-xs text-sky-300">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-2">
          <div className="grid grid-cols-4 gap-2">
            {(["read", "slides", "listen", "discussion"] as const).map((entry) => (
              <button
                key={entry}
                type="button"
                onClick={() => switchMode(entry)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  mode === entry
                    ? "bg-[var(--ll-yellow)] text-[var(--ll-text-faint)]"
                    : "bg-[var(--ll-surface)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                }`}
                aria-pressed={mode === entry}
              >
                {MODE_LABELS[entry]}
              </button>
            ))}
          </div>
        </div>

        {/* Learning Objectives */}
        {mode === "read" && objectives.length > 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--ll-text)] uppercase tracking-wide">Learning Objectives</h2>
            <ul className="list-disc list-inside space-y-1 text-sm text-[var(--ll-text)]">
              {objectives.map((obj: string, i: number) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Body Content */}
        {mode === "read" && (standardBodyText || blockBodyText) && (
          <div className="space-y-4">
            {standardBodyText && (
              <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text)]">
                    Standard Period Lesson
                  </h2>
                  <span className="rounded-full border border-emerald-400/30 bg-[var(--ll-yellow)]/10 px-3 py-1 text-[11px] text-[var(--ll-yellow)]">
                    45 min
                  </span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-[var(--ll-text)] leading-relaxed">
                  <ReactMarkdown>{standardBodyText}</ReactMarkdown>
                </div>
              </div>
            )}

            {(hasBothFormats || isBlockOnly) && blockBodyText && (
              <div className="rounded-xl border border-cyan-500/20 bg-[var(--ll-bg)]/70 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text)]">
                    Block Period Lesson
                  </h2>
                  <span className="rounded-full border border-cyan-400/30 bg-[var(--ll-silver-soft)] px-3 py-1 text-[11px] text-[var(--ll-silver)]">
                    90 min / A-B day
                  </span>
                </div>
                <div className="prose prose-invert prose-sm max-w-none text-[var(--ll-text)] leading-relaxed">
                  <ReactMarkdown>{blockBodyText}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Activities */}
        {mode === "read" && activities.length > 0 && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-[var(--ll-text)] uppercase tracking-wide">Activities</h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-[var(--ll-text)]">
              {activities.map((act: string, i: number) => (
                <li key={i}>{act}</li>
              ))}
            </ol>
          </div>
        )}

        {mode === "slides" && (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
            {currentSlide ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text-muted)]">
                    Slide {currentSlideIndex + 1} of {slides.length}
                  </span>
                  <span className="text-xs text-[var(--ll-text-faint)]">
                    {slideDeck?.deckTitle ?? "Lesson deck"}
                  </span>
                </div>
                <div className="min-h-[260px] rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6">
                  <h2 className="text-2xl font-semibold text-[var(--ll-text)]">
                    {currentSlide.title}
                  </h2>
                  <ul className="mt-5 space-y-3 text-base leading-7 text-[var(--ll-text)]">
                    {(currentSlide.bullets ?? []).map((bullet: string, index: number) => (
                      <li key={index} className="flex gap-3">
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--ll-yellow)]" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                  {currentSlide.teacherNote ? (
                    <p className="mt-5 rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3 text-sm text-[var(--ll-text-muted)]">
                      {currentSlide.teacherNote}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentSlideIndex((value) => Math.max(0, value - 1))}
                    disabled={currentSlideIndex === 0}
                    className="rounded-lg border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentSlideIndex((value) => Math.min(slides.length - 1, value + 1))}
                    disabled={currentSlideIndex >= slides.length - 1}
                    className="rounded-lg border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[var(--ll-text-muted)]">Slides are not available for this lesson yet.</p>
            )}
          </section>
        )}

        {mode === "listen" && (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text)]">Listen Mode</h2>
            {generatedAudioReady ? (
              <LessonAudioPlayer audio={audio} contentId={contentId} />
            ) : (
              <div className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                <p className="text-sm text-[var(--ll-text-muted)]">
                  Generated audio is not available yet. Use the narration script below while audio preparation is pending.
                </p>
              </div>
            )}
            <div className="space-y-3">
              {audioScripts.length > 0 ? (
                audioScripts.map((script: AudioScript, index: number) => (
                  <div key={index} className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-faint)]">
                      {String(script.mode ?? `Script ${index + 1}`).replace(/_/g, " ")}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--ll-text)]">
                      {script.script ?? script.fallbackText ?? "No narration script available."}
                    </p>
                  </div>
                ))
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--ll-text)]">
                  {standardBodyText || blockBodyText || "No lesson narration is available yet."}
                </p>
              )}
            </div>
          </section>
        )}

        {mode === "discussion" && (
          <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5 space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--ll-text)]">Lesson Discussion</h2>
            <p className="text-sm text-[var(--ll-text-muted)]">
              Discuss this lesson with your class.{" "}
              <a href="/student/discussion" className="text-[var(--ll-yellow)]">
                Go to full discussion boards →
              </a>
            </p>
          </section>
        )}

        {/* Related Lab */}
        {relatedLab ? (
          <div className="mt-6 p-4 rounded-xl border border-[var(--ll-yellow)] bg-[var(--ll-yellow-soft)]">
            <p className="text-sm font-medium text-[var(--ll-text)] mb-2">
              Ready to explore further?
            </p>
            <a
              href={`/student/labs/${relatedLab.labId}`}
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 bg-[var(--ll-yellow)] text-[var(--ll-bg)] text-sm font-medium hover:opacity-90"
            >
              {relatedLab.label} →
            </a>
          </div>
        ) : null}

        {/* Mark Complete */}
        <div className="flex items-center gap-3">
          {completed ? (
            <div className="flex items-center gap-2 text-[var(--ll-yellow)] text-sm font-medium">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Lesson complete!
            </div>
          ) : (
            <button
              onClick={handleComplete}
              className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/40 hover:bg-[var(--ll-yellow-soft)]"
            >
              Mark as Complete
            </button>
          )}
        </div>

        {/* Low bandwidth note */}
        <p className="text-[11px] text-[var(--ll-text-faint)] text-center pb-4">
          This lesson is cached for offline use after first load.
        </p>
      </div>
    </main>
  );
}
