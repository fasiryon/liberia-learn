"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { trackEvent, EVENTS } from "@/lib/trackEvent";
import {
  cacheLessonContent,
  loadCachedLesson,
  refreshLessonAvailability,
  removeCachedLesson,
} from "@/lib/lesson-offline-cache";
import { LessonAudioPlayer, type LessonAudioPart } from "@/components/student/LessonAudioPlayer";
import { getLessonLabLinks } from "@/lib/lessons/labLinks";
import { looksLikeHtml, renderSimpleMarkdown } from "@/lib/lessons";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { UnitSequenceSidebar } from "@/components/student/UnitSequenceSidebar";
import { LessonFullscreenButton } from "@/components/lesson/LessonFullscreenButton";
import { LessonUnavailable, NativeLessonRuntimeView } from "@/components/learner-experience/LessonRuntimeV2";
import { resolveLessonRuntime, unavailableReasonForStatus, type LessonRouteTarget, type LessonRuntimeResolution } from "@/lib/learner-experience/lessonRuntime";
import { loadLessonDelivery } from "@/lib/learner-experience/lessonRuntimeClient";

import { parseToSlides } from "@/lib/lessons/parseToSlides";
import { parseLessonBlocks, slideBlocks, splitLessonSections, type LessonBlock } from "@/lib/learner-experience/lessonText";
import { FocusedHeader, LearningStage } from "@/components/experience/FocusedLearning";
import { LegacyReading, LegacySlides, type LegacySlide } from "@/components/experience/LegacyLesson";
import { AskTutorButton } from "@/components/experience/AskTutorButton";
import { StateNotice } from "@/components/experience/StateNotice";
import { Chip } from "@/components/experience/Frame";

type LessonMode = "read" | "slides" | "listen" | "discussion";

type LessonMetadata = {
  grade?: number;
  subject?: string;
  moeAlignments?: string[];
  teacherCreated?: boolean;
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

export default function LessonViewerClient({ enabledToolIds = [] }: { enabledToolIds?: readonly string[] }) {
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
  const slideFullscreenRef = useRef<HTMLDivElement | null>(null);
  // Native Lesson Experience V2: what the server (or a signed offline copy) says this lesson is.
  const [runtime, setRuntime] = useState<LessonRuntimeResolution | null>(null);
  const target = useMemo<LessonRouteTarget>(() => ({ kind: "CONTENT", contentId }), [contentId]);
  // What the completion button actually achieved: recorded by the server, kept on this device, or failed.
  const [completionRecord, setCompletionRecord] = useState<"RECORDED" | "DEVICE_ONLY" | "SENDING" | "FAILED" | null>(null);
  const [bodyFormat, setBodyFormat] = useState<"standard" | "block">("standard");

  useEffect(() => {
    if (!contentId) return;

    trackEvent(EVENTS.LESSON_VIEW, { contentId });

    async function loadLesson() {
      // Lesson Experience V2: the server delivery seam decides whether this is a released native lesson.
      // Anything it does not deliver (legacy lessons, other content, offline) keeps the existing path below.
      const delivered = await loadLessonDelivery(target);
      if (delivered.kind === "NATIVE" || delivered.kind === "UNAVAILABLE") {
        if (delivered.kind === "UNAVAILABLE" && delivered.reason !== "LOAD_FAILED") await removeCachedLesson(contentId);
        setRuntime(delivered);
        return;
      }
      let res: Response;
      try {
        res = await fetch(`/api/curriculum/${contentId}`);
      } catch {
        const cached = await loadCachedLesson(contentId);
        // A cached native lesson is the server's learner projection: the runtime re-runs the strict learner
        // rebuild on it (re-projecting a projection would fail closed and hide a valid saved lesson).
        const cachedPayload = cached?.payload as Record<string, unknown> | undefined;
        if (cached && cachedPayload && "lessonExperience" in cachedPayload) {
          setMetadata(cached.metadata);
          setRuntime(resolveLessonRuntime({ payload: cachedPayload, source: "CACHE", target, contentVersion: typeof cached.metadata?.version === "string" ? cached.metadata.version : null }));
          setServedFromCache(true);
          return;
        }
        if (cached) {
          setMetadata(cached.metadata);
          setPayload(projectStudentLessonPayload(cached.payload));
          setAudio((cached.audio as LessonAudio | undefined) ?? null);
          setServedFromCache(true);
        } else {
          setError("This lesson isn't available offline yet. Please connect to the internet to load it for the first time.");
          setRuntime({ kind: "UNAVAILABLE", reason: "OFFLINE_NOT_CACHED" });
        }
        return;
      }

      if (res.status === 401 || res.status === 403) {
        await removeCachedLesson(contentId);
        router.push("/login");
        return;
      }
      if (!res.ok) {
        const rejection = await res.json().catch(() => null);
        if (rejection?.offlineManifest) {
          const refreshed = await refreshLessonAvailability(rejection.offlineManifest);
          if (!refreshed) await removeCachedLesson(contentId);
        } else {
          await removeCachedLesson(contentId);
        }
        setError("This lesson is no longer available.");
        setRuntime({ kind: "UNAVAILABLE", reason: unavailableReasonForStatus(res.status) });
        return;
      }
      const data = await res.json().catch(() => null);
      if (!data) {
        setError("The lesson response was invalid. Please try again.");
        return;
      }
      setMetadata(data.metadata);
      setPayload(data.payload);
      setRuntime(resolveLessonRuntime({ payload: data.payload, source: "NETWORK", target, contentVersion: typeof data.metadata?.version === "string" ? data.metadata.version : null }));
      setAudio(data.audio ?? null);
      cacheLessonContent(
        contentId,
        { metadata: data.metadata, payload: data.payload, audio: data.audio ?? null },
        data.offlineManifest
      );
    }

    loadLesson().finally(() => setLoading(false));
  }, [contentId, router, target]);

  const handleComplete = async () => {
    trackEvent(EVENTS.LESSON_COMPLETE, { contentId });
    setCompleted(true);
    // Teacher-created lessons aren't on the timetable, so completion must be
    // recorded explicitly — feeds StudentProgress → certificate/digest/league.
    // Library lessons have no completion writer here: say so instead of implying a record.
    if (!metadata?.teacherCreated) { setCompletionRecord("DEVICE_ONLY"); return; }
    setCompletionRecord("SENDING");
    try {
      const response = await fetch(`/api/student/teacher-lessons/${contentId}/complete`, { method: "POST" });
      setCompletionRecord(response.ok ? "RECORDED" : "FAILED");
    } catch {
      setCompletionRecord("FAILED");
    }
  };

  if (loading) {
    return (
      <div className="ll3-scope ll3-focus grid place-items-center px-4">
        <div className="w-full max-w-xl"><StateNotice kind="loading" title="Opening your lesson…">Checking which version of this lesson you can use.</StateNotice></div>
      </div>
    );
  }

  if (runtime?.kind === "NATIVE") {
    return <NativeLessonRuntimeView lesson={runtime} target={target} exitHref="/student/learn" enabledToolIds={enabledToolIds} />;
  }
  if (runtime?.kind === "UNAVAILABLE") {
    return <LessonUnavailable reason={runtime.reason} />;
  }

  if (error) {
    return (
      <div className="ll3-scope ll3-focus grid place-items-center px-4">
        <div className="w-full max-w-xl"><StateNotice kind="error" title="This lesson did not open" action={<Link href="/student/learn" className="ll3-btn" data-primary="">Back to Learn</Link>}>{error}</StateNotice></div>
      </div>
    );
  }

  const title = payload?.title ?? contentId;
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
  // Both period formats stay reachable; the standard period is shown first.
  const bodyText = isBlockOnly || (hasBothFormats && bodyFormat === "block") ? blockBodyText : standardBodyText || blockBodyText;
  const htmlBody = looksLikeHtml(bodyText);
  const moeAlignments: string[] = Array.isArray(metadata?.moeAlignments) ? metadata.moeAlignments : [];
  const sections = htmlBody ? [] : splitLessonSections(parseLessonBlocks(bodyText), title);
  const slideDeck = Array.isArray(payload?.slideDeckSpecs) ? payload.slideDeckSpecs[0] : null;
  // Authored deck first; otherwise the lesson text's own headings (the existing compatibility adapter);
  // an HTML body without a deck keeps the previous objectives/activities summary slides.
  const slides: LegacySlide[] = Array.isArray(slideDeck?.slides)
    ? slideDeck.slides.map((slide) => ({ title: slide.title, blocks: [{ kind: "list", ordered: false, items: slide.bullets ?? [] } satisfies LessonBlock] }))
    : bodyText && !htmlBody
      ? parseToSlides({ title, content: bodyText }).map((slide) => ({ title: slide.title, blocks: slideBlocks(slide.title, slide.content) }))
      : [
          { title, blocks: [{ kind: "list", ordered: false, items: objectives } satisfies LessonBlock] as LessonBlock[] },
          ...activities.slice(0, 5).map((activity, index) => ({ title: `Activity ${index + 1}`, blocks: [{ kind: "paragraph", text: activity } satisfies LessonBlock] as LessonBlock[] })),
        ].filter((slide) => slide.blocks.some((block) => block.kind === "list" ? block.items.some((item) => item.trim()) : block.kind === "paragraph" && block.text.trim()));
  const audioScripts = Array.isArray(payload?.audioScriptSpecs) ? payload.audioScriptSpecs : [];
  const generatedAudioReady = audio?.status === "GENERATED" && (audio?.storageUrl || audio?.audioParts?.length);
  const grade = metadata?.grade;
  const subjectLabel = (metadata?.subject ?? "").toString().replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  const young = typeof grade === "number" && grade >= 1 && grade <= 3;
  const authorName = (metadata as { teacherAuthorName?: unknown } | null)?.teacherAuthorName;

  function switchMode(nextMode: LessonMode) {
    setMode(nextMode);
    trackEvent("lesson_mode_changed", { contentId, mode: nextMode, source: "library_lesson" });
  }

  const support = <>
    {objectives.length > 0 && <section aria-labelledby="support-goals"><h2 id="support-goals">Lesson goals</h2><ul className="mt-2 grid gap-2 text-[15px] leading-6">{objectives.map((objective, index) => <li key={index} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--ll-accent)]" />{objective}</li>)}</ul></section>}
    {activities.length > 0 && <section aria-labelledby="support-activities"><h2 id="support-activities">Activities in this lesson</h2><ol className="mt-2 grid list-decimal gap-2 pl-5 text-[15px] leading-6">{activities.map((activity, index) => <li key={index}>{activity}</li>)}</ol></section>}
    {relatedLab && <section aria-labelledby="support-lab"><h2 id="support-lab">Explore further</h2><a href={`/student/labs/${relatedLab.labId}`} className="ll3-btn mt-2 w-full">{relatedLab.label} →</a></section>}
    <section aria-labelledby="support-help"><h2 id="support-help">Help</h2>
      <div className="mt-2"><AskTutorButton /></div>
      <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Opens beside the lesson, so you keep your place. AI help needs a connection.</p>
    </section>
  </>;

  const moveOn = <div className="ll3-task">
    <p className="ll3-task-label">Next in this lesson</p>
    <p>{slides.length > 1 ? "See the same lesson one idea at a time, or listen to it." : "Listen to this lesson, or talk about it with your class."}</p>
    <div className="flex flex-wrap gap-2">
      {slides.length > 1 && <button type="button" className="ll3-btn" onClick={() => { switchMode("slides"); window.scrollTo({ top: 0 }); }}>Open slides</button>}
      <button type="button" className="ll3-btn" onClick={() => { switchMode("listen"); window.scrollTo({ top: 0 }); }}>Listen</button>
    </div>
  </div>;

  return (
    <div className="ll3-scope ll3-focus" data-age-band={young ? "young" : "middle"} data-legacy-lesson data-lesson-mode={mode}>
      <FocusedHeader backHref="/student/learn" backLabel="Back to Learn" title={title}
        context={[grade != null ? `Grade ${grade}` : null, subjectLabel || null].filter(Boolean).join(" · ")}
        extra={servedFromCache ? <Chip tone="accent">Saved copy · offline</Chip> : undefined} />
      <LearningStage support={support} supportLabel="Lesson tools" mainLabelledBy="lesson-title">
        <div className="mb-6 grid gap-4">
          <div>
            <h1 id="lesson-title" className="ll3-title">{title}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              {grade != null && <Chip>Grade {grade}</Chip>}
              {subjectLabel && <Chip>{subjectLabel}</Chip>}
              {moeAlignments.map((alignment, index) => <Chip key={index}>{alignment}</Chip>)}
              {authorName ? <Chip>From {String(authorName)}</Chip> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="ll3-modes" role="group" aria-label="How to use this lesson">
              {(["read", "slides", "listen", "discussion"] as const).map((entry) => (
                <button key={entry} type="button" onClick={() => switchMode(entry)} aria-pressed={mode === entry}>{MODE_LABELS[entry]}</button>
              ))}
            </div>
            {hasBothFormats && (mode === "read" || mode === "slides") && <div className="ll3-modes" role="group" aria-label="Lesson length">
              <button type="button" aria-pressed={bodyFormat === "standard"} onClick={() => { setBodyFormat("standard"); setCurrentSlideIndex(0); }}>45 min</button>
              <button type="button" aria-pressed={bodyFormat === "block"} onClick={() => { setBodyFormat("block"); setCurrentSlideIndex(0); }}>90 min block</button>
            </div>}
          </div>
        </div>

        {/* Lesson sequence within its unit (renders nothing when the lesson has no unit). */}
        <UnitSequenceSidebar contentId={contentId} />

        {mode === "read" && (bodyText
          ? <LegacyReading key={bodyFormat} title={title} sections={sections} html={htmlBody ? renderSimpleMarkdown(bodyText) : null} after={moveOn} storageKey={`${contentId}:${bodyFormat}`} />
          : <StateNotice kind="empty" title="No reading text yet">This lesson has no reading text. Try Slides or Listen, or ask your teacher.</StateNotice>)}

        {mode === "slides" && (
          <LegacySlides slides={slides} index={currentSlideIndex} onIndexChange={setCurrentSlideIndex} containerRef={slideFullscreenRef} subject={metadata?.subject ?? null}
            deckLabel={slideDeck?.deckTitle ?? undefined} topActions={<LessonFullscreenButton targetRef={slideFullscreenRef} />} />
        )}

        {mode === "listen" && (
          <section aria-labelledby="listen-title" className="grid gap-4">
            <h2 id="listen-title" className="ll3-panel-title">Listen</h2>
            {generatedAudioReady ? (
              <LessonAudioPlayer audio={audio} contentId={contentId} />
            ) : (
              <StateNotice kind="unknown" title="Audio is not ready for this lesson">Read the narration below, or switch to Read. Audio plays only when your school has prepared it.</StateNotice>
            )}
            <div className="ll3-panel">
              <h3 className="ll3-panel-title">{audioScripts.length > 0 ? "Narration script" : "Lesson text"}</h3>
              {audioScripts.length > 0 ? (
                <div className="grid gap-4">{audioScripts.map((script: AudioScript, index: number) => (
                  <div key={index}>
                    <p className="ll3-eyebrow">{String(script.mode ?? `Script ${index + 1}`).replace(/_/g, " ")}</p>
                    <p className="ll3-reading mt-1 whitespace-pre-wrap">{script.script ?? script.fallbackText ?? "No narration script available."}</p>
                  </div>
                ))}</div>
              ) : (
                <p className="ll3-reading whitespace-pre-wrap">
                  {(() => {
                    if (!bodyText) return "No lesson narration is available yet.";
                    return looksLikeHtml(bodyText) ? bodyText.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim() : bodyText.replace(/^#+\s*/gm, "").replace(/\*\*/g, "");
                  })()}
                </p>
              )}
            </div>
          </section>
        )}

        {mode === "discussion" && (
          <section aria-labelledby="discussion-title" className="ll3-panel">
            <h2 id="discussion-title" className="ll3-panel-title">Talk about this lesson</h2>
            <p className="ll3-muted">Discussion happens on your class boards, where your teacher moderates it.</p>
            <a href="/student/discussion" className="ll3-btn mt-4">Go to class discussion boards →</a>
          </section>
        )}

        <section aria-labelledby="finish-title" className="ll3-panel mt-10" data-completion-record={completionRecord ?? undefined}>
          <h2 id="finish-title" className="ll3-panel-title">Finished with this lesson?</h2>
          {completed ? (
            <p role="status" className="text-base leading-7">
              {completionRecord === "SENDING" ? "Recording that you finished…"
                : completionRecord === "RECORDED" ? "Recorded. Your teacher can see that you finished this lesson."
                : completionRecord === "FAILED" ? "You finished, but it could not be recorded right now. Try again when you are online."
                : "Marked as finished on this device. Library lessons do not send a completion record; assigned lessons and checks do."}
            </p>
          ) : (
            <p className="ll3-muted">{metadata?.teacherCreated ? "Let your teacher know you finished this lesson." : "Marking it finished helps you keep your place. It does not change your marks or mastery."}</p>
          )}
          {(!completed || completionRecord === "FAILED") && (
            <button type="button" onClick={() => void handleComplete()} className="ll3-btn mt-4">
              {completionRecord === "FAILED" ? "Try again" : "Mark as finished"}
            </button>
          )}
          <p className="mt-4 text-sm text-[var(--ll-text-muted)]">After it opens once online, this lesson can be read on this device without a connection.</p>
        </section>
      </LearningStage>
    </div>
  );
}
