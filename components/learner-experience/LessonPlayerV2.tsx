"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, CircleHelp, Flag, Wrench } from "lucide-react";
import type { AgeBand, LessonExperience, Scene } from "@/lib/learner-experience/types";
import type { LearningExperienceLink } from "@/lib/learner-experience/links";
import type { LabExperience } from "@/lib/learner-experience/labExperience";
import type { SceneToolView } from "@/lib/learner-experience/tools";
import { advance, applyLabReturn, chooseLabFallback, goToScene, initialProgress, isSceneComplete, markLabLaunched, percentComplete, recordResponse, restoreProgress, retreat, revealStep, sceneIndexOf, type ExperienceProgress } from "@/lib/learner-experience/progress";
import { buildLabLaunchHref, isLabReturnObservation, labReturnStorageKey, type LabReturnObservation } from "@/lib/learner-experience/labLaunch";
import { buildEvidenceEnvelope, type ExperienceEvidenceEnvelope } from "@/lib/learner-experience/evidenceHandoff";
import { loadExperienceProgress, saveExperienceProgress } from "@/lib/learner-experience/progressStore";
import { TOOL_COMPONENTS } from "@/components/toolkit/toolComponents";
import { AssessmentHandoffSeam, DiagramReveal, FormativeCheck, ReflectionPrompts, SceneBody } from "./SceneViews";
import { LabScene } from "./LabScene";

const TYPE_LABEL: Record<Scene["type"], string> = {
  INTRO: "Introduction", OBJECTIVE: "Goal", EXPLANATION: "Learn", MEDIA: "Watch", INTERACTIVE_DIAGRAM: "Explore",
  GUIDED_EXAMPLE: "Worked example", PRACTICE: "Practice", CHECK_UNDERSTANDING: "Quick check", LAB: "Lab",
  REFLECTION: "Reflect", REVIEW: "Review", MASTERY_CHECK: "Final check",
};

const BLOCKED_HINT: Record<Scene["completion"]["kind"], string> = {
  VIEWED: "",
  ALL_STEPS_REVEALED: "Open every stage of the diagram to continue.",
  ALL_ANSWERED: "Answer every question to continue.",
  ALL_RESPONSES_WRITTEN: "Write an answer to each question to continue.",
  LAB_RETURNED_OR_FALLBACK: "Explore the lab, or use the text walkthrough, to continue.",
};

function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  return online;
}

export type LessonPlayerV2Props = {
  experience: LessonExperience;
  links: readonly LearningExperienceLink[];
  labs: Readonly<Record<string, LabExperience>>;
  toolsByScene: Readonly<Record<string, readonly SceneToolView[]>>;
  basePath: string;
  exitHref: string;
  /** From the URL after a lab return: the scene to restore. */
  returnSceneId: string | null;
  ageBand?: AgeBand;
};

export function LessonPlayerV2({ experience, links, labs, toolsByScene, basePath, exitHref, returnSceneId, ageBand }: LessonPlayerV2Props) {
  const router = useRouter();
  const online = useOnline();
  const band = ageBand ?? experience.ageBand;
  const [progress, setProgress] = useState<ExperienceProgress | null>(null);
  const [openTool, setOpenTool] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<ExperienceEvidenceEnvelope | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoredScene = useRef<string | null>(null);

  // Resume: saved position (partitioned IndexedDB), then any lab hand-back for this lesson.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const saved = await loadExperienceProgress(experience.id).catch(() => null);
      // A superseded run must not consume the one-shot lab hand-back slot.
      if (cancelled) return;
      let next = restoreProgress(experience, saved);
      // The lab's one-shot hand-back, accepted only for a link this lesson actually placed.
      let observation: LabReturnObservation | null = null;
      try {
        const raw = window.sessionStorage.getItem(labReturnStorageKey(experience.id));
        const parsed = raw ? JSON.parse(raw) : null;
        if (isLabReturnObservation(parsed) && links.some((candidate) => candidate.linkId === parsed.linkId && candidate.experience.labId === parsed.labId)) observation = parsed;
      } catch { /* storage unavailable */ }
      // A pending launch (return link or browser Back) is consumed. If IndexedDB lost the launch marker, a valid
      // hand-back with the return link still restores the scene. A reload of an old return URL has no hand-back
      // left, so it never pulls the learner backwards; the return parameters are also stripped from the address.
      const labSceneId = next.lab.status === "LAUNCHED" ? returnSceneId ?? next.sceneId : returnSceneId && observation ? returnSceneId : null;
      if (returnSceneId) window.history.replaceState(window.history.state, "", window.location.pathname);
      if (labSceneId) {
        try { window.sessionStorage.removeItem(labReturnStorageKey(experience.id)); } catch { /* storage unavailable */ }
        next = applyLabReturn(experience, next, labSceneId, observation);
      }
      if (!cancelled) setProgress(next);
    })();
    return () => { cancelled = true; };
  }, [experience, links, returnSceneId]);

  useEffect(() => {
    if (progress) void saveExperienceProgress(progress).catch(() => undefined);
  }, [progress]);

  // Global status toasts lift above the fixed Previous / Continue bar, measured (it grows when the hint shows).
  const [footerHeight, setFooterHeight] = useState(96);
  const footerObserver = useRef<ResizeObserver | null>(null);
  const footerRef = useCallback((node: HTMLElement | null) => {
    footerObserver.current?.disconnect();
    footerObserver.current = null;
    if (!node) return;
    const sync = () => setFooterHeight(Math.ceil(node.getBoundingClientRect().height));
    sync();
    if (typeof ResizeObserver === "function") { footerObserver.current = new ResizeObserver(sync); footerObserver.current.observe(node); }
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--ll-fixed-footer", `${footerHeight}px`);
  }, [footerHeight]);
  useEffect(() => () => { footerObserver.current?.disconnect(); document.documentElement.style.removeProperty("--ll-fixed-footer"); }, []);

  const index = progress ? sceneIndexOf(experience, progress) : 0;
  const scene = experience.scenes[index];
  const complete = progress ? isSceneComplete(scene, progress) : false;
  const isLast = index === experience.scenes.length - 1;
  const furthest = progress ? Math.max(index, ...progress.completedSceneIds.map((id) => experience.scenes.findIndex((candidate) => candidate.id === id) + 1)) : 0;
  const link = scene.interaction.kind === "LAB_LAUNCH" ? links.find((candidate) => candidate.linkId === (scene.interaction as { linkId: string }).linkId) ?? null : null;
  const objectives = useMemo(() => experience.objectives.filter((objective) => scene.objectiveIds.includes(objective.id)), [experience.objectives, scene.objectiveIds]);
  const tools = toolsByScene[scene.id] ?? [];

  // Move focus to the heading only when the scene changes (never on an answer or keystroke), so keyboard and
  // screen-reader users land on the new scene. The first scene keeps normal page focus unless it is a lab return.
  const loaded = progress !== null;
  useEffect(() => {
    if (!loaded) return;
    if (restoredScene.current === null) { restoredScene.current = scene.id; if (!returnSceneId) return; }
    else if (restoredScene.current === scene.id) return;
    restoredScene.current = scene.id;
    headingRef.current?.focus();
    setOpenTool(null);
  }, [scene.id, loaded, returnSceneId]);

  const update = useCallback((change: (current: ExperienceProgress) => ExperienceProgress) => setProgress((current) => (current ? change(current) : current)), []);

  const launchLab = async () => {
    if (!progress || !link) return;
    const launched = markLabLaunched(progress, scene.id);
    setProgress(launched);
    await saveExperienceProgress(launched).catch(() => undefined);
    router.push(buildLabLaunchHref(basePath, { v: 1, labId: link.experience.labId, linkId: link.linkId, origin: { experienceId: experience.id, experienceVersion: experience.version, sceneId: scene.id, objectiveIds: link.objectiveIds, activityId: experience.id } }));
  };

  const finish = () => {
    if (!progress || !complete) return;
    // Governed handoff: observations only. The existing authority decides what happens next.
    const labLink = links.find((candidate) => experience.scenes.some((item) => item.interaction.kind === "LAB_LAUNCH" && item.interaction.linkId === candidate.linkId)) ?? null;
    setSubmitted(buildEvidenceEnvelope(experience, advance(experience, progress), labLink));
    update((current) => advance(experience, current));
  };

  if (!progress) {
    return <div className="min-h-dvh bg-[var(--ll-bg)] px-4 py-10" aria-busy="true"><p className="mx-auto max-w-2xl text-[var(--ll-text-muted)]">Loading your lesson…</p></div>;
  }

  const ToolComponent = openTool ? TOOL_COMPONENTS[openTool] : null;
  const contextPanel = (
    <div className="space-y-5">
      <section aria-labelledby="ctx-objective">
        <h2 id="ctx-objective" className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ll-text-muted)]">This scene helps you</h2>
        <ul className="mt-2 space-y-2">{objectives.map((objective) => <li key={objective.id} className="text-sm leading-6 text-[var(--ll-text)]">{objective.statement}</li>)}</ul>
      </section>
      <section aria-labelledby="ctx-tools">
        <h2 id="ctx-tools" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ll-text-muted)]"><Wrench size={14} aria-hidden="true" /> Tools</h2>
        {tools.length === 0 ? <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{scene.tools.prohibited.length ? "Tools are switched off for this check." : "No tools needed here."}</p> : (
          <ul className="mt-2 space-y-2">
            {tools.map((tool) => (
              <li key={tool.id}>
                {tool.enabled
                  ? <button type="button" aria-pressed={openTool === tool.id} aria-label={tool.a11yLabel} onClick={() => setOpenTool((current) => (current === tool.id ? null : tool.id))} className="min-h-11 w-full rounded-xl border border-[var(--ll-border)] px-3 py-2 text-left text-sm font-semibold text-[var(--ll-text)]">{tool.name}</button>
                  : <p className="text-sm text-[var(--ll-text-muted)]">{tool.name} (switched off on this server)</p>}
              </li>
            ))}
          </ul>
        )}
        {ToolComponent && <div className="mt-3 overflow-x-auto rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-2"><ToolComponent onClose={() => setOpenTool(null)} assessmentMode={scene.type === "MASTERY_CHECK"} /></div>}
      </section>
      <section aria-labelledby="ctx-help">
        <h2 id="ctx-help" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ll-text-muted)]"><CircleHelp size={14} aria-hidden="true" /> Help</h2>
        <ul className="mt-2 space-y-2 text-sm">
          <li><Link href="/student/ai-tutor" className="inline-flex min-h-11 items-center text-[var(--ll-accent)] underline-offset-4 hover:underline">Ask the AI tutor</Link></li>
          <li className="flex gap-2 text-[var(--ll-text-muted)]"><Flag size={14} className="mt-1 shrink-0" aria-hidden="true" /> Need your teacher? Released lessons connect here to the existing &quot;Flag for teacher&quot; path.</li>
          <li className="text-[var(--ll-text-muted)]">{online ? "Your place is saved on this device." : `Offline: ${scene.offline.fallback}`}</li>
        </ul>
      </section>
    </div>
  );

  return (
    <div data-lesson-player-v2 data-scene-id={scene.id} className="min-h-dvh bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <header className="sticky z-30 border-b border-[var(--ll-border)] bg-[var(--ll-bg)]/95 backdrop-blur" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
          <Link href={exitHref} aria-label="Leave lesson" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[var(--ll-border)]"><ChevronLeft size={20} aria-hidden="true" /></Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-5">{experience.title}</p>
            <p className="text-xs text-[var(--ll-text-muted)]">Scene {index + 1} of {experience.scenes.length} · {TYPE_LABEL[scene.type]}</p>
          </div>
          {experience.authority.status !== "APPROVED_RELEASE" && <span className="hidden shrink-0 rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text-muted)] sm:inline">Internal prototype</span>}
        </div>
        <div role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentComplete(experience, progress)} className="h-1 w-full bg-[var(--ll-border)]">
          <div className="h-1 bg-[var(--ll-accent)] motion-safe:transition-[width]" style={{ width: `${percentComplete(experience, progress)}%` }} />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 pt-6 lg:grid-cols-[220px_minmax(0,1fr)_260px]" style={{ paddingBottom: footerHeight + 32 }}>
        <nav aria-label="Lesson outline" className="hidden lg:block">
          <ol className="sticky top-24 space-y-1">
            {experience.scenes.map((candidate, candidateIndex) => {
              const done = progress.completedSceneIds.includes(candidate.id);
              const reachable = candidateIndex <= furthest;
              return (
                <li key={candidate.id}>
                  <button type="button" disabled={!reachable} aria-current={candidateIndex === index ? "step" : undefined} onClick={() => update((current) => goToScene(experience, current, candidate.id))}
                    className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm ${candidateIndex === index ? "bg-[var(--ll-surface)] font-semibold" : "text-[var(--ll-text-muted)]"} disabled:opacity-40`}>
                    <span aria-hidden="true" className="w-4">{done ? <Check size={14} /> : candidateIndex + 1}</span>
                    <span className="truncate">{candidate.title}</span>
                    {done && <span className="sr-only">(done)</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <main id="lesson-scene" className="min-w-0">
          <article aria-labelledby="scene-title" className="mx-auto max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ll-accent)]">{TYPE_LABEL[scene.type]}</p>
            <h1 id="scene-title" ref={headingRef} tabIndex={-1} className="mt-2 text-2xl font-semibold leading-tight outline-none sm:text-3xl">{scene.title}</h1>
            <div className="mt-5"><SceneBody scene={scene} ageBand={band} /></div>
            <DiagramReveal scene={scene} progress={progress} onReveal={(stepId) => update((current) => revealStep(current, scene.id, stepId))} />
            <FormativeCheck scene={scene} progress={progress} onAnswer={(itemId, value) => update((current) => recordResponse(current, scene.id, itemId, value))} />
            {scene.type === "LAB" && <LabScene scene={scene} lab={link ? labs[link.experience.labId] ?? null : null} link={link} progress={progress} online={online} onLaunch={() => void launchLab()} onFallback={() => update(chooseLabFallback)} />}
            <ReflectionPrompts scene={scene} progress={progress} onWrite={(promptId, text) => update((current) => recordResponse(current, scene.id, promptId, text))} />
            <AssessmentHandoffSeam scene={scene} progress={progress} submitted={!!submitted} onAnswer={(itemId, value) => update((current) => recordResponse(current, scene.id, itemId, value))} />
            {submitted && (
              <section role="status" aria-labelledby="handoff-title" className="mt-6 rounded-2xl border border-[var(--ll-accent)] bg-[var(--ll-surface)] p-5">
                <h2 id="handoff-title" className="text-lg font-semibold">Lesson finished</h2>
                <p className="mt-2 text-base leading-7">Your answers and lab work are ready as {submitted.observations.length} observations for your learning plan. Your next step is chosen by your learning plan, not by this lesson.</p>
                <p className="mt-2 text-xs leading-5 text-[var(--ll-text-muted)]" data-evidence-dispositions={submitted.observations.map((o) => o.disposition).join(" ")}>
                  Prototype: nothing is sent, saved or scored. In a released lesson these observations go to the school&apos;s evidence system; here each one is a raw observation because this lesson and lab are not released.
                </p>
                <Link href="/student/learn" className="mt-4 inline-flex min-h-12 items-center rounded-xl bg-[var(--ll-accent)] px-5 py-3 text-base font-semibold text-[var(--ll-bg)]">See my next step</Link>
              </section>
            )}
            <details className="mt-8 rounded-2xl border border-[var(--ll-border)] p-4 lg:hidden">
              <summary className="min-h-11 cursor-pointer text-base font-semibold">Tools, goal and help</summary>
              <div className="mt-4">{contextPanel}</div>
            </details>
          </article>
        </main>

        <aside aria-label="Lesson context" className="hidden lg:block"><div className="sticky top-24">{contextPanel}</div></aside>
      </div>

      <footer ref={footerRef} className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--ll-border)] bg-[var(--ll-bg)]/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {!complete && <p id="continue-hint" className="mx-auto max-w-2xl px-4 pt-2 text-center text-sm leading-5 text-[var(--ll-text-muted)]">{BLOCKED_HINT[scene.completion.kind]}</p>}
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <button type="button" onClick={() => update((current) => retreat(experience, current))} disabled={index === 0} className="inline-flex min-h-12 items-center gap-1 rounded-xl border border-[var(--ll-border)] px-4 py-3 text-base font-semibold disabled:opacity-40">
            <ChevronLeft size={18} aria-hidden="true" /> Previous
          </button>
          {isLast ? (
            <button type="button" onClick={finish} disabled={!complete || !!submitted} aria-describedby={complete ? undefined : "continue-hint"} className="inline-flex min-h-12 items-center gap-1 rounded-xl bg-[var(--ll-accent)] px-5 py-3 text-base font-semibold text-[var(--ll-bg)] disabled:opacity-40">
              {submitted ? "Finished" : "Finish"} <Check size={18} aria-hidden="true" />
            </button>
          ) : (
            <button type="button" onClick={() => update((current) => advance(experience, current))} disabled={!complete} aria-describedby={complete ? undefined : "continue-hint"} className="inline-flex min-h-12 items-center gap-1 rounded-xl bg-[var(--ll-accent)] px-5 py-3 text-base font-semibold text-[var(--ll-bg)] disabled:opacity-40">
              Continue <ChevronRight size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
