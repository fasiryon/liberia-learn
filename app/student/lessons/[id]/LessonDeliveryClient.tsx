"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Flag } from "lucide-react";

import { LessonQuizPanel } from "@/components/student/LessonQuizPanel";
import { ProblemRevealSection } from "@/components/student/ProblemRevealSection";
import { UnitSequenceSidebar } from "@/components/student/UnitSequenceSidebar";
import { StudentLessonHelpPanel } from "@/components/student/StudentLessonHelpPanel";
import LessonLabPanel from "@/components/labs/LessonLabPanel";
import { PencilButton, PencilButtonFloat } from "@/components/ui/PencilButton";
import { gradeToTutorBand } from "@/lib/ai/studentLessonSupport";
import { tutorActionForQuestion, type TutorIdentity } from "@/lib/ai/tutor/contextContract";
import { lessonDurationLabel, renderSimpleMarkdown, selectLessonBody } from "@/lib/lessons";
import { LessonHero, type HeroImageMetaLike, type InlineIllustrationLike } from "@/components/lesson/LessonImage";
import { LessonBody } from "@/components/lesson/LessonBody";
import { LessonFullscreenButton } from "@/components/lesson/LessonFullscreenButton";
import { exitLessonFullscreen } from "@/lib/lesson/fullscreen";
import { getLessonLabLinks } from "@/lib/lessons/labLinks";
import { parseToSlides } from "@/lib/lessons/parseToSlides";
import { enqueueOfflineRequest } from "@/lib/offline-queue";
import { loadLessonProgress, removeLessonProgress, saveLessonProgress } from "@/lib/offline/lessonProgress";
import { cacheLessonSession, loadCachedLessonSession } from "@/lib/offline/lessonSession";
import { loadCachedLesson, removeCachedLesson } from "@/lib/lesson-offline-cache";
import { projectStudentLessonPayload } from "@/lib/curriculum/studentLessonProjection";
import { LessonUnavailable, NativeLessonRuntimeView } from "@/components/learner-experience/LessonRuntimeV2";
import { loadCachedNativeLesson, loadLessonDelivery } from "@/lib/learner-experience/lessonRuntimeClient";
import type { LessonRouteTarget, LessonRuntimeResolution } from "@/lib/learner-experience/lessonRuntime";
import { SaveForOfflineButton } from "@/components/SaveForOfflineButton";
import { LessonAudioPlayer, type LessonAudioPart } from "@/components/student/LessonAudioPlayer";
import { StuckHelper } from "@/components/adaptive/StuckHelper";
import { CodeSubmit } from "@/components/grading/CodeSubmit";
import { AILiteracySubmit } from "@/components/grading/AILiteracySubmit";
import type { LabId } from "@/lib/labs/types";
import type { PseudoLab, SimulationDefinition } from "@/lib/schemas/labSimulation";
import { looksLikeHtml } from "@/lib/lessons";
import { parseLessonBlocks, slideBlocks, splitLessonSections } from "@/lib/learner-experience/lessonText";
import { FocusedHeader, LearningStage } from "@/components/experience/FocusedLearning";
import { LegacyReading, LegacySlides } from "@/components/experience/LegacyLesson";
import { StateNotice } from "@/components/experience/StateNotice";
import { Chip } from "@/components/experience/Frame";

type ExitTicketQuestion = {
  question: string;
  type: "mcq" | "short_answer";
  choices?: string[];
  standardCode?: string;
};

type LessonResponse = {
  id: string;
  curriculumContentId?: string;
  contentId: string;
  contentVersion?: string | null;
  contentHash?: string | null;
  title: string;
  subject: string;
  grade: number;
  teacherName: string;
  classFormat: string;
  schoolName: string;
  bodyStandard: string | null;
  bodyBlock: string | null;
  body: string | null;
  deliveryProfile: {
    exitTicket?: {
      questions?: ExitTicketQuestion[];
    };
  } | null;
  objectives: string[];
  heroImage?: { url: string; meta: HeroImageMetaLike } | null;
  inlineIllustrations?: InlineIllustrationLike[] | null;
  imageCategory?: string | null;
  pseudoLabs: PseudoLab[];
  simulationDefinitions: SimulationDefinition[];
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
  audio?: {
    id?: string;
    storageUrl?: string | null;
    voice?: string;
    durationSeconds?: number | null;
    contentVersion?: string;
    status: "NOT_GENERATED" | "PENDING" | "PROCESSING" | "GENERATED" | "STALE" | "FAILED";
    estimatedCostUsd?: number;
    audioParts?: LessonAudioPart[] | null;
  };
  activeVideo?: {
    id: string;
    title: string;
    description: string | null;
    storageUrl: string;
    thumbnailUrl: string | null;
    durationSeconds: number;
    fileSize: number;
    viewCount: number;
    uploadedAt: string;
    teacherName: string;
  } | null;
  codeExercises?: Array<{
    id: string;
    promptId: string;
    title: string;
    description: string;
    starterCode: string;
    languageId: number;
    testCases: Array<{ stdin: string }>;
    difficulty: string;
  }>;
  aiLiteracyExercises?: Array<{
    id: string;
    promptId: string;
    title: string;
    type: string;
    scenario: string;
    studentPromptInstruction: string | null;
    rubricCriteria: Array<{ key: string; label: string; weight: number }>;
  }>;
  takeawaySummary: string | null;
  problemSets: Array<{
    id: string;
    sectionId: string;
    label: string | null;
    studentPrompt: string;
    workingSpace: string | null;
  }>;
};

type TutorMessage = {
  role: "student" | "assistant";
  text: string;
  sources?: Array<{ id: string; title: string; sourceLabel: string | null }>;
  context?: TutorIdentity;
  generatedPractice?: boolean;
};

type SimulationValue = number | string | boolean | string[];
type LessonMode = "read" | "slides" | "listen" | "video";

export type LessonProgressState = {
  scrollPosition: number;
  lastReadSection: string;
};

export function parseLessonProgressState(raw: string): LessonProgressState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<LessonProgressState>;
    return {
      scrollPosition:
        typeof parsed.scrollPosition === "number" ? parsed.scrollPosition : 0,
      lastReadSection:
        typeof parsed.lastReadSection === "string"
          ? parsed.lastReadSection
          : "overview",
    };
  } catch {
    return null;
  }
}

export function persistLessonProgressState(
  storage: Pick<Storage, "setItem">,
  key: string,
  progress: LessonProgressState
) {
  storage.setItem(key, JSON.stringify(progress));
}

export function clearLessonProgressState(
  storage: Pick<Storage, "removeItem">,
  key: string
) {
  storage.removeItem(key);
}

export function persistLessonMode(storage: Pick<Storage, "setItem">, mode: LessonMode) {
  storage.setItem("lesson_mode", mode);
}

export function readPersistedLessonMode(storage: Pick<Storage, "getItem">): LessonMode {
  const value = storage.getItem("lesson_mode");
  return value === "slides" || value === "listen" || value === "read" ? value : "read";
}

export async function trackLessonModeChanged(
  fetcher: typeof fetch,
  input: { contentId: string | null; lessonId: string; mode: LessonMode }
) {
  await fetcher("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventType: "LESSON_MODE_CHANGED",
      contentId: input.contentId,
      metadata: {
        lessonId: input.lessonId,
        mode: input.mode,
      },
    }),
  });
}

function simulationDefaultState(definition: SimulationDefinition): Record<string, SimulationValue> {
  return Object.fromEntries(
    definition.inputs.map((input) => [
      input.key,
      input.defaultValue ?? (input.type === "toggle" ? false : input.type === "order" ? input.options ?? [] : input.min ?? 0),
    ])
  );
}

function renderFractionBar(numerator: number, denominator: number) {
  const safeNumerator = Math.max(0, Math.min(numerator, denominator));
  return (
    <div className="grid grid-cols-8 gap-1">
      {Array.from({ length: denominator }, (_, index) => (
        <div
          key={`${numerator}-${denominator}-${index}`}
          className={`h-5 rounded ${index < safeNumerator ? "bg-[var(--ll-yellow-soft)]" : "bg-[var(--ll-surface)]"}`}
        />
      ))}
    </div>
  );
}

function simulationFeedback(
  definition: SimulationDefinition,
  state: Record<string, SimulationValue>
): { summary: string; detail: string; visual?: ReactNode } {
  if (definition.rendererKey === "fraction_bar_visualizer") {
    const numeratorA = Number(state.numeratorA ?? 0);
    const denominatorA = Math.max(1, Number(state.denominatorA ?? 1));
    const numeratorB = Number(state.numeratorB ?? 0);
    const denominatorB = Math.max(1, Number(state.denominatorB ?? 1));
    const valueA = numeratorA / denominatorA;
    const valueB = numeratorB / denominatorB;
    const summary =
      Math.abs(valueA - valueB) < 0.0001
        ? "The fractions are equal."
        : valueA > valueB
          ? `Fraction A (${numeratorA}/${denominatorA}) is greater.`
          : `Fraction B (${numeratorB}/${denominatorB}) is greater.`;
    const detail = `Benchmark check: ${valueA >= 0.5 ? "Fraction A is at or above one-half" : "Fraction A is below one-half"}, and ${valueB >= 0.5 ? "Fraction B is at or above one-half." : "Fraction B is below one-half."}`;

    return {
      summary,
      detail,
      visual: (
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">Fraction A</p>
            {renderFractionBar(numeratorA, denominatorA)}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">Fraction B</p>
            {renderFractionBar(numeratorB, denominatorB)}
          </div>
        </div>
      ),
    };
  }

  if (definition.rendererKey === "plant_growth_slider") {
    const light = Number(state.light ?? 0);
    const water = Number(state.water ?? 0);
    const average = (light + water) / 2;
    const summary = average >= 7 ? "Strong growth conditions" : average >= 4 ? "Fair growth conditions" : "Weak growth conditions";
    const detail =
      light < 4 || water < 4
        ? "At least one condition is too low, so the plant struggles to make enough food."
        : "Both light and water are high enough to support healthier growth.";
    return { summary, detail };
  }

  if (definition.rendererKey === "water_cycle_sequence") {
    const stages = Array.isArray(state.stages) ? state.stages.map(String) : [];
    const expected = ["evaporation", "condensation", "collection"];
    const correct = stages.join("|") === expected.join("|");
    return {
      summary: correct ? "The sequence is correct." : "The sequence needs adjustment.",
      detail: correct
        ? "Water evaporates, condenses into droplets, and then collects."
        : "Try placing evaporation before condensation, then end with collection.",
    };
  }

  return {
    summary: definition.fallbackStaticVisual,
    detail: definition.explanation,
  };
}

function SimulationCard({ definition }: { definition: SimulationDefinition }) {
  const [state, setState] = useState<Record<string, SimulationValue>>(() => simulationDefaultState(definition));
  const feedback = simulationFeedback(definition, state);

  function updateValue(key: string, value: SimulationValue) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function moveOrderItem(key: string, index: number, direction: -1 | 1) {
    const current = Array.isArray(state[key]) ? [...(state[key] as string[])] : [];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= current.length) return;
    [current[index], current[targetIndex]] = [current[targetIndex], current[index]];
    updateValue(key, current);
  }

  return (
    <article className="rounded-xl border border-emerald-500/20 bg-[var(--ll-bg)]/60 p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ll-yellow)]">
        <span className="rounded-full bg-[var(--ll-yellow)]/15 px-3 py-1 font-semibold">{definition.simulationType.replace(/_/g, " ")}</span>
        <span>Interactive support</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-[var(--ll-text)]">{definition.title}</h3>
      <p className="mt-2 text-sm text-[var(--ll-text)]">{definition.objective}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          {definition.inputs.map((input) => {
            const value = state[input.key];
            if (input.type === "range") {
              return (
                <label key={input.key} className="block rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-[var(--ll-text)]">{input.label}</span>
                    <span className="text-xs text-[var(--ll-text)]">{String(value)}</span>
                  </div>
                  <input
                    type="range"
                    min={input.min}
                    max={input.max}
                    step={input.step ?? 1}
                    value={typeof value === "number" ? value : Number(value ?? input.min ?? 0)}
                    onChange={(event) => updateValue(input.key, Number(event.target.value))}
                    className="mt-3 min-h-11 w-full accent-emerald-400"
                  />
                </label>
              );
            }

            if (input.type === "toggle") {
              return (
                <label key={input.key} className="flex min-h-11 items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3 text-sm text-[var(--ll-text)]">
                  <span>{input.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(value)}
                    onChange={(event) => updateValue(input.key, event.target.checked)}
                    className="h-5 w-5"
                  />
                </label>
              );
            }

            if (input.type === "choice" || input.type === "step") {
              return (
                <label key={input.key} className="block rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3">
                  <span className="text-sm font-medium text-[var(--ll-text)]">{input.label}</span>
                  <select
                    value={String(value ?? input.options?.[0] ?? "")}
                    onChange={(event) => updateValue(input.key, event.target.value)}
                    className="mt-3 min-h-11 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)]"
                  >
                    {(input.options ?? []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            if (input.type === "order") {
              const items = Array.isArray(value) ? (value as string[]) : [];
              return (
                <div key={input.key} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-3">
                  <p className="text-sm font-medium text-[var(--ll-text)]">{input.label}</p>
                  <div className="mt-3 space-y-2">
                    {items.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex items-center justify-between rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-3 py-2 text-sm text-[var(--ll-text)]">
                        <span>{item}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => moveOrderItem(input.key, index, -1)} className="min-h-11 min-w-11 rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text)]">
                            Up
                          </button>
                          <button type="button" onClick={() => moveOrderItem(input.key, index, 1)} className="min-h-11 min-w-11 rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text)]">
                            Down
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }

            return null;
          })}
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-[var(--ll-yellow)]/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">What the simulation shows</p>
          <p className="mt-3 text-base font-semibold text-[var(--ll-text)]">{feedback.summary}</p>
          <p className="mt-2 text-sm text-[var(--ll-text)]">{feedback.detail}</p>
          {feedback.visual ? <div className="mt-4">{feedback.visual}</div> : null}
          <div className="mt-4 space-y-2 text-sm text-[var(--ll-text)]">
            <p><span className="font-semibold text-[var(--ll-text)]">Student guide:</span> Try one change at a time, then explain what changed.</p>
            <p><span className="font-semibold text-[var(--ll-text)]">Guardian guide:</span> {definition.guardianGuide ?? "Use the fallback explanation if no shared device is available."}</p>
            <p><span className="font-semibold text-[var(--ll-text)]">Fallback:</span> {definition.fallbackStaticVisual}</p>
          </div>
        </div>
      </div>
    </article>
  );
}


type ActiveVideo = NonNullable<LessonResponse["activeVideo"]>;

function VideoSection({
  video,
  contentId,
  lessonId,
}: {
  video: ActiveVideo;
  contentId: string;
  lessonId: string;
}) {
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  const watchIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "VIDEO_PLAYBACK_STARTED",
        contentId,
        metadata: { lessonId, videoId: video.id },
      }),
    }).catch(() => {});
  }, [contentId, lessonId, video.id]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    // Only report real progress: a paused, finished, or offline video sends
    // nothing, which saves data and battery on metered connections.
    let lastSentSecs = -1;
    function sendWatch() {
      if (!el) return;
      const watchedSecs = Math.round(el.currentTime);
      if (watchedSecs === lastSentSecs || (typeof navigator !== "undefined" && !navigator.onLine)) return;
      lastSentSecs = watchedSecs;
      void fetch(`/api/student/video/${video.id}/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watchedSecs,
          totalSecs: Math.round(el.duration || video.durationSeconds || 0),
        }),
      }).catch(() => {});
    }

    watchIntervalRef.current = setInterval(sendWatch, 30000);
    el.addEventListener("ended", sendWatch);
    el.addEventListener("pause", sendWatch);

    return () => {
      if (watchIntervalRef.current) clearInterval(watchIntervalRef.current);
      el.removeEventListener("ended", sendWatch);
      el.removeEventListener("pause", sendWatch);
    };
  }, [video.id, video.durationSeconds]);

  if (!isOnline) {
    return (
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 text-center text-sm text-amber-400">
        Video requires an internet connection. Connect to watch this lesson video.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-pink)]">
        Lesson introduction by {video.teacherName}
      </p>
      <h2 className="mt-2 text-lg font-semibold text-[var(--ll-text)]">{video.title}</h2>
      {video.description ? (
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">{video.description}</p>
      ) : null}
      <video
        ref={videoRef}
        className="mt-4 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-graphite)]"
        controls
        preload="metadata"
        poster={video.thumbnailUrl ?? undefined}
        src={video.storageUrl}
      />
      <p className="mt-2 text-xs text-[var(--ll-text-faint)]">
        {video.viewCount} student{video.viewCount !== 1 ? "s" : ""} watched this video
      </p>
    </section>
  );
}

/**
 * Assigned lesson route. A native Lesson Experience V2 lesson (server-authorized through the delivery
 * seam) plays in Lesson Player V2; every other lesson keeps the existing delivery below.
 */
export default function LessonDeliveryClient({ lessonId, enabledToolIds = [] }: { lessonId: string; enabledToolIds?: readonly string[] }) {
  const [native, setNative] = useState<LessonRuntimeResolution | null>(null);
  const [contentId, setContentId] = useState<string | null>(null);
  const target = useMemo<LessonRouteTarget | null>(() => (contentId ? { kind: "SCHEDULED_WORK", scheduledWorkId: lessonId, contentId } : null), [lessonId, contentId]);
  const onNative = useCallback((resolved: LessonRuntimeResolution, resolvedContentId: string) => { setContentId(resolvedContentId); setNative(resolved); }, []);
  if (native?.kind === "NATIVE" && target) return <NativeLessonRuntimeView lesson={native} target={target} exitHref="/student/today" enabledToolIds={enabledToolIds} />;
  if (native?.kind === "UNAVAILABLE") return <LessonUnavailable reason={native.reason} exitHref="/student/today" />;
  return (
    <div className="ll3-scope ll3-focus" data-legacy-lesson="assigned">
      <ScheduledLessonDelivery lessonId={lessonId} onNative={onNative} />
    </div>
  );
}

function ScheduledLessonDelivery({ lessonId, onNative }: { lessonId: string; onNative: (resolved: LessonRuntimeResolution, contentId: string) => void }) {
  const [lesson, setLesson] = useState<LessonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const tutorFocusRef = useRef<{ lessonId: string; question: string } | null>(null);
  const [openLabId, setOpenLabId] = useState<LabId | null>(null);
  const [toolkitOpen, setToolkitOpen] = useState(false);
  const [mode, setMode] = useState<LessonMode>("read");
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [audioRequesting, setAudioRequesting] = useState(false);
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState("overview");
  const [sectionOrder, setSectionOrder] = useState<string[]>(["overview", "lesson-content", "exit-ticket"]);
  const [flagPanelOpen, setFlagPanelOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [flagDone, setFlagDone] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const slideFullscreenRef = useRef<HTMLDivElement | null>(null);
  const hasRestoredProgressRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadLesson() {
      try {
        // Exact scheduled-work lookup goes directly to the governed seam; the legacy work API cannot gate native reachability.
        const resolved = await loadLessonDelivery({ kind: "SCHEDULED_WORK", scheduledWorkId: lessonId });
        if (resolved.kind === "NATIVE" || resolved.kind === "UNAVAILABLE" || (resolved.kind === "NO_DELIVERY" && resolved.status !== "OFFLINE" && resolved.status !== 404)) {
          if (!cancelled) {
            if (resolved.kind !== "NATIVE" && !(resolved.kind === "UNAVAILABLE" && resolved.reason === "LOAD_FAILED")) {
              const cachedRef = await loadCachedLessonSession<{ contentId: string }>(lessonId).catch(() => null);
              if (cachedRef?.contentId) await removeCachedLesson(cachedRef.contentId);
            }
            const contentId = resolved.kind === "NATIVE" ? resolved.identity.contentId : "";
            if (resolved.kind === "NATIVE") void cacheLessonSession(lessonId, { contentId, contentVersion: resolved.identity.lessonVersion, contentHash: null }).catch(() => {});
            onNative(resolved.kind === "NO_DELIVERY" ? { kind: "UNAVAILABLE", reason: "NOT_FOUND" } : resolved, contentId);
          }
          return;
        }
        if (resolved.kind === "NO_DELIVERY" && resolved.status === "OFFLINE") throw new Error("Lesson unavailable offline");
        // Today content-id links retain the existing legacy work path only for a plain 404.
        // Explicit native denials/errors are terminal above; the work API still rejects native rows.
        const response = await fetch(`/api/student/work/${lessonId}`);
        const data = await response.json();
        if (!response.ok) {
          if (!cancelled) onNative({ kind: "UNAVAILABLE", reason: "NOT_FOUND" }, "");
          return;
        }
        if (!cancelled) {
          setLesson(data);
          setError(null);
          void cacheLessonSession(lessonId, data).catch(() => {});
        }
      } catch (loadError: any) {
        const cachedReference = await loadCachedLessonSession<{
          contentId: string;
          contentVersion: string | null;
          contentHash: string | null;
        }>(lessonId).catch(() => null);
        if (cachedReference?.contentId) {
          // A saved native lesson opens read-only in the player; a legacy copy keeps the delivery below.
          const cachedNative = await loadCachedNativeLesson({ kind: "SCHEDULED_WORK", scheduledWorkId: lessonId, contentId: cachedReference.contentId });
          if (cachedNative.kind === "NATIVE" || (cachedNative.kind === "UNAVAILABLE" && cachedNative.reason !== "OFFLINE_NOT_CACHED")) {
            if (!cancelled) onNative(cachedNative, cachedReference.contentId);
            return;
          }
          const trusted = await loadCachedLesson(cachedReference.contentId);
          if (trusted && !cancelled) {
            const metadata = trusted.metadata ?? {};
            const payload = projectStudentLessonPayload(trusted.payload);
            const trustedLesson: LessonResponse = {
              id: lessonId,
              contentId: cachedReference.contentId,
              contentVersion: cachedReference.contentVersion,
              contentHash: cachedReference.contentHash,
              title: String(payload.title ?? cachedReference.contentId),
              subject: String(metadata.subject ?? "GENERAL"),
              grade: Number(metadata.grade ?? 0),
              teacherName: "Teacher",
              classFormat: "standard",
              schoolName: "School",
              bodyStandard: typeof payload.body_standard === "string" ? payload.body_standard : typeof payload.body === "string" ? payload.body : null,
              bodyBlock: typeof payload.body_block === "string" ? payload.body_block : typeof payload.body === "string" ? payload.body : null,
              body: typeof payload.body === "string" ? payload.body : typeof payload.lessons === "string" ? payload.lessons : JSON.stringify(payload),
              deliveryProfile: null,
              objectives: Array.isArray(payload.objectives) ? payload.objectives.map(String) : [],
              pseudoLabs: Array.isArray(payload.pseudoLabs) ? payload.pseudoLabs as PseudoLab[] : [],
              simulationDefinitions: Array.isArray(payload.simulationDefinitions) ? payload.simulationDefinitions as SimulationDefinition[] : [],
              status: "not_started",
              completedAt: null,
              audio: (trusted.audio as LessonResponse["audio"]) ?? { status: "NOT_GENERATED" },
              activeVideo: null,
              takeawaySummary: typeof payload.takeawaySummary === "string" ? payload.takeawaySummary : null,
              problemSets: [],
            };
            setLesson(trustedLesson);
            setError(null);
            return;
          }
        }
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
  }, [lessonId, onNative]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setMode(readPersistedLessonMode(window.localStorage));
  }, []);

  const renderedBody = useMemo(() => {
    if (!lesson) return "";
    return selectLessonBody(
      {
        body: lesson.body,
        body_standard: lesson.bodyStandard,
        body_block: lesson.bodyBlock,
      },
      lesson.classFormat,
      mode
    );
  }, [lesson, mode]);

  const slides = useMemo(() => {
    if (!lesson) return [];
    return parseToSlides({
      title: lesson.title,
      content: renderedBody,
      takeawaySummary: lesson.takeawaySummary ?? undefined,
    });
  }, [lesson, renderedBody]);


  useEffect(() => {
    if (currentSlideIndex > Math.max(0, slides.length - 1)) {
      setCurrentSlideIndex(Math.max(0, slides.length - 1));
    }
  }, [currentSlideIndex, slides.length]);

  const slideScenes = useMemo(() => slides.map((slide) => ({ title: slide.title, blocks: slideBlocks(slide.title, slide.content) })), [slides]);
  const readingSections = useMemo(() => (lesson && renderedBody && !looksLikeHtml(renderedBody) ? splitLessonSections(parseLessonBlocks(renderedBody), lesson.title) : []), [lesson, renderedBody]);

  const exitTicketQuestions = lesson?.deliveryProfile?.exitTicket?.questions ?? [];
  const aiTutorEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_TUTOR !== "false";
  const lessonProgressKey = useMemo(() => `lesson_progress_${lessonId}`, [lessonId]);
  const currentSectionIndex = sectionOrder.indexOf(currentSection);
  const availableLabs = useMemo(() => {
    if (!lesson) return [] as Array<{ labId: LabId; label: string }>;
    return getLessonLabLinks({ subject: lesson.subject, grade: lesson.grade });
  }, [lesson]);

  const registerSection = useCallback(
    (sectionId: string) => (node: HTMLElement | null) => {
      sectionRefs.current[sectionId] = node;
    },
    []
  );

  const persistLessonProgress = useCallback(() => {
    if (typeof window === "undefined" || !lesson || lesson.status === "completed") return;
    const payload: LessonProgressState = {
      scrollPosition: window.scrollY,
      lastReadSection: currentSection,
    };
    persistLessonProgressState(window.sessionStorage, lessonProgressKey, payload);
    void saveLessonProgress(lessonId, payload).catch(() => {});
  }, [currentSection, lesson, lessonId, lessonProgressKey]);

  const scrollToSection = useCallback((sectionId: string) => {
    const target = sectionRefs.current[sectionId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentSection(sectionId);
  }, []);

  const goToAssessmentFromSlides = useCallback(async () => {
    try {
      await exitLessonFullscreen();
    } catch {
      // Continue to the assessment even if the browser denies fullscreen exit.
    }
    window.setTimeout(() => scrollToSection("exit-ticket"), 0);
  }, [scrollToSection]);

  const openLessonLab = useCallback((labId: LabId) => {
    setOpenLabId(labId);
    setToolkitOpen(true);
    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "LAB_OPENED",
        contentId: lesson?.contentId ?? null,
        metadata: {
          labId,
          lessonId,
        },
      }),
    }).catch(() => {});
  }, [lesson?.contentId, lessonId]);

  const changeMode = useCallback((nextMode: LessonMode) => {
    setMode(nextMode);
    if (typeof window !== "undefined") {
      persistLessonMode(window.localStorage, nextMode);
    }
    void trackLessonModeChanged(fetch, {
      contentId: lesson?.contentId ?? null,
      lessonId,
      mode: nextMode,
    }).catch(() => {});
  }, [lesson?.contentId, lessonId]);

  const requestAudio = useCallback(async () => {
    if (!lesson || audioRequesting) return;
    if (lesson.audio?.status === "GENERATED") return;
    setAudioRequesting(true);
    try {
      const response = await fetch(`/api/student/lessons/${lesson.id}/audio`, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (response.ok && data?.audio) {
        setLesson((current) => current ? { ...current, audio: { ...data.audio, status: data.status ?? data.audio.status } } : current);
      }
    } finally {
      setAudioRequesting(false);
    }
  }, [audioRequesting, lesson]);

  useEffect(() => {
    if (mode === "listen") {
      void requestAudio();
    }
  }, [mode, requestAudio]);

  useEffect(() => {
    if (!lesson) return;

    const nextSectionOrder = ["overview", "lesson-content"];
    if (lesson.objectives.length > 0) nextSectionOrder.push("objectives");
    if ((lesson.codeExercises?.length ?? 0) > 0) nextSectionOrder.push("code-exercises");
    if ((lesson.aiLiteracyExercises?.length ?? 0) > 0) nextSectionOrder.push("ai-literacy");
    if (lesson.pseudoLabs.length > 0) nextSectionOrder.push("lab-activity");
    if (lesson.simulationDefinitions.length > 0) nextSectionOrder.push("simulations");
    nextSectionOrder.push("exit-ticket");
    setSectionOrder(nextSectionOrder);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        const sectionId = visible?.target.getAttribute("data-section-id");
        if (sectionId) setCurrentSection(sectionId);
      },
      {
        rootMargin: "-15% 0px -55% 0px",
        threshold: [0.2, 0.45, 0.7],
      }
    );

    Object.values(sectionRefs.current).forEach((node) => {
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [aiTutorEnabled, lesson]);

  useEffect(() => {
    if (!lesson || typeof window === "undefined" || hasRestoredProgressRef.current) return;
    hasRestoredProgressRef.current = true;

    const saved = window.sessionStorage.getItem(lessonProgressKey);
    void loadLessonProgress(lessonId).then((durable) => {
      const parsed = durable ?? (saved ? parseLessonProgressState(saved) : null);
      if (parsed) {
      const savedScrollPosition = parsed.scrollPosition;
      const savedSection = parsed.lastReadSection;

      setCurrentSection(savedSection);

      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          const targetSection = sectionRefs.current[savedSection];
          if (savedScrollPosition > 0) {
            window.scrollTo({ top: savedScrollPosition, behavior: "auto" });
          } else if (targetSection) {
            targetSection.scrollIntoView({ block: "start", behavior: "auto" });
          }
        }, 0);
      });
      } else if (saved) {
      clearLessonProgressState(window.sessionStorage, lessonProgressKey);
      }
    }).catch(() => {});
  }, [lesson, lessonId, lessonProgressKey]);

  useEffect(() => {
    if (!lesson || typeof window === "undefined") return;

    const interval = window.setInterval(() => {
      persistLessonProgress();
    }, 30000);
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") persistLessonProgress();
    };
    const handleBeforeUnload = () => persistLessonProgress();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [lesson, persistLessonProgress]);

  useEffect(() => {
    tutorFocusRef.current = null;
    setTutorMessages([]);
    setTutorQuestion("");
  }, [lesson?.id]);

  async function submitTutorQuestion(questionOverride?: string) {
    if (!lesson || tutorLoading) return;

    const prompt = (questionOverride ?? tutorQuestion).trim();
    if (!prompt) return;

    const action = tutorActionForQuestion(prompt);
    const priorFocus = tutorFocusRef.current?.lessonId === lesson.id ? tutorFocusRef.current.question : undefined;
    if (action === "explain" || !priorFocus) tutorFocusRef.current = { lessonId: lesson.id, question: prompt };
    setTutorMessages((current) => [...current, { role: "student", text: prompt }]);
    setTutorQuestion("");
    setTutorLoading(true);

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setTutorMessages((current) => [
          ...current,
          { role: "assistant", text: "Tutor help is unavailable offline. Reconnect to ask this question." },
        ]);
        return;
      }

      const response = await fetch("/api/student/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tutorContext: tutorMessages.filter((message) => message.role === "assistant" && message.context).at(-1)?.context ?? {
            lessonId: lesson.id,
            contentId: lesson.contentId,
            ...(lesson.contentVersion ? { lessonVersion: lesson.contentVersion } : {}),
          },
          tutorAction: action,
          ...(action !== "explain" && priorFocus ? { focusQuestion: priorFocus } : {}),
          question: prompt,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Tutor unavailable.");
      setTutorMessages((current) => [...current, { role: "assistant", text: data.explanation ?? "No response available.", sources: data.sources, context: data.tutorContext, generatedPractice: tutorActionForQuestion(prompt) === "practice" && !data.hadFallback }]);
    } catch (tutorError: any) {
      setTutorMessages((current) => [...current, { role: "assistant", text: tutorError?.message ?? "Tutor unavailable right now." }]);
    } finally {
      setTutorLoading(false);
    }
  }

  async function submitLessonFlag() {
    if (!lesson || flagSubmitting) return;
    setFlagSubmitting(true);
    try {
      await fetch(`/api/student/lesson/${lesson.contentId}/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: flagNote }),
      });
      setFlagDone(true);
      setFlagPanelOpen(false);
      setFlagNote("");
    } catch {
      // best-effort
    } finally {
      setFlagSubmitting(false);
    }
  }

  async function handleSubmitExitTicket() {
    if (!lesson) return;
    setSubmitting(true);
    setSubmitMessage(null);

    try {
      const exitTicketAnswers = exitTicketQuestions.map((question, index) => ({
        questionIndex: index,
        answer: answers[index] ?? null,
      }));
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        // Offline completion must name the exact release the learner used;
        // the server rejects completions without it, so do not queue one.
        if (!lesson.contentId || !lesson.contentVersion) {
          setSubmitMessage("This lesson can only be completed online. Your answers are kept on this page; reconnect to finish.");
          return;
        }
        await enqueueOfflineRequest({
          type: "lesson-complete",
          endpoint: "/api/student/sync",
          payload: {
            scheduledWorkId: lesson.id,
            exitTicketAnswers,
            clientUpdatedAt: new Date().toISOString(),
          },
          resourceType: "lesson_progress",
          resourceId: lesson.id,
          operationType: "progress.complete",
          contentId: lesson.contentId,
          contentVersion: lesson.contentVersion ?? null,
          contentHash: lesson.contentHash ?? null,
          dedupeKey: `lesson-complete:${lesson.id}`,
        });
        setSubmitMessage("Saved offline. Will sync when you reconnect.");
        return;
      }
      const response = await fetch(`/api/student/lessons/${lesson.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exitTicketAnswers }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Failed to complete lesson.");
      if (typeof window !== "undefined") {
        clearLessonProgressState(window.sessionStorage, lessonProgressKey);
      }
      void removeLessonProgress(lessonId).catch(() => {});
      setLesson((current) => (current ? { ...current, status: "completed", completedAt: data?.completedAt ?? new Date().toISOString() } : current));
      setSubmitMessage("Lesson complete! Great work.");
    } catch (submitError: any) {
      setSubmitMessage(submitError?.message ?? "Failed to complete lesson.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="grid min-h-dvh place-items-center px-4"><div className="w-full max-w-xl"><StateNotice kind="loading" title="Opening your lesson…">Checking your assigned lesson.</StateNotice></div></div>;
  }
  if (error || !lesson) {
    return <div className="grid min-h-dvh place-items-center px-4"><div className="w-full max-w-xl"><StateNotice kind="error" title="This lesson did not open" action={<a href="/student/today" className="ll3-btn" data-primary="">Back to Today</a>}>{error ?? "Lesson not found."}</StateNotice></div></div>;
  }

  const subjectLabel = lesson.subject.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  const supportRail = <>
    <section aria-labelledby="assigned-on-page">
      <h2 id="assigned-on-page">On this page</h2>
      <ol className="ll3-outline-list mt-2">
        {sectionOrder.map((sectionId, index) => (
          <li key={sectionId}>
            <button type="button" onClick={() => scrollToSection(sectionId)} aria-current={sectionId === currentSection ? "step" : undefined}>
              <span className="ll3-outline-num" aria-hidden="true">{index + 1}</span><span className="capitalize">{sectionId.replace(/-/g, " ")}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
    {lesson.objectives.length > 0 && <section aria-labelledby="assigned-goals"><h2 id="assigned-goals">Lesson goals</h2>
      <ul className="mt-2 grid gap-2 text-[15px] leading-6">{lesson.objectives.map((objective, index) => <li key={`${objective}-${index}`} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[var(--ll-accent)]" />{objective}</li>)}</ul>
    </section>}
    {(aiTutorEnabled || availableLabs.length > 0) && <section aria-labelledby="assigned-help"><h2 id="assigned-help">Help and tools</h2>
      <div className="mt-2 grid gap-2">
        {aiTutorEnabled ? <PencilButton onClick={() => setHelpPanelOpen(true)} label="Ask the tutor" active={helpPanelOpen} /> : null}
        {availableLabs.map((lab) => (
          <button key={lab.labId} type="button" onClick={() => openLessonLab(lab.labId)} className="ll3-btn w-full">{lab.label}</button>
        ))}
      </div>
    </section>}
    <p className="text-sm text-[var(--ll-text-muted)]">{lesson.teacherName} · {lesson.schoolName}</p>
  </>;

  return (
    <>
    <FocusedHeader backHref="/student/today" backLabel="Back to Today" title={lesson.title}
      context={`Grade ${lesson.grade} · ${subjectLabel} · ${lessonDurationLabel(lesson.classFormat)}`}
      extra={lesson.status === "completed" ? <Chip tone="success">Completed</Chip> : <Chip>Assigned by {lesson.teacherName}</Chip>}
      progress={{ value: ((Math.max(0, currentSectionIndex) + 1) / Math.max(1, sectionOrder.length)) * 100, label: "Position in this lesson" }} />
    <LearningStage support={supportRail} supportLabel="Lesson help" mainLabelledBy="lesson-title">
    <div className="space-y-6 pb-28">
        <section ref={registerSection("overview")} data-section-id="overview" className="grid gap-4">
          <div className="flex flex-wrap items-start gap-3">
            <h1 id="lesson-title" className="ll3-title min-w-0 flex-1">{lesson.title}</h1>
            <button
              type="button"
              aria-label="Flag this lesson for teacher help"
              aria-expanded={flagPanelOpen}
              title={flagDone ? "Flagged — your teacher has been notified" : "Flag this lesson for help"}
              onClick={() => flagDone ? undefined : setFlagPanelOpen((v) => !v)}
              className="ll3-btn shrink-0"
            >
              <Flag size={18} aria-hidden="true" /> {flagDone ? "Flagged" : "Need help?"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip>{subjectLabel}</Chip><Chip>Grade {lesson.grade}</Chip><Chip>{lessonDurationLabel(lesson.classFormat)}</Chip>
          </div>
          {flagPanelOpen && !flagDone && (
            <div className="ll3-panel grid max-w-xl gap-2">
              <p className="font-semibold">Flag for teacher help</p>
              <label htmlFor="flag-note" className="text-sm text-[var(--ll-text-muted)]">Optional: what are you struggling with?</label>
              <textarea
                id="flag-note"
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-[var(--ll-border-strong)] bg-[var(--ll-bg)] px-3 py-2 text-base text-[var(--ll-text)]"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={submitLessonFlag} disabled={flagSubmitting} className="ll3-btn" data-primary="">
                  {flagSubmitting ? "Flagging…" : "Send to my teacher"}
                </button>
                <button type="button" onClick={() => setFlagPanelOpen(false)} className="ll3-btn">Cancel</button>
              </div>
            </div>
          )}
          {flagDone && <p role="status" className="text-sm">Flag sent. Your teacher has been notified.</p>}
          <div className="flex flex-wrap items-center gap-3">
            <div className="ll3-modes" role="group" aria-label="How to use this lesson">
              {(["read", "slides", "listen", ...(lesson.activeVideo ? ["video"] : [])] as LessonMode[]).map((entry) => (
                <button key={entry} type="button" onClick={() => changeMode(entry)} aria-pressed={mode === entry} className="capitalize">{entry}</button>
              ))}
            </div>
            <SaveForOfflineButton
              contentId={lesson.contentId}
              lessonData={{ metadata: null, payload: { title: lesson.title, body: lesson.body } }}
            />
          </div>
          <p className="ll3-muted">Work through the lesson, then answer the assessment at the end. Your teacher uses it to see how you did.</p>
        </section>

        {mode === "video" && lesson.activeVideo ? (
          <VideoSection
            video={lesson.activeVideo}
            contentId={lesson.contentId}
            lessonId={lesson.id}
          />
        ) : null}

        {lesson.contentId ? (
          <UnitSequenceSidebar contentId={lesson.contentId} scheduledWorkId={lessonId} />
        ) : null}

        <section ref={registerSection("lesson-content")} data-section-id="lesson-content" className={mode === "video" ? "hidden" : ""}>
          {lesson.heroImage?.url ? (
            <LessonHero url={lesson.heroImage.url} meta={lesson.heroImage.meta} />
          ) : null}
          {mode === "listen" ? (
            <div className="mb-6 rounded-xl border border-[var(--ll-silver)]/20 bg-[var(--ll-silver-soft)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-silver)]">Listen Mode</p>
                  <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
                    The full lesson text stays below while audio plays.
                  </p>
                </div>
                {lesson.audio?.storageUrl && lesson.audio.status === "GENERATED" ? (
                  <a
                    href={lesson.audio.storageUrl}
                    download
                    className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-sm font-semibold text-[var(--ll-text)]"
                  >
                    Download audio
                  </a>
                ) : null}
              </div>
              <div className="mt-4">
                <LessonAudioPlayer
                  audio={lesson.audio}
                  contentId={lesson.contentId}
                  lessonId={lesson.id}
                />
              </div>
              {lesson.audio?.status === "GENERATED" && (lesson.audio?.storageUrl || lesson.audio?.audioParts?.length) ? (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {[0.75, 1, 1.25, 1.5].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      className="rounded-full border border-[var(--ll-border)] px-3 py-1 text-[var(--ll-text-muted)]"
                      onClick={() => {
                        const audio = document.querySelector<HTMLAudioElement>('[data-lesson-audio-player] audio, audio');
                        if (audio) audio.playbackRate = speed;
                      }}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {mode === "slides" ? (
            <LegacySlides
              slides={slideScenes}
              subject={lesson.subject}
              index={currentSlideIndex}
              onIndexChange={setCurrentSlideIndex}
              containerRef={slideFullscreenRef}
              topActions={<LessonFullscreenButton targetRef={slideFullscreenRef} />}
              lastAction={<button type="button" onClick={goToAssessmentFromSlides} className="ll3-btn" data-primary="">Go to assessment</button>}
            />
          ) : (
            <>
              {renderedBody && (
                <p className="mb-4 text-sm text-[var(--ll-text-muted)]">
                  {(() => {
                    const words = renderedBody.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
                    const mins = Math.ceil(words / 200);
                    return `About ${mins} min read · ${words.toLocaleString()} words`;
                  })()}
                </p>
              )}
              {readingSections.length > 0 && !(lesson.inlineIllustrations ?? []).some((item) => typeof item.position === "number")
                // Readable text column with contents; inline illustrations keep their positioned renderer.
                ? <LegacyReading title={lesson.title} sections={readingSections} storageKey={lesson.id}
                    after={<div className="ll3-task"><p className="ll3-task-label">Next</p><p>When you have read the lesson, answer the assessment questions below.</p><div><button type="button" className="ll3-btn" onClick={() => scrollToSection("exit-ticket")}>Go to assessment</button></div></div>} />
                : <div className="ll3-reading"><LessonBody renderedBody={renderedBody} inline={lesson.inlineIllustrations} /></div>}
              {lesson.problemSets && lesson.problemSets.length > 0 ? (
                <div className="mt-6">
                  <ProblemRevealSection lessonId={lesson.id} problemSets={lesson.problemSets} />
                </div>
              ) : null}
            </>
          )}
        </section>

        {lesson.objectives.length > 0 ? (
          <section ref={registerSection("objectives")} data-section-id="objectives" className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
            <h2 className="text-lg font-semibold text-[var(--ll-text)]">Lesson Objectives</h2>
            <ul className="mt-4 space-y-3 text-base text-[var(--ll-text)]">
              {lesson.objectives.map((objective, index) => (
                <li key={`${objective}-${index}`} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 px-4 py-3">
                  {objective}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

      {(lesson.codeExercises?.length ?? 0) > 0 ? (
        <section ref={registerSection("code-exercises")} data-section-id="code-exercises" className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">Coding Exercise</h2>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Write Python code and run it against test cases. Your submission is graded automatically.</p>
          <div className="mt-4 space-y-6">
            {lesson.codeExercises!.map((ex) => (
              <CodeSubmit
                key={ex.id}
                lessonId={lesson.curriculumContentId ?? lesson.id}
                promptId={ex.promptId}
                prompt={`${ex.title}\n\n${ex.description}`}
                language="python"
                testCases={ex.testCases.map((tc, i) => ({
                  stdin: tc.stdin,
                  label: `Sample ${i + 1}`,
                }))}
              />
            ))}
          </div>
        </section>
      ) : null}

      {(lesson.aiLiteracyExercises?.length ?? 0) > 0 ? (
        <section ref={registerSection("ai-literacy")} data-section-id="ai-literacy" className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">AI Literacy Exercise</h2>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Think critically about AI — there is no single right answer for most of these.</p>
          <div className="mt-4 space-y-6">
            {lesson.aiLiteracyExercises!.map((ex) => (
              <AILiteracySubmit
                key={ex.id}
                lessonId={lesson.id}
                exerciseId={ex.id}
                promptId={ex.promptId}
                title={ex.title}
                type={ex.type as "prompt_engineering" | "bias_detection" | "ethics_scenario" | "output_critique"}
                scenario={ex.scenario}
                studentPromptInstruction={ex.studentPromptInstruction}
                rubricCriteria={ex.rubricCriteria}
              />
            ))}
          </div>
        </section>
      ) : null}

      {lesson.pseudoLabs.length > 0 ? (
        <section ref={registerSection("lab-activity")} data-section-id="lab-activity" className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">Lab Activity</h2>
          <div className="mt-4 space-y-4">
            {lesson.pseudoLabs.map((lab) => (
              <article key={lab.id} className="rounded-xl border border-[var(--ll-silver)]/20 bg-[var(--ll-bg)]/60 p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--ll-silver)]">
                  <span className="rounded-full bg-[var(--ll-silver-soft)] px-3 py-1 font-semibold">{lab.labType.replace(/_/g, " ")}</span>
                  <span>{lab.resourceLevel} resource</span>
                  <span>{lab.offlineCapable ? "Offline capable" : "Needs connectivity"}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-[var(--ll-text)]">{lab.title}</h3>
                <p className="mt-2 text-sm text-[var(--ll-text)]">{lab.objective}</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-text-muted)]">Student steps</p>
                    <ol className="mt-3 space-y-2 text-sm text-[var(--ll-text)]">
                      {lab.procedureSteps.map((step, index) => (
                        <li key={`${lab.id}-step-${index}`} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-3">
                          {index + 1}. {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-sm text-[var(--ll-text)]">
                      <p className="font-semibold text-[var(--ll-text)]">Materials</p>
                      <p className="mt-2">{lab.requiredMaterials.join(", ")}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-sm text-[var(--ll-text)]">
                      <p className="font-semibold text-[var(--ll-text)]">Timing</p>
                      <p className="mt-2">Setup {lab.setupTimeMinutes} min, run {lab.runTimeMinutes} min, cleanup {lab.cleanupTimeMinutes} min.</p>
                    </div>
                    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-sm text-[var(--ll-text)]">
                      <p className="font-semibold text-[var(--ll-text)]">What to notice</p>
                      <p className="mt-2">{lab.expectedObservation}</p>
                    </div>
                    <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4 text-sm text-[var(--ll-text)]">
                      <p className="font-semibold text-[var(--ll-text)]">If materials are limited</p>
                      <p className="mt-2">{lab.fallbackIfNoMaterials}</p>
                    </div>
                    {lab.guardianHomeVariant ? (
                      <div className="rounded-xl border border-amber-500/20 bg-[var(--ll-yellow-soft)] p-4 text-sm text-[var(--ll-yellow)]">
                        <p className="font-semibold text-[var(--ll-text)]">Home variant for a guardian</p>
                        <p className="mt-2">{lab.guardianHomeVariant}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {lesson.simulationDefinitions.length > 0 ? (
        <section ref={registerSection("simulations")} data-section-id="simulations" className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">Interactive Simulation</h2>
          <div className="mt-4 space-y-4">
            {lesson.simulationDefinitions.map((definition) => (
              <SimulationCard key={definition.id} definition={definition} />
            ))}
          </div>
        </section>
      ) : null}

        <section ref={registerSection("exit-ticket")} data-section-id="exit-ticket" data-tour="assessment" className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-[var(--ll-text)]">Complete Assessment</h2>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Answer these questions to finish the lesson — your teacher uses this to see how you did.</p>
          <div className="mt-4 space-y-5">
            {exitTicketQuestions.map((question, index) => (
              <div key={`${question.question}-${index}`} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-4">
                <p className="text-base font-medium leading-7 text-[var(--ll-text)]">{question.question}</p>
                {question.type === "mcq" ? (
                  <div className="mt-3 space-y-2">
                    {(question.choices ?? []).map((choice, choiceIndex) => (
                      <label key={`${choice}-${choiceIndex}`} className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--ll-border)] px-4 py-3 text-base text-[var(--ll-text)]">
                        <input
                          type="radio"
                          name={`exit-ticket-${index}`}
                          checked={answers[index] === String(choiceIndex)}
                          onChange={() => setAnswers((current) => ({ ...current, [index]: String(choiceIndex) }))}
                          className="h-5 w-5"
                        />
                        <span>{choice}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={answers[index] ?? ""}
                    onChange={(event) => setAnswers((current) => ({ ...current, [index]: event.target.value }))}
                    className="mt-3 min-h-28 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 px-4 py-3 text-base leading-7 text-[var(--ll-text)] outline-none focus:border-[var(--ll-yellow)] focus:ring-1 focus:ring-[var(--ll-yellow)]/60"
                    placeholder="Write your answer here"
                  />
                )}
              </div>
            ))}
          </div>

          {submitMessage ? <p className="mt-3 text-sm text-[var(--ll-text)]">{submitMessage}</p> : null}
        </section>

        <div id="lesson-quiz">
          <LessonQuizPanel
            lessonId={lesson.id}
            lessonStatus={lesson.status}
            contentId={lesson.contentId}
            contentVersion={lesson.contentVersion}
            contentHash={lesson.contentHash}
          />
          {/* NR-14B: Adaptive stuck detection — mounts alongside the quiz panel */}
          <StuckHelper
            lessonId={lesson.contentId}
            lessonTitle={lesson.title}
            subject={lesson.subject}
            strandKey={lesson.subject.toLowerCase()}
            grade={lesson.grade}
            gradeBand={gradeToTutorBand(lesson.grade) === "lower" ? "lower" : "upper"}
            lessonBody={lesson.body ?? ""}
            onAiTutor={aiTutorEnabled ? () => setHelpPanelOpen(true) : undefined}
          />
        </div>

        <div className="sticky bottom-3 z-10" data-section-navigation>
          <nav aria-label="Lesson sections" className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--ll-border-strong)] bg-[var(--ll-bg)] p-2">
            <p className="mr-auto px-2 text-sm font-semibold text-[var(--ll-text-muted)]">Section {currentSectionIndex + 1} of {sectionOrder.length}</p>
            <button
              type="button"
              onClick={() => {
                const previousSection = sectionOrder[Math.max(0, currentSectionIndex - 1)];
                if (previousSection) scrollToSection(previousSection);
              }}
              disabled={currentSectionIndex <= 0}
              className="ll3-btn"
            >
              <ChevronLeft size={16} aria-hidden="true" /> Back
            </button>
            <button
              type="button"
              onClick={() => {
                const nextSection = sectionOrder[Math.min(sectionOrder.length - 1, currentSectionIndex + 1)];
                if (nextSection) scrollToSection(nextSection);
              }}
              disabled={currentSectionIndex >= sectionOrder.length - 1}
              className="ll3-btn"
            >
              Next <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleSubmitExitTicket}
              disabled={submitting || lesson.status === "completed"}
              className="ll3-btn"
              data-primary=""
            >
              {lesson.status === "completed" ? "Lesson already completed" : submitting ? "Submitting..." : "Submit Assessment"}
            </button>
          </nav>
        </div>
      <StudentLessonHelpPanel
        open={aiTutorEnabled && helpPanelOpen}
        onClose={() => setHelpPanelOpen(false)}
        lessonTitle={lesson.title}
        subject={lesson.subject}
        grade={lesson.grade}
        question={tutorQuestion}
        onQuestionChange={setTutorQuestion}
        onQuestionSubmit={submitTutorQuestion}
        messages={tutorMessages}
        loading={tutorLoading}
      />
      <LessonLabPanel
        open={openLabId !== null}
        onClose={() => {
          setOpenLabId(null);
          setToolkitOpen(false);
        }}
        labId={openLabId}
        lessonId={lesson.id}
      />
      {availableLabs.length > 0 ? (
        <div className="sm:hidden">
          <PencilButtonFloat
            onClick={() => openLessonLab(availableLabs[0].labId)}
            active={toolkitOpen}
          />
        </div>
      ) : null}
    </div>
    </LearningStage>
    </>
  );
}
