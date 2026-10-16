"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, CircleHelp, Flag, Wrench } from "lucide-react";
import type { AgeBand, LessonExperience, Scene } from "@/lib/learner-experience/types";
import { isLinkStudentVisible, type LearningExperienceLink } from "@/lib/learner-experience/links";
import type { LabExperience } from "@/lib/learner-experience/labExperience";
import type { SceneToolView } from "@/lib/learner-experience/tools";
import { advance, applyLabReturn, chooseLabFallback, goToScene, isSceneComplete, markLabLaunched, pendingLabSceneId, percentComplete, recordResponse, restoreProgress, retreat, revealStep, sceneIndexOf, type ExperienceProgress } from "@/lib/learner-experience/progress";
import { buildLabLaunchHref, buildStudentLabLaunchHref, isLabReturnObservation, labReturnStorageKey, type LabLaunchContext, type LabReturnObservation } from "@/lib/learner-experience/labLaunch";
import { buildEvidenceEnvelope, type ExperienceEvidenceEnvelope } from "@/lib/learner-experience/evidenceHandoff";
import { isSafeRuntimeId, type EvidenceChannel, type EvidenceReceipt, type LessonRouteTarget, type LessonRuntimeAvailability, type LessonRuntimeIdentity, type RuntimeLabLink } from "@/lib/learner-experience/lessonRuntime";
import { loadExperienceProgress, saveExperienceProgress } from "@/lib/learner-experience/progressStore";
import { TOOL_COMPONENTS } from "@/components/toolkit/toolComponents";
import { AssessmentHandoffSeam, DiagramReveal, FormativeCheck, ReflectionPrompts, SceneBody, SceneMediaList } from "./SceneViews";
import { LabScene, type LabSceneView } from "./LabScene";
import { LearningStage, StageFooter } from "@/components/experience/FocusedLearning";
import { AskTutorButton } from "@/components/experience/AskTutorButton";
import { sceneAllowsTutor } from "@/lib/learner-experience/assistancePolicy";
import type { TutorIdentity } from "@/lib/ai/tutor/contextContract";

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

/**
 * A student lesson served by the server (live or a signed offline copy). Everything here is stated by the
 * server; the player only presents it. Without it the player runs the internal prototype.
 */
export type LessonPlayerRuntime = Readonly<{
  identity: LessonRuntimeIdentity;
  availability: LessonRuntimeAvailability;
  target: LessonRouteTarget;
  labLinks: readonly RuntimeLabLink[];
  evidence: EvidenceChannel;
  /** The server's evidence disposition for this delivery, shown as given (never upgraded here). */
  evidenceDisposition: string | null;
  serverCompletion: Readonly<{ completedAt: string }> | null;
}>;

/** What happened when the learner finished. Never a score and never mastery. */
type FinishState =
  | Readonly<{ status: "PROTOTYPE"; envelope: ExperienceEvidenceEnvelope }>
  | Readonly<{ status: "PRESENTATION_ONLY" }>
  | Readonly<{ status: "READ_ONLY" }>
  | Readonly<{ status: "PENDING"; reason: "OFFLINE" | "FAILED" }>
  | Readonly<{ status: "SENDING" }>
  | Readonly<{ status: "SENT"; receipt: EvidenceReceipt }>;

export type LessonPlayerV2Props = {
  experience: LessonExperience;
  /** Internal prototype: governed links and lab definitions. A student runtime uses `runtime.labLinks`. */
  links?: readonly LearningExperienceLink[];
  labs?: Readonly<Record<string, LabExperience>>;
  toolsByScene: Readonly<Record<string, readonly SceneToolView[]>>;
  basePath?: string;
  exitHref: string;
  /** From the URL after a lab return: the scene to restore. */
  returnSceneId: string | null;
  ageBand?: AgeBand;
  /**
   * STUDENT (default): a lab opens only for an APPROVED link to a RELEASED lab in an approved lesson;
   * anything else shows the scene's text walkthrough. INTERNAL_PREVIEW is for dev-only review routes.
   */
  linkPolicy?: "STUDENT" | "INTERNAL_PREVIEW";
  runtime?: LessonPlayerRuntime;
};

const NO_LINKS: readonly LearningExperienceLink[] = [];
const NO_LABS: Readonly<Record<string, LabExperience>> = {};

export function LessonPlayerV2({ experience, links = NO_LINKS, labs = NO_LABS, toolsByScene, basePath, exitHref, returnSceneId, ageBand, linkPolicy = "STUDENT", runtime }: LessonPlayerV2Props) {
  const router = useRouter();
  const online = useOnline();
  const band = ageBand ?? experience.ageBand;
  const [progress, setProgress] = useState<ExperienceProgress | null>(null);
  const [openTool, setOpenTool] = useState<string | null>(null);
  const [finished, setFinished] = useState<FinishState | null>(null);
  const [restartedForNewVersion, setRestartedForNewVersion] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restoredScene = useRef<string | null>(null);
  const readOnly = runtime?.availability === "CACHED_READ_ONLY";

  /** The lab link a LAB scene may use, and whether the hand-back for it may be accepted. */
  const sceneLab = useCallback((scene: Scene): { linkId: string; labId: string; view: LabSceneView; launchable: boolean } | null => {
    if (scene.interaction.kind !== "LAB_LAUNCH") return null;
    const linkId = scene.interaction.linkId;
    if (runtime) {
      // Server-authorized only. The lab route re-checks its own authorization when it opens.
      const link = runtime.labLinks.find((candidate) => candidate.linkId === linkId && candidate.sceneId === scene.id);
      if (!link) return null;
      // Launchable only live, and only when the lesson address can be rebuilt as the lab's return target.
      const returnId = runtime.target.kind === "CONTENT" ? runtime.target.contentId : runtime.target.scheduledWorkId;
      return { linkId, labId: link.labId, view: { title: link.title, summary: link.summary, draft: false, degradation: null, tripNarrative: false }, launchable: runtime.availability === "CURRENT" && isSafeRuntimeId(returnId) };
    }
    const placed = links.find((candidate) => candidate.linkId === linkId) ?? null;
    const lab = placed ? labs[placed.experience.labId] ?? null : null;
    if (!placed || !lab || (linkPolicy !== "INTERNAL_PREVIEW" && !isLinkStudentVisible(placed, experience, lab))) return null;
    return { linkId, labId: lab.labId, view: { title: lab.title, summary: lab.summary || null, draft: lab.release.status !== "RELEASED", degradation: lab.offline.degradation, tripNarrative: true }, launchable: true };
  }, [runtime, links, labs, linkPolicy, experience]);
  // The resume effect reads the latest resolver without re-running when a parent re-renders.
  const sceneLabRef = useRef(sceneLab);
  sceneLabRef.current = sceneLab;

  // Resume is keyed by stable identity: an equal lesson re-delivered by a refetch never resets the learner.
  const experienceRef = useRef(experience);
  experienceRef.current = experience;
  const identityKey = `${experience.id}@${experience.version}`;

  // Resume: saved position (partitioned IndexedDB), then any lab hand-back for this lesson.
  useEffect(() => {
    let cancelled = false;
    const experience = experienceRef.current;
    void (async () => {
      const saved = await loadExperienceProgress(experience.id).catch(() => null);
      // A superseded run must not consume the one-shot lab hand-back slot.
      if (cancelled) return;
      let next = restoreProgress(experience, saved);
      // Saved work from another version of this lesson is not mapped onto changed scenes: say so plainly.
      const savedVersion = saved && typeof saved === "object" ? (saved as { experienceId?: unknown; experienceVersion?: unknown }) : null;
      setRestartedForNewVersion(Boolean(savedVersion && savedVersion.experienceId === experience.id && typeof savedVersion.experienceVersion === "string" && savedVersion.experienceVersion !== experience.version));
      // A pending launch (return link or browser Back) is consumed. If IndexedDB lost the launch marker, a valid
      // hand-back with the return link still restores the scene. A reload of an old return URL has no hand-back
      // left, so it never pulls the learner backwards; the return parameters are also stripped from the address.
      const pending = pendingLabSceneId(next);
      const candidateSceneId = returnSceneId ?? pending;
      const candidateScene = experience.scenes.find((item) => item.id === candidateSceneId);
      const candidateLab = candidateScene ? sceneLabRef.current(candidateScene) : null;
      // The lab's one-shot hand-back, accepted only for the link placed on the scene being returned to.
      let observation: LabReturnObservation | null = null;
      try {
        const raw = window.sessionStorage.getItem(labReturnStorageKey(experience.id));
        const parsed = raw ? JSON.parse(raw) : null;
        if (isLabReturnObservation(parsed) && candidateLab && parsed.linkId === candidateLab.linkId && parsed.labId === candidateLab.labId) observation = parsed;
      } catch { /* storage unavailable */ }
      const labSceneId = candidateSceneId && (candidateSceneId === pending || observation) ? candidateSceneId : null;
      if (returnSceneId) window.history.replaceState(window.history.state, "", window.location.pathname);
      if (labSceneId) {
        try { window.sessionStorage.removeItem(labReturnStorageKey(experience.id)); } catch { /* storage unavailable */ }
        next = applyLabReturn(experience, next, labSceneId, observation);
      }
      if (!cancelled) setProgress(next);
    })();
    return () => { cancelled = true; };
  }, [identityKey, returnSceneId]);

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
  const tutorAllowed = sceneAllowsTutor(scene);
  const tutorIdentity = useMemo<TutorIdentity | undefined>(() => runtime ? {
    ...(runtime.target.kind === "CONTENT" ? { contentId: runtime.target.contentId } : { lessonId: runtime.target.scheduledWorkId }),
    lessonVersion: runtime.identity.contentVersion ?? runtime.identity.lessonVersion,
    ...(runtime.identity.revisionId ? { revisionId: runtime.identity.revisionId } : {}),
    experienceId: experience.id, experienceVersion: experience.version, sceneId: scene.id,
    objectiveIds: [...scene.objectiveIds],
  } : undefined, [runtime, experience.id, experience.version, scene.id, scene.objectiveIds]);
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("liberialearn:tutor-context", { detail: {
      pathname: window.location.pathname, identity: tutorIdentity ?? {}, blocked: !runtime || readOnly || !tutorAllowed,
    } }));
  }, [runtime, readOnly, tutorIdentity, tutorAllowed]);
  const complete = progress ? isSceneComplete(scene, progress) : false;
  const isLast = index === experience.scenes.length - 1;
  const furthest = progress ? Math.max(index, ...progress.completedSceneIds.map((id) => experience.scenes.findIndex((candidate) => candidate.id === id) + 1)) : 0;
  const lab = sceneLab(scene);
  const objectives = useMemo(() => experience.objectives.filter((objective) => scene.objectiveIds.includes(objective.id)), [experience.objectives, scene.objectiveIds]);
  const tools = toolsByScene[scene.id] ?? [];
  // A real picture or diagram (same-origin asset) earns the visual column; text alternatives stay in flow.
  const hasVisual = (scene.media ?? []).some((media) => (media.kind === "IMAGE" || media.kind === "DIAGRAM") && media.ref.startsWith("/") && !media.ref.startsWith("//"));

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
    if (!progress || !lab || !lab.launchable) return;
    // The objectives the lab serves: the governed link's own (prototype), else the LAB scene's server-stated ones.
    const placed = runtime ? null : links.find((candidate) => candidate.linkId === lab.linkId) ?? null;
    const objectiveIds = placed?.objectiveIds ?? (scene.objectiveIds.length ? scene.objectiveIds : experience.objectives.map((objective) => objective.id));
    const context: LabLaunchContext | undefined = runtime ? runtime.labLinks.find((link) => link.linkId === lab.linkId)?.launchContext : { v: 1, labId: lab.labId, linkId: lab.linkId, origin: { experienceId: experience.id, experienceVersion: experience.version, sceneId: scene.id, objectiveIds, activityId: experience.id } };
    if (!context) return;
    const launched = markLabLaunched(progress, scene.id);
    setProgress(launched);
    await saveExperienceProgress(launched).catch(() => undefined);
    router.push(runtime ? buildStudentLabLaunchHref(runtime.target, context) : buildLabLaunchHref(basePath ?? "", context));
  };

  /** Hand the observations to the server channel, only for the current server version and only online. */
  const submit = async (envelope: ExperienceEvidenceEnvelope) => {
    if (!runtime || runtime.evidence.status !== "SERVER") return;
    if (runtime.availability !== "CURRENT" || envelope.experienceId !== runtime.identity.lessonId || envelope.experienceVersion !== runtime.identity.lessonVersion) { setFinished({ status: "READ_ONLY" }); return; }
    if (!navigator.onLine) { setFinished({ status: "PENDING", reason: "OFFLINE" }); return; }
    setFinished({ status: "SENDING" });
    try {
      const receipt = await runtime.evidence.submit(envelope);
      setFinished(receipt.accepted ? { status: "SENT", receipt } : { status: "PENDING", reason: "FAILED" });
    } catch {
      setFinished({ status: "PENDING", reason: "FAILED" });
    }
  };

  const finish = () => {
    if (!progress || !complete) return;
    const done = advance(experience, progress);
    update(() => done);
    // Governed handoff: observations only. The existing authority decides what happens next.
    const envelope = buildEvidenceEnvelope(experience, done, links, labs);
    if (!runtime) { setFinished({ status: "PROTOTYPE", envelope }); return; }
    if (readOnly) { setFinished({ status: "READ_ONLY" }); return; }
    if (runtime.evidence.status === "PRESENTATION_ONLY") { setFinished({ status: "PRESENTATION_ONLY" }); return; }
    void submit(envelope);
  };

  const retrySend = () => {
    if (!progress) return;
    void submit(buildEvidenceEnvelope(experience, progress, links, labs));
  };

  if (!progress) {
    return <div className="min-h-dvh bg-[var(--ll-bg)] px-4 py-10" aria-busy="true"><p className="mx-auto max-w-2xl text-[var(--ll-text-muted)]">Loading your lesson…</p></div>;
  }

  const submittedOrLocked = finished !== null && finished.status !== "PENDING";
  const assessmentNote = !runtime ? undefined
    : readOnly ? "This is a saved copy. Your answers stay on this device and are not marked."
    : runtime.evidence.status === "SERVER" ? "Your answers are marked by your school's assessment system, not by this lesson."
    : "Your answers stay on this device. They are not marked or sent from this lesson yet.";

  const ToolComponent = openTool ? TOOL_COMPONENTS[openTool] : null;
  const contextPanel = (
    <div className="space-y-5">
      <section aria-labelledby="ctx-objective">
        <h2 id="ctx-objective" className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ll-text-muted)]">This scene helps you</h2>
        <ul className="mt-2 space-y-2">{objectives.map((objective) => <li key={objective.id} data-objective-id={objective.id} className="text-sm leading-6 text-[var(--ll-text)]">{objective.statement}</li>)}</ul>
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
          <li>{tutorAllowed && runtime && !readOnly
            ? <><AskTutorButton identity={tutorIdentity} /><p className="mt-1 text-[var(--ll-text-muted)]">{online ? "The tutor answers about this scene. Your place here is kept." : "The tutor needs a connection."}</p></>
            : <p>{!tutorAllowed ? "Work independently on this task. Tutor help is available in learning scenes." : "Tutor help requires an authorized online lesson."}</p>}</li>
          {!runtime && <li className="flex gap-2 text-[var(--ll-text-muted)]"><Flag size={14} className="mt-1 shrink-0" aria-hidden="true" /> Need your teacher? Released lessons connect here to the existing &quot;Flag for teacher&quot; path.</li>}
          <li className="text-[var(--ll-text-muted)]">{online ? "Your place is saved on this device." : `Offline: ${scene.offline.fallback}`}</li>
        </ul>
      </section>
    </div>
  );

  return (
    <div
      data-lesson-player-v2
      data-native-tutor-context={JSON.stringify({ identity: tutorIdentity ?? {}, blocked: !runtime || readOnly || !tutorAllowed })}
      data-lesson-id={experience.id}
      data-lesson-version={experience.version}
      data-scene-id={scene.id}
      data-scene-type={scene.type}
      data-objective-ids={scene.objectiveIds.join(" ")}
      data-availability={runtime?.availability ?? "PROTOTYPE"}
      data-evidence-disposition={runtime?.evidenceDisposition ?? undefined}
      data-release-id={runtime?.identity.releaseId ?? undefined}
      data-age-band={band}
      className="ll-lesson-v2 min-h-dvh bg-[var(--ll-bg)] text-[var(--ll-text)]"
    >
      <header className="sticky z-30 border-b border-[var(--ll-border)] bg-[var(--ll-bg)]/95 backdrop-blur" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="ll3-focus-bar">
          <Link href={exitHref} aria-label="Leave lesson" className="inline-flex min-h-[var(--pdv2-target,44px)] min-w-[var(--pdv2-target,44px)] items-center justify-center rounded-xl border border-[var(--ll-border)]"><ChevronLeft size={20} aria-hidden="true" /></Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-6">{experience.title}</p>
            <p className="text-sm text-[var(--ll-text-muted)]">Scene {index + 1} of {experience.scenes.length} · {TYPE_LABEL[scene.type]}</p>
          </div>
          {readOnly && <span className="shrink-0 rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text-muted)]">Saved copy</span>}
          {!runtime && experience.authority.status !== "APPROVED_RELEASE" && <span className="hidden shrink-0 rounded-full border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text-muted)] sm:inline">Internal prototype</span>}
        </div>
        <div role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentComplete(experience, progress)} className="h-1 w-full bg-[var(--ll-border)]">
          <div className="h-1 bg-[var(--ll-accent)] motion-safe:transition-[width]" style={{ width: `${percentComplete(experience, progress)}%` }} />
        </div>
      </header>

      <LearningStage
        mainId="lesson-scene"
        bottomSpace={footerHeight}
        outlineLabel="Lesson outline"
        outlineSummary={`Scene ${index + 1} of ${experience.scenes.length} · ${scene.title}`}
        outline={
          <ol className="ll3-outline-list">
            {experience.scenes.map((candidate, candidateIndex) => {
              const done = progress.completedSceneIds.includes(candidate.id);
              const reachable = candidateIndex <= furthest;
              return (
                <li key={candidate.id}>
                  <button type="button" disabled={!reachable} aria-current={candidateIndex === index ? "step" : undefined} data-done={done ? "" : undefined} onClick={() => update((current) => goToScene(experience, current, candidate.id))}>
                    <span aria-hidden="true" className="ll3-outline-num">{done ? <Check size={14} /> : candidateIndex + 1}</span>
                    <span className="min-w-0 truncate">{candidate.title}</span>
                    {done && <span className="sr-only">(done)</span>}
                  </button>
                </li>
              );
            })}
          </ol>
        }
        supportLabel="Lesson help"
        support={contextPanel}
      >
        <article aria-labelledby="scene-title" className="ll3-scene" data-has-visual={hasVisual ? "" : undefined}>
          {runtime && (readOnly || restartedForNewVersion || !online) && (
            <div role="status" className="space-y-2 rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm leading-6 text-[var(--ll-text)]" data-runtime-notice>
              {readOnly && <p>You are using a saved copy of this lesson. You can read and practise, but nothing is sent from it and labs cannot open. Connect to the internet to open the current version.</p>}
              {!readOnly && !online && <p>You are offline. You can keep going; nothing is sent until you are back online.</p>}
              {restartedForNewVersion && <p>This lesson was updated since you last opened it, so it starts again from the beginning. Your earlier answers were for the older version.</p>}
            </div>
          )}
          <div>
            <p className="ll3-scene-kind">{TYPE_LABEL[scene.type]}</p>
            <h1 id="scene-title" ref={headingRef} tabIndex={-1} className="ll3-scene-title">{scene.title}</h1>
          </div>
          {runtime && index === 0 && experience.objectives.length > 0 && (
            <section aria-labelledby="lesson-goals" className="ll3-panel max-w-[68ch]">
              <h2 id="lesson-goals" className="text-lg font-semibold">In this lesson you will</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-base leading-7">{experience.objectives.map((objective) => <li key={objective.id} data-objective-id={objective.id}>{objective.statement}</li>)}</ul>
            </section>
          )}
          <div className="ll3-scene-body">
            <div className="ll3-scene-text">
              <SceneBody scene={scene} ageBand={band} />
              {!hasVisual && <SceneMediaList scene={scene} />}
              <DiagramReveal scene={scene} progress={progress} onReveal={(stepId) => update((current) => revealStep(current, scene.id, stepId))} />
              <FormativeCheck scene={scene} progress={progress} onAnswer={(itemId, value) => update((current) => recordResponse(current, scene.id, itemId, value))} />
              {scene.type === "LAB" && <LabScene scene={scene} view={lab?.view ?? null} launchable={!!lab?.launchable} progress={progress} online={online} onLaunch={() => void launchLab()} onFallback={() => update((current) => chooseLabFallback(current, scene.id))} />}
              <ReflectionPrompts scene={scene} progress={progress} onWrite={(promptId, text) => update((current) => recordResponse(current, scene.id, promptId, text))} />
              <AssessmentHandoffSeam scene={scene} progress={progress} submitted={submittedOrLocked} note={assessmentNote} onAnswer={(itemId, value) => update((current) => recordResponse(current, scene.id, itemId, value))} />
            </div>
            {hasVisual && <div className="ll3-scene-visual"><SceneMediaList scene={scene} /></div>}
          </div>
          {finished && <FinishedPanel finished={finished} runtime={runtime} exitHref={exitHref} online={online} onRetry={retrySend} />}
        </article>
      </LearningStage>

      <StageFooter
        footerRef={footerRef}
        index={index}
        total={experience.scenes.length}
        onPrevious={() => update((current) => retreat(experience, current))}
        previousDisabled={index === 0}
        hint={!complete ? BLOCKED_HINT[scene.completion.kind] || undefined : undefined}
        hintId="continue-hint"
        states={experience.scenes.map((candidate, candidateIndex) => candidateIndex === index ? "current" : progress.completedSceneIds.includes(candidate.id) ? "done" : "todo")}
        next={isLast ? (
          <button type="button" onClick={finish} disabled={!complete || !!finished} aria-describedby={complete ? undefined : "continue-hint"} className="ll3-btn" data-primary="">
            {finished ? "Finished" : "Finish"} <Check size={18} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={() => update((current) => advance(experience, current))} disabled={!complete} aria-describedby={complete ? undefined : "continue-hint"} className="ll3-btn" data-primary="">
            Continue <ChevronRight size={18} aria-hidden="true" />
          </button>
        )}
      />
    </div>
  );
}

const DISPOSITION_LABEL: Record<string, string> = {
  RAW_OBSERVATION: "kept as a note",
  PROVISIONAL: "added to your learning record",
  SUBMIT_TO_ASSESSMENT_AUTHORITY: "sent for marking",
};

/** Lesson end. Shows only what is true: what was sent (and the server's answer), or that nothing was. */
function FinishedPanel({ finished, runtime, exitHref, online, onRetry }: { finished: FinishState; runtime?: LessonPlayerRuntime; exitHref: string; online: boolean; onRetry: () => void }) {
  const completion = runtime?.serverCompletion ? new Date(runtime.serverCompletion.completedAt) : null;
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Finish is pressed in the fixed footer: bring the outcome into view (it is below the questions on a phone).
  useEffect(() => {
    if (!runtime) return;
    headingRef.current?.scrollIntoView?.({ block: "center" });
    headingRef.current?.focus({ preventScroll: true });
  }, [runtime, finished.status]);
  return (
    <section role="status" aria-labelledby="handoff-title" data-finish-state={finished.status} className="mt-6 rounded-2xl border border-[var(--ll-accent)] bg-[var(--ll-surface)] p-5">
      <h2 id="handoff-title" ref={headingRef} tabIndex={-1} className="text-lg font-semibold outline-none">Lesson finished</h2>
      {finished.status === "PROTOTYPE" && <>
        <p className="mt-2 text-base leading-7">Your answers and lab work are ready as {finished.envelope.observations.length} observations for your learning plan. Your next step is chosen by your learning plan, not by this lesson.</p>
        <p className="mt-2 text-xs leading-5 text-[var(--ll-text-muted)]" data-evidence-dispositions={finished.envelope.observations.map((o) => o.disposition).join(" ")}>
          Prototype: nothing is sent, saved or scored. In a released lesson these observations go to the school&apos;s evidence system; here each one is a raw observation because this lesson and lab are not released.
        </p>
      </>}
      {finished.status === "PRESENTATION_ONLY" && <p className="mt-2 text-base leading-7">You reached the end. Your progress is saved on this device only: this lesson does not send your answers to your teacher or your learning record yet, and it does not decide what you have mastered.</p>}
      {finished.status === "READ_ONLY" && <p className="mt-2 text-base leading-7">You finished a saved copy of this lesson. Nothing was sent from it. Connect to the internet and open the lesson again to work in the current version.</p>}
      {finished.status === "SENDING" && <p className="mt-2 text-base leading-7">Sending your work…</p>}
      {finished.status === "PENDING" && <>
        <p className="mt-2 text-base leading-7">{finished.reason === "OFFLINE" ? "You are offline, so your work has not been sent. It stays on this device." : "Your work could not be sent. It stays on this device."}</p>
        <button type="button" onClick={onRetry} disabled={!online} className="mt-3 min-h-[var(--pdv2-target,48px)] rounded-xl border border-[var(--ll-border)] px-4 py-2 text-base font-semibold disabled:opacity-50">Try sending again</button>
      </>}
      {finished.status === "SENT" && <>
        <p className="mt-2 text-base leading-7">Your work was sent. Your next step is chosen by your learning plan, not by this lesson.</p>
        {finished.receipt.dispositions.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--ll-text-muted)]" data-evidence-dispositions={finished.receipt.dispositions.map((d) => d.disposition).join(" ")}>
            {finished.receipt.dispositions.map((d) => <li key={d.observationId}>One part of your work was {DISPOSITION_LABEL[d.disposition] ?? "received"}.</li>)}
          </ul>
        )}
      </>}
      {completion && !Number.isNaN(completion.getTime()) && <p className="mt-2 text-sm leading-6 text-[var(--ll-text-muted)]" data-server-completion>Your class record shows this lesson as completed.</p>}
      <Link href={runtime ? exitHref : "/student/learn"} className="mt-4 inline-flex min-h-[var(--pdv2-target,48px)] items-center rounded-xl bg-[var(--ll-accent)] px-5 py-3 text-base font-semibold text-[var(--ll-bg)]">{runtime ? "Back to my lessons" : "See my next step"}</Link>
    </section>
  );
}
