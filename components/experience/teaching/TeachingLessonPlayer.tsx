"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, CircleHelp, Lightbulb } from "lucide-react";
import { FocusedHeader, LearningStage, StageFooter } from "@/components/experience/FocusedLearning";
import { TeachingPoints, TeachingScene } from "@/components/experience/TeachingScene";
import { StateNotice } from "@/components/experience/StateNotice";
import { Chip } from "@/components/experience/Frame";
import { InlineText } from "@/components/experience/LessonText";
import { TeachingBlockView } from "./TeachingBlocks";
import { ReadAloud } from "./ReadAloud";
import { TEACHING_SCENE_KIND_LABEL, requiresInteraction, sceneBlocks, type TeachingAvailability, type TeachingLesson } from "@/lib/learner-experience/teaching/contract";
import "@/components/experience/lesson.css";

const SUBJECT_LABEL: Record<TeachingLesson["subject"], string> = { MATHEMATICS: "Mathematics", SCIENCE: "Science", ENGLISH: "English", SOCIAL_STUDIES: "Social Studies" };
const BAND: Record<TeachingLesson["ageBand"], "young" | "middle"> = { EARLY_PRIMARY: "young", UPPER_PRIMARY: "middle", JUNIOR_SECONDARY: "middle", SENIOR_SECONDARY: "middle" };

/**
 * Plays a TeachingLesson (structured teaching scenes with visual blocks) on the shared focused-learning stage.
 * Presentation only: its status chip and notices come from the `availability` the server computed from the
 * published registry, and in this change it is mounted only by the dev-only design preview. It makes no request,
 * writes no storage, records no completion and never changes mastery; interactive blocks gate Continue
 * locally so learners actually do the step before moving on.
 */
export function TeachingLessonPlayer({ lesson, availability, initialSceneId, backHref = "/student/learn", backLabel = "Back to Learn", moreHref }: {
  lesson: TeachingLesson;
  /** From the published-release registry, computed server side (lib/learner-experience/teaching/availability.ts). */
  availability: TeachingAvailability;
  initialSceneId?: string | null;
  backHref?: string;
  backLabel?: string;
  /** Where the final scene's "more lessons" action goes (the preview gallery in the design preview). */
  moreHref?: string;
}) {
  const startIndex = Math.max(0, lesson.scenes.findIndex((scene) => scene.id === initialSceneId));
  const [index, setIndex] = useState(startIndex);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [passed, setPassed] = useState<Set<string>>(() => new Set(lesson.scenes.slice(0, startIndex).map((scene) => scene.id)));
  const [hintOpen, setHintOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const [footerHeight, setFooterHeight] = useState(96);
  const footerObserver = useRef<ResizeObserver | null>(null);
  const footerRef = useCallback((node: HTMLElement | null) => {
    footerObserver.current?.disconnect();
    if (!node) return;
    const sync = () => setFooterHeight(Math.ceil(node.getBoundingClientRect().height));
    sync();
    if (typeof ResizeObserver === "function") { footerObserver.current = new ResizeObserver(sync); footerObserver.current.observe(node); }
  }, []);
  // Lesson-scoped measure of the fixed footer, so bounded rails stop above it.
  useEffect(() => { document.documentElement.style.setProperty("--ll-fixed-footer", `${footerHeight}px`); }, [footerHeight]);
  useEffect(() => () => { document.documentElement.style.removeProperty("--ll-fixed-footer"); }, []);
  useEffect(() => {
    setHintOpen(false);
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [index]);
  const onDone = useCallback((blockId: string, value: boolean) => setDone((current) => (current[blockId] === value ? current : { ...current, [blockId]: value })), []);

  const scene = lesson.scenes[index];
  const pending = useMemo(() => sceneBlocks(scene).filter(requiresInteraction).filter((block) => !done[block.id]), [scene, done]);
  const blocked = passed.has(scene.id) || pending.length === 0 ? null : pending[0].type === "STEP_REVEAL" ? "Show every step of the example to continue." : pending[0].type === "DIGIT_CARDS" ? "Make the number with the digit cards to continue." : pending[0].type === "SORT" ? "Sort every word into the right group to continue." : pending[0].type === "SEQUENCE" ? "Put the events in the right order to continue." : "Answer every question to continue.";
  const isLast = index === lesson.scenes.length - 1;
  const titleId = "teaching-scene-title";
  const goTo = (next: number) => { if (next > index) setPassed((current) => new Set(current).add(scene.id)); setIndex(next); };
  const furthest = Math.max(index, ...lesson.scenes.map((candidate, position) => (passed.has(candidate.id) ? position + 1 : 0)));
  const objectives = lesson.objectives.filter((objective) => scene.objectiveIds.includes(objective.id));
  const isPreview = availability.label !== "RELEASED";

  const support = <>
    <section aria-labelledby="teach-goal"><h2 id="teach-goal">This scene helps you</h2>
      <ul className="mt-2 grid gap-2 text-[15px] leading-6">{objectives.map((objective) => <li key={objective.id}>{objective.statement}</li>)}</ul>
    </section>
    {scene.hint && <section aria-labelledby="teach-hint"><h2 id="teach-hint">Hint</h2>
      {hintOpen
        ? <p className="ll4-hint mt-2" role="status"><Lightbulb size={16} aria-hidden="true" /> <InlineText text={scene.hint} /></p>
        : <button type="button" className="ll3-btn mt-2 w-full" onClick={() => setHintOpen(true)}><Lightbulb size={18} aria-hidden="true" /> Show a hint</button>}
    </section>}
    <section aria-labelledby="teach-listen"><h2 id="teach-listen">Listen</h2><div className="mt-2"><ReadAloud text={`${scene.title}. ${scene.textAlternative}`} sceneId={scene.id} /></div></section>
    <section aria-labelledby="teach-help"><h2 id="teach-help" className="flex items-center gap-2"><CircleHelp size={14} aria-hidden="true" /> Ask for help</h2>
      <p className="mt-2 text-[15px] leading-6 text-[var(--ll-text-muted)]">{isPreview
        ? "The tutor answers questions about lessons you are signed in to. This preview is not connected to it, so nothing you do here is sent."
        : "Ask your teacher, or the tutor from your lesson page."}</p>
    </section>
    <section aria-labelledby="teach-about"><h2 id="teach-about">About this lesson</h2>
      <p className="mt-2 text-[15px] leading-6" data-availability={availability.label}>{availability.reason}</p>
    </section>
  </>;

  return <div className="ll3-scope ll3-focus ll4-teaching" data-age-band={BAND[lesson.ageBand]} data-demo-lesson={availability.label === "DEMO" ? "" : undefined} data-teaching-lesson={lesson.id} data-availability={availability.label} data-scene-id={scene.id}>
    <FocusedHeader backHref={backHref} backLabel={backLabel} title={lesson.title}
      context={`Grade ${lesson.grade} · ${SUBJECT_LABEL[lesson.subject]} · ${lesson.topic}`}
      extra={availability.label !== "RELEASED" ? <Chip tone="demo">{availability.chip}</Chip> : undefined}
      progress={{ value: ((index + 1) / lesson.scenes.length) * 100, label: "Position in this lesson" }} />
    <LearningStage bottomSpace={footerHeight} mainLabelledBy={titleId} supportLabel="Lesson help" support={support} outlineSummary={`Scene ${index + 1} of ${lesson.scenes.length} · ${scene.title}`}
      outline={<ol className="ll3-outline-list">{lesson.scenes.map((candidate, position) => <li key={candidate.id}>
        <button type="button" aria-current={position === index ? "step" : undefined} data-done={passed.has(candidate.id) ? "" : undefined} onClick={() => goTo(position)} disabled={position > furthest || (position > index && Boolean(blocked))}>
          <span className="ll3-outline-num" aria-hidden="true">{passed.has(candidate.id) ? <Check size={14} /> : position + 1}</span><span className="min-w-0">{candidate.title}</span>
        </button>
      </li>)}</ol>}>
      {index === 0 && isPreview && <div className="mb-6"><StateNotice kind="preview" title={availability.label === "DEMO" ? "Design demo with synthetic content" : "Candidate content, not released"}>{availability.reason} Nothing here is saved, sent, marked or counted as completion or mastery.</StateNotice></div>}
      <TeachingScene kind={TEACHING_SCENE_KIND_LABEL[scene.kind]} title={scene.title} titleId={titleId} titleRef={headingRef} headingLevel={1}
        lead={<InlineText text={scene.lead} />}
        visual={scene.visual ? <TeachingBlockView key={`${scene.id}-visual`} block={scene.visual} onDone={onDone} /> : undefined}
        className="ll4-scene">
        {scene.points && scene.points.length > 0 && <TeachingPoints label={scene.kind === "REVIEW" ? "Key takeaways" : scene.kind === "INTRODUCTION" ? "In this lesson you will" : "Key points"} items={scene.points.map((point, position) => <InlineText key={position} text={point} />)} />}
        {scene.blocks.map((block, position) => <TeachingBlockView key={`${scene.id}-${position}`} block={block} onDone={onDone} />)}
        {isLast && <section className="ll4-next" aria-labelledby="teach-next">
          <h2 id="teach-next" className="ll3-panel-title">What next</h2>
          {finished
            ? <StateNotice kind="preview" title={availability.label === "DEMO" ? "Demo finished" : "Lesson finished on this page"}>Nothing was saved, sent or marked. A released lesson hands your work to your school&apos;s systems; this {isPreview ? "preview" : "page"} does not.</StateNotice>
            : <p className="ll3-muted">Finish to close this lesson. Your next step comes from your learning plan, not from this {isPreview ? "preview" : "page"}.</p>}
          <div className="ll4-row"><Link className="ll3-btn" href={backHref}>{backLabel}</Link>{moreHref && <Link className="ll3-btn" href={moreHref}>More preview lessons</Link>}</div>
        </section>}
      </TeachingScene>
    </LearningStage>
    <StageFooter footerRef={footerRef} index={index} total={lesson.scenes.length}
      onPrevious={() => goTo(Math.max(0, index - 1))} previousDisabled={index === 0}
      hint={blocked ?? undefined} hintId="teaching-continue-hint"
      states={lesson.scenes.map((candidate, position) => position === index ? "current" : passed.has(candidate.id) ? "done" : "todo")}
      next={isLast
        ? <button type="button" className="ll3-btn" data-primary="" disabled={finished || Boolean(blocked)} onClick={() => setFinished(true)}>{finished ? (availability.label === "DEMO" ? "Demo finished" : "Finished") : (availability.label === "DEMO" ? "Finish demo" : "Finish")} <Check size={18} aria-hidden="true" /></button>
        : <button type="button" className="ll3-btn" data-primary="" disabled={Boolean(blocked)} aria-describedby={blocked ? "teaching-continue-hint" : undefined} onClick={() => goTo(index + 1)}>Continue <ChevronRight size={18} aria-hidden="true" /></button>} />
  </div>;
}
