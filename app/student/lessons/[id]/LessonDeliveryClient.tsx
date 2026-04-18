"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { LessonQuizPanel } from "@/components/student/LessonQuizPanel";
import { StudentLessonHelpPanel } from "@/components/student/StudentLessonHelpPanel";
import LessonLabPanel from "@/components/labs/LessonLabPanel";
import { gradeToTutorBand } from "@/lib/ai/studentLessonSupport";
import { lessonDurationLabel, renderSimpleMarkdown, selectLessonBody } from "@/lib/lessons";
import { enqueueOfflineRequest } from "@/lib/offline-queue";
import type { LabId } from "@/lib/labs/types";
import type { PseudoLab, SimulationDefinition } from "@/lib/schemas/labSimulation";

type ExitTicketQuestion = {
  question: string;
  type: "mcq" | "short_answer";
  choices?: string[];
  standardCode?: string;
};

type LessonResponse = {
  id: string;
  contentId: string;
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
  pseudoLabs: PseudoLab[];
  simulationDefinitions: SimulationDefinition[];
  status: "not_started" | "in_progress" | "completed";
  completedAt: string | null;
};

type TutorMessage = {
  role: "student" | "assistant";
  text: string;
};

type SimulationValue = number | string | boolean | string[];

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
          className={`h-5 rounded ${index < safeNumerator ? "bg-emerald-400" : "bg-slate-800"}`}
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
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Fraction A</p>
            {renderFractionBar(numeratorA, denominatorA)}
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Fraction B</p>
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
    <article className="rounded-3xl border border-emerald-500/20 bg-slate-950/60 p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-emerald-200">
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold">{definition.simulationType.replace(/_/g, " ")}</span>
        <span>Interactive support</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-white">{definition.title}</h3>
      <p className="mt-2 text-sm text-slate-200">{definition.objective}</p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3">
          {definition.inputs.map((input) => {
            const value = state[input.key];
            if (input.type === "range") {
              return (
                <label key={input.key} className="block rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-100">{input.label}</span>
                    <span className="text-xs text-slate-300">{String(value)}</span>
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
                <label key={input.key} className="flex min-h-11 items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-3 text-sm text-slate-100">
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
                <label key={input.key} className="block rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                  <span className="text-sm font-medium text-slate-100">{input.label}</span>
                  <select
                    value={String(value ?? input.options?.[0] ?? "")}
                    onChange={(event) => updateValue(input.key, event.target.value)}
                    className="mt-3 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100"
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
                <div key={input.key} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
                  <p className="text-sm font-medium text-slate-100">{input.label}</p>
                  <div className="mt-3 space-y-2">
                    {items.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-sm text-slate-100">
                        <span>{item}</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => moveOrderItem(input.key, index, -1)} className="min-h-11 min-w-11 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-100">
                            Up
                          </button>
                          <button type="button" onClick={() => moveOrderItem(input.key, index, 1)} className="min-h-11 min-w-11 rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-100">
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

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">What the simulation shows</p>
          <p className="mt-3 text-base font-semibold text-white">{feedback.summary}</p>
          <p className="mt-2 text-sm text-slate-100">{feedback.detail}</p>
          {feedback.visual ? <div className="mt-4">{feedback.visual}</div> : null}
          <div className="mt-4 space-y-2 text-sm text-slate-100">
            <p><span className="font-semibold text-slate-100">Student guide:</span> Try one change at a time, then explain what changed.</p>
            <p><span className="font-semibold text-slate-100">Guardian guide:</span> {definition.guardianGuide ?? "Use the fallback explanation if no shared device is available."}</p>
            <p><span className="font-semibold text-slate-100">Fallback:</span> {definition.fallbackStaticVisual}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function LessonDeliveryClient({ lessonId }: { lessonId: string }) {
  const [lesson, setLesson] = useState<LessonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [helpPanelOpen, setHelpPanelOpen] = useState(false);
  const [openLabId, setOpenLabId] = useState<LabId | null>(null);
  const [tutorQuestion, setTutorQuestion] = useState("");
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([]);
  const [tutorLoading, setTutorLoading] = useState(false);
  const [currentSection, setCurrentSection] = useState("overview");
  const [sectionOrder, setSectionOrder] = useState<string[]>(["overview", "lesson-content", "exit-ticket"]);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const hasRestoredProgressRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadLesson() {
      try {
        const response = await fetch(`/api/student/work/${lessonId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Failed to load lesson.");
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
  }, [lessonId]);

  const renderedBody = useMemo(() => {
    if (!lesson) return "";
    return selectLessonBody(
      {
        body: lesson.body,
        body_standard: lesson.bodyStandard,
        body_block: lesson.bodyBlock,
      },
      lesson.classFormat
    );
  }, [lesson]);

  const exitTicketQuestions = lesson?.deliveryProfile?.exitTicket?.questions ?? [];
  const aiTutorEnabled = process.env.NEXT_PUBLIC_ENABLE_AI_TUTOR === "true";
  const lessonProgressKey = useMemo(() => `lesson_progress_${lessonId}`, [lessonId]);
  const currentSectionIndex = sectionOrder.indexOf(currentSection);
  const availableLabs = useMemo(() => {
    if (!lesson) return [] as Array<{ labId: LabId; label: string }>;
    const subject = lesson.subject.toLowerCase();
    const labs: Array<{ labId: LabId; label: string }> = [];
    if (lesson.grade >= 7 && lesson.grade <= 9 && subject.includes("physics")) {
      labs.push(
        { labId: "gravity-explorer", label: "Open Gravity Lab" },
        { labId: "pendulum-lab", label: "Open Pendulum Lab" }
      );
    }
    if (lesson.grade >= 9 && lesson.grade <= 11 && subject.includes("physics")) {
      labs.push({ labId: "electric-circuit", label: "Open Circuit Lab" });
    }
    if (lesson.grade >= 10 && lesson.grade <= 12 && subject.includes("physics")) {
      labs.push({ labId: "wave-motion", label: "Open Wave Lab" });
    }
    if (lesson.grade >= 9 && lesson.grade <= 11 && subject.includes("chemistry")) {
      labs.push({ labId: "molecule-motion", label: "Open Molecule Lab" });
    }
    if (lesson.grade >= 8 && lesson.grade <= 10 && subject.includes("biology")) {
      labs.push({ labId: "human-heart", label: "Open Heart Lab" });
    }
    if (lesson.grade >= 9 && lesson.grade <= 11 && subject.includes("biology")) {
      labs.push({ labId: "cell-division", label: "Open Cell Division Lab" });
    }
    if (lesson.grade >= 7 && lesson.grade <= 9 && subject.includes("biology")) {
      labs.push({ labId: "ecosystem-balance", label: "Open Ecosystem Lab" });
    }
    return labs;
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
  }, [currentSection, lesson, lessonProgressKey]);

  const scrollToSection = useCallback((sectionId: string) => {
    const target = sectionRefs.current[sectionId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setCurrentSection(sectionId);
  }, []);

  const openLessonLab = useCallback((labId: LabId) => {
    setOpenLabId(labId);
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

  useEffect(() => {
    if (!lesson) return;

    const nextSectionOrder = ["overview", "lesson-content"];
    if (lesson.objectives.length > 0) nextSectionOrder.push("objectives");
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
    if (!saved) return;

    const parsed = parseLessonProgressState(saved);
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
    } else {
      clearLessonProgressState(window.sessionStorage, lessonProgressKey);
    }
  }, [lesson, lessonProgressKey]);

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

  async function submitTutorQuestion(questionOverride?: string) {
    if (!lesson) return;

    const prompt = (questionOverride ?? tutorQuestion).trim();
    if (!prompt) return;

    setTutorMessages((current) => [...current, { role: "student", text: prompt }]);
    setTutorQuestion("");
    setTutorLoading(true);

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        await enqueueOfflineRequest({
          type: "tutor-interaction",
          endpoint: "/api/student/tutor",
          payload: {
            subject: lesson.subject,
            strandKey: lesson.subject.toLowerCase(),
            lessonTitle: lesson.title,
            lessonContent: renderedBody,
            lessonId: lesson.id,
            contentId: lesson.contentId,
            requestType: "explain",
            question: prompt,
          },
          dedupeKey: `tutor:${lesson.id}:${prompt}`,
        });
        setTutorMessages((current) => [
          ...current,
          { role: "assistant", text: "You are offline. Your question has been saved and will sync when you reconnect." },
        ]);
        return;
      }

      const response = await fetch("/api/student/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: lesson.subject,
          strandKey: lesson.subject.toLowerCase(),
          lessonTitle: lesson.title,
          lessonContent: renderedBody,
          lessonId: lesson.id,
          contentId: lesson.contentId,
          question: prompt,
          gradeLevel: lesson.grade,
          masteryState: "NOT_ASSESSED",
          proficiencyState: "NOT_ASSESSED",
          gradeBand: gradeToTutorBand(lesson.grade),
          requestType: "explain",
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Tutor unavailable.");
      setTutorMessages((current) => [...current, { role: "assistant", text: data.explanation ?? "No response available." }]);
    } catch (tutorError: any) {
      setTutorMessages((current) => [...current, { role: "assistant", text: tutorError?.message ?? "Tutor unavailable right now." }]);
    } finally {
      setTutorLoading(false);
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
        await enqueueOfflineRequest({
          type: "lesson-complete",
          endpoint: `/api/student/lessons/${lesson.id}/complete`,
          payload: { exitTicketAnswers },
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
      setLesson((current) => (current ? { ...current, status: "completed", completedAt: data?.completedAt ?? new Date().toISOString() } : current));
      setSubmitMessage("Lesson complete! Great work.");
    } catch (submitError: any) {
      setSubmitMessage(submitError?.message ?? "Failed to complete lesson.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="h-64 animate-pulse rounded-3xl bg-slate-900/60" />;
  }
  if (error || !lesson) {
    return <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{error ?? "Lesson not found."}</div>;
  }

  return (
    <div className="space-y-6 pb-28">
        <section ref={registerSection("overview")} data-section-id="overview" className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200">
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-300">{lesson.subject}</span>
            <span>Grade {lesson.grade}</span>
            <span>{lessonDurationLabel(lesson.classFormat)}</span>
          </div>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-white">{lesson.title}</h1>
              <p className="mt-2 text-base text-slate-100">Teacher: {lesson.teacherName}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/55 px-4 py-3 text-sm text-slate-200">
              Stay focused on the lesson, then complete the exit ticket at the end.
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Progress</p>
                <p className="mt-1 text-sm text-slate-100">
                  You are currently reading the {currentSection.replace(/-/g, " ")} section.
                </p>
              </div>
              <p className="text-sm text-slate-300">School: {lesson.schoolName}</p>
            </div>
          <div className="mt-4 flex flex-wrap gap-2">
              {sectionOrder.map((sectionId) => (
                <button
                  key={sectionId}
                  type="button"
                  onClick={() => scrollToSection(sectionId)}
                  className={`ll-touch-target rounded-full px-4 py-2 text-sm ${
                    sectionId === currentSection
                      ? "bg-emerald-400 text-slate-950"
                      : "border border-slate-700 bg-slate-950/70 text-slate-100"
                  }`}
                >
                  {sectionId.replace(/-/g, " ")}
                </button>
              ))}
            </div>
            {aiTutorEnabled ? (
              <button
                type="button"
                onClick={() => setHelpPanelOpen(true)}
                className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300"
              >
                Help Me Understand
              </button>
            ) : null}
            {availableLabs.map((lab) => (
              <button
                key={lab.labId}
                type="button"
                onClick={() => openLessonLab(lab.labId)}
                className="mt-4 ml-0 inline-flex min-h-12 items-center justify-center rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 sm:ml-2"
              >
                {lab.label}
              </button>
            ))}
          </div>
        </section>

        <section ref={registerSection("lesson-content")} data-section-id="lesson-content" className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
          <div
            className="prose prose-invert max-w-[680px] prose-headings:text-white prose-p:text-slate-100 prose-p:text-[1rem] prose-p:leading-8 prose-li:text-slate-100 prose-li:text-[1rem] prose-li:leading-8"
            dangerouslySetInnerHTML={{ __html: renderSimpleMarkdown(renderedBody) }}
          />
        </section>

        {lesson.objectives.length > 0 ? (
          <section ref={registerSection("objectives")} data-section-id="objectives" className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
            <h2 className="text-lg font-semibold text-white">Lesson Objectives</h2>
            <ul className="mt-4 space-y-3 text-base text-slate-100">
              {lesson.objectives.map((objective, index) => (
                <li key={`${objective}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                  {objective}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

      {lesson.pseudoLabs.length > 0 ? (
        <section ref={registerSection("lab-activity")} data-section-id="lab-activity" className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-white">Lab Activity</h2>
          <div className="mt-4 space-y-4">
            {lesson.pseudoLabs.map((lab) => (
              <article key={lab.id} className="rounded-3xl border border-cyan-500/20 bg-slate-950/60 p-5">
                <div className="flex flex-wrap items-center gap-2 text-xs text-cyan-200">
                  <span className="rounded-full bg-cyan-500/15 px-3 py-1 font-semibold">{lab.labType.replace(/_/g, " ")}</span>
                  <span>{lab.resourceLevel} resource</span>
                  <span>{lab.offlineCapable ? "Offline capable" : "Needs connectivity"}</span>
                </div>
                <h3 className="mt-3 text-lg font-semibold text-white">{lab.title}</h3>
                <p className="mt-2 text-sm text-slate-200">{lab.objective}</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Student steps</p>
                    <ol className="mt-3 space-y-2 text-sm text-slate-100">
                      {lab.procedureSteps.map((step, index) => (
                        <li key={`${lab.id}-step-${index}`} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3">
                          {index + 1}. {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-100">
                      <p className="font-semibold text-white">Materials</p>
                      <p className="mt-2">{lab.requiredMaterials.join(", ")}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-100">
                      <p className="font-semibold text-white">Timing</p>
                      <p className="mt-2">Setup {lab.setupTimeMinutes} min, run {lab.runTimeMinutes} min, cleanup {lab.cleanupTimeMinutes} min.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-100">
                      <p className="font-semibold text-white">What to notice</p>
                      <p className="mt-2">{lab.expectedObservation}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-100">
                      <p className="font-semibold text-white">If materials are limited</p>
                      <p className="mt-2">{lab.fallbackIfNoMaterials}</p>
                    </div>
                    {lab.guardianHomeVariant ? (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                        <p className="font-semibold text-white">Home variant for a guardian</p>
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
        <section ref={registerSection("simulations")} data-section-id="simulations" className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-white">Interactive Simulation</h2>
          <div className="mt-4 space-y-4">
            {lesson.simulationDefinitions.map((definition) => (
              <SimulationCard key={definition.id} definition={definition} />
            ))}
          </div>
        </section>
      ) : null}

        <section ref={registerSection("exit-ticket")} data-section-id="exit-ticket" className="rounded-3xl border border-white/10 bg-slate-900/80 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-white">Exit Ticket</h2>
          <div className="mt-4 space-y-5">
            {exitTicketQuestions.map((question, index) => (
              <div key={`${question.question}-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-base font-medium leading-7 text-slate-50">{question.question}</p>
                {question.type === "mcq" ? (
                  <div className="mt-3 space-y-2">
                    {(question.choices ?? []).map((choice, choiceIndex) => (
                      <label key={`${choice}-${choiceIndex}`} className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-800 px-4 py-3 text-base text-slate-100">
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
                    className="mt-3 min-h-28 w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-base leading-7 text-slate-50 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/60"
                    placeholder="Write your answer here"
                  />
                )}
              </div>
            ))}
          </div>

          {submitMessage ? <p className="mt-3 text-sm text-slate-300">{submitMessage}</p> : null}
        </section>

        <LessonQuizPanel lessonId={lesson.id} lessonStatus={lesson.status} />

        <div className="sticky bottom-3 z-10">
          <div className="rounded-3xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">Section navigation</p>
                <p className="mt-1 text-sm text-slate-200">
                  {currentSectionIndex + 1} of {sectionOrder.length}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:flex">
                {aiTutorEnabled ? (
                  <button
                    type="button"
                    onClick={() => setHelpPanelOpen(true)}
                    className="ll-touch-target rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100"
                  >
                    Help Me Understand
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    const previousSection = sectionOrder[Math.max(0, currentSectionIndex - 1)];
                    if (previousSection) scrollToSection(previousSection);
                  }}
                  disabled={currentSectionIndex <= 0}
                  className="ll-touch-target rounded-2xl border border-slate-700 px-4 py-3 text-sm text-slate-100 disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextSection = sectionOrder[Math.min(sectionOrder.length - 1, currentSectionIndex + 1)];
                    if (nextSection) scrollToSection(nextSection);
                  }}
                  disabled={currentSectionIndex >= sectionOrder.length - 1}
                  className="ll-touch-target rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-40"
                >
                  Next
                </button>
                <button
                  type="button"
                  onClick={handleSubmitExitTicket}
                  disabled={submitting || lesson.status === "completed"}
                  className="ll-touch-target rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                >
                  {lesson.status === "completed" ? "Lesson already completed" : submitting ? "Submitting..." : "Submit exit ticket"}
                </button>
              </div>
            </div>
          </div>
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
        onClose={() => setOpenLabId(null)}
        labId={openLabId}
        lessonId={lesson.id}
      />
    </div>
  );
}
