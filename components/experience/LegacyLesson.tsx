"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SECTION_ROLE_LABEL, sectionRole, teachingParts, type LessonBlock, type LessonSection } from "@/lib/learner-experience/lessonText";
import { InlineText, LessonBlocks, LessonImage, LessonTable } from "./LessonText";
import { LearnerTask, TeachingPoints, TeachingScene, WorkedExample } from "./TeachingScene";

/**
 * LEGACY lesson presentation (Read and Slides) for the existing student lesson routes. Everything shown
 * comes from the lesson's own text, in its own order: section roles are read from authored headings and
 * nothing is generated. This is a presentation of legacy content, not a native Lesson Experience.
 */

/** Read mode: contents, a readable text column and a clear move on to examples and practice. */
export function LegacyReading({ sections, objectives, tools, after, html, title }: {
  sections: readonly LessonSection[];
  objectives?: readonly string[];
  tools?: ReactNode;
  after?: ReactNode;
  /** Sanitized HTML (teacher-created bodies) rendered instead of parsed sections. */
  html?: string | null;
  title: string;
}) {
  const [current, setCurrent] = useState<string | null>(sections[0]?.id ?? null);
  const [contentsOpen, setContentsOpen] = useState(false);
  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setCurrent(visible.target.id);
    }, { rootMargin: "-20% 0px -60% 0px" });
    for (const section of sections) { const node = document.getElementById(section.id); if (node) observer.observe(node); }
    return () => observer.disconnect();
  }, [sections]);
  const showContents = !html && sections.length > 1;
  return <div className="ll3-read-layout" data-tools={tools ? "" : undefined} data-reading-layout>
    {showContents && <div className="ll3-read-contents ll3-contents">
      <button type="button" className="ll3-contents-toggle w-full" aria-expanded={contentsOpen} aria-controls="lesson-contents" onClick={() => setContentsOpen((open) => !open)}>
        Contents · {sections.length} sections
      </button>
      <div id="lesson-contents" className={contentsOpen ? "mt-2" : "hidden"}>
        <nav aria-label="Lesson contents">
          <p className="ll3-contents-title" aria-hidden="true">Contents</p>
          <ol className="ll3-outline-list">{sections.map((section, index) => <li key={section.id}>
            <a href={`#${section.id}`} aria-current={current === section.id ? "location" : undefined} onClick={() => setContentsOpen(false)}>
              <span className="ll3-outline-num" aria-hidden="true">{index + 1}</span><span className="min-w-0"><InlineText text={section.title} /></span>
            </a>
          </li>)}</ol>
        </nav>
      </div>
    </div>}
    <article className="ll3-read-main" aria-label={`${title}: reading`}>
      {objectives && objectives.length > 0 && <section aria-labelledby="read-goals" className="ll3-panel mb-8 max-w-[var(--ll-measure)]">
        <h2 id="read-goals" className="ll3-panel-title">In this lesson you will</h2>
        <div className="ll3-reading"><ul>{objectives.map((objective, index) => <li key={index}>{objective}</li>)}</ul></div>
      </section>}
      {html
        ? <div className="ll3-reading" dangerouslySetInnerHTML={{ __html: html }} />
        : sections.map((section, index) => {
          const role = sectionRole(section.title, index);
          const headed = sections.length > 1 || section.title !== title;
          return <section key={section.id} id={section.id} className="ll3-section" data-role={role} aria-labelledby={headed ? `${section.id}-h` : undefined}>
            {headed && <><span className="ll3-section-role" aria-hidden="true">{SECTION_ROLE_LABEL[role]}</span>
              <h2 id={`${section.id}-h`} className="ll3-section-title"><InlineText text={section.title} /></h2></>}
            <div className="ll3-reading mt-3"><LessonBlocks blocks={section.blocks} headingOffset={1} /></div>
          </section>;
        })}
      {after && <div className="mt-10 max-w-[var(--ll-measure)]">{after}</div>}
    </article>
    {tools && <aside className="ll3-read-tools" aria-label="Reading tools"><div className="ll3-support">{tools}</div></aside>}
  </div>;
}

export type LegacySlide = { title: string; blocks: readonly LessonBlock[] };

/** One legacy slide presented as a teaching scene, parts taken only from the slide's own blocks. */
export function LegacySlideScene({ slide, index, titleId }: { slide: LegacySlide; index: number; titleId: string }) {
  const role = sectionRole(slide.title, index);
  const { lead, points, steps, visuals, rest } = teachingParts(slide.blocks);
  const visual = visuals.length > 0 ? <>{visuals.map((block, position) => block.kind === "table" ? <LessonTable key={position} block={block} caption={slide.title} /> : <LessonImage key={position} block={block} />)}</> : undefined;
  const leadNode = lead ? <InlineText text={lead.text} /> : undefined;
  const restNode = rest.length > 0 ? <div className="ll3-reading"><LessonBlocks blocks={rest} headingOffset={1} /></div> : null;
  const pointItems = (points?.items ?? []).map((item, position) => <InlineText key={position} text={item} />);
  const stepItems = (steps?.items ?? []).map((item, position) => <InlineText key={position} text={item} />);
  return <TeachingScene kind={SECTION_ROLE_LABEL[role]} title={<InlineText text={slide.title} />} titleId={titleId} visual={visual}
    lead={role === "PRACTICE" ? undefined : leadNode}>
    {role === "PRACTICE"
      ? <LearnerTask>{leadNode && <p className="text-lg leading-relaxed">{leadNode}</p>}{pointItems.length > 0 && <TeachingPoints items={pointItems} label="Task steps" />}{stepItems.length > 0 && <ol className="ll3-steps">{stepItems.map((step, position) => <li key={position}><span>{step}</span></li>)}</ol>}{restNode}</LearnerTask>
      : <>
        {pointItems.length > 0 && <TeachingPoints items={pointItems} label={role === "REVIEW" ? "Key takeaways" : "Teaching points"} />}
        {stepItems.length > 0 && (role === "EXAMPLE" ? <WorkedExample label="Step by step" steps={stepItems} /> : <ol className="ll3-steps">{stepItems.map((step, position) => <li key={position}><span>{step}</span></li>)}</ol>)}
        {restNode}
      </>}
  </TeachingScene>;
}

/** Legacy slide deck: one teaching scene at a time with Previous / Next, position and arrow keys. */
export function LegacySlides({ slides, index, onIndexChange, containerRef, topActions, deckLabel, lastAction }: {
  slides: readonly LegacySlide[];
  index: number;
  onIndexChange: (next: number) => void;
  containerRef?: RefObject<HTMLDivElement | null>;
  topActions?: ReactNode;
  deckLabel?: string;
  /** Replaces Next on the final slide (e.g. go to the assessment). */
  lastAction?: ReactNode;
}) {
  const total = slides.length;
  const current = Math.min(index, Math.max(0, total - 1));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input,textarea,select,[contenteditable=true],[role=slider]") || event.altKey || event.ctrlKey || event.metaKey)) return;
      if (event.key === "ArrowLeft" && current > 0) onIndexChange(current - 1);
      if (event.key === "ArrowRight" && current < total - 1) onIndexChange(current + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, total, onIndexChange]);
  if (total === 0) return <p className="ll3-muted">Slides are not available for this lesson yet.</p>;
  const slide = slides[current];
  const isLast = current === total - 1;
  return <div ref={containerRef} className="ll-slide-fullscreen" data-legacy-slides data-slide-index={current}>
    <div className="ll3-slide ll-slide-fullscreen-card">
      <div className="ll3-slide-top">
        <p className="ll3-chip" aria-live="polite">Slide {current + 1} of {total}{deckLabel ? ` · ${deckLabel}` : ""}</p>
        {topActions}
      </div>
      <LegacySlideScene key={current} slide={slide} index={current} titleId={`slide-${current}-title`} />
    </div>
    <div className="ll3-slide-nav">
      <button type="button" className="ll3-btn" onClick={() => onIndexChange(current - 1)} disabled={current === 0}><ChevronLeft size={18} aria-hidden="true" /> Previous</button>
      <div className="ll3-dots" style={{ display: "flex", flexWrap: "wrap" }} aria-hidden="true">{slides.map((_, position) => <span key={position} data-state={position < current ? "done" : position === current ? "current" : "todo"} />)}</div>
      {isLast && lastAction ? lastAction : <button type="button" className="ll3-btn" data-primary="" onClick={() => onIndexChange(current + 1)} disabled={isLast}>Next <ChevronRight size={18} aria-hidden="true" /></button>}
    </div>
  </div>;
}
