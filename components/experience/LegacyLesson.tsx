"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { ContentsDrawer } from "./ContentsDrawer";
import "./lesson.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AUDIENCE_LABEL, SECTION_ROLE_LABEL, labelledParagraph, numbersInBlocks, sectionAudience, sectionRole, teachingParts, type LessonBlock, type LessonSection } from "@/lib/learner-experience/lessonText";
import { expandedForm, formatNumber, wordForm } from "@/lib/learner-experience/demo/placeValue";
import { PlaceValueChart } from "./demo/PlaceValueTools";
import { InlineText, LessonBlocks, LessonImage, LessonTable } from "./LessonText";
import { LearnerTask, TeachingPoints, TeachingScene, WorkedExample } from "./TeachingScene";
import { FullscreenPresentation } from "./FullscreenPresentation";
import { addFullscreenChangeListener, getFullscreenElement } from "@/lib/lesson/fullscreen";

/**
 * LEGACY lesson presentation (Read and Slides) for the existing student lesson routes. Everything shown
 * comes from the lesson's own text, in its own order: section roles are read from authored headings and
 * nothing is generated. This is a presentation of legacy content, not a native Lesson Experience.
 */

/** Where a section id is kept in the address, so a refresh, a shared link and Back/Forward reopen it. */
export const READ_SECTION_PARAM = "section";

function sectionFromUrl(sections: readonly LessonSection[]): number {
  if (typeof window === "undefined") return -1;
  const id = new URLSearchParams(window.location.search).get(READ_SECTION_PARAM);
  return id ? sections.findIndex((section) => section.id === id) : -1;
}

/**
 * Read mode as a playlist: the contents rail lists every authored section in order and the stage shows only
 * the selected one (like a video playlist), so a 20-section lesson is never one enormous scroll. Everything
 * shown is the lesson's own text in its own order. The open section lives in `?section=` (refresh, deep link,
 * Back/Forward) and is remembered for this tab only; it is a reading position, never evidence, completion or
 * mastery. Every section stays mounted (only hidden), so nothing a learner typed is lost when switching.
 */
export function LegacyReading({ sections, objectives, tools, after, html, title, storageKey }: {
  sections: readonly LessonSection[];
  objectives?: readonly string[];
  tools?: ReactNode;
  /** Shown with the final section only (e.g. the hand-off to the existing assessment). */
  after?: ReactNode;
  /** Sanitized HTML (teacher-created bodies) rendered instead of parsed sections. */
  html?: string | null;
  title: string;
  /** Identity for remembering the open section in this tab (lesson or work id). */
  storageKey?: string;
}) {
  const playlist = !html && sections.length > 1;
  const [current, setCurrent] = useState(0);
  const changed = useRef(false);
  const railRef = useRef<HTMLOListElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const memoryKey = storageKey ? `ll-read-section:${storageKey}` : null;
  // Open the section named in the address, else the one last read in this tab, else the first.
  useEffect(() => {
    if (!playlist) return;
    let start = sectionFromUrl(sections);
    if (start < 0 && memoryKey) { try { const saved = window.sessionStorage.getItem(memoryKey); start = saved ? sections.findIndex((section) => section.id === saved) : -1; } catch { start = -1; } }
    if (start > 0) setCurrent(start);
    const onPop = () => { const next = sectionFromUrl(sections); changed.current = true; setCurrent(next < 0 ? 0 : next); };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [playlist, sections, memoryKey]);
  const select = useCallback((next: number) => {
    if (next < 0 || next >= sections.length || next === current) return;
    changed.current = true;
    setCurrent(next);
    const url = new URL(window.location.href);
    url.searchParams.set(READ_SECTION_PARAM, sections[next].id);
    url.hash = "";
    window.history.pushState(window.history.state, "", url);
    if (memoryKey) { try { window.sessionStorage.setItem(memoryKey, sections[next].id); } catch { /* storage unavailable */ } }
  }, [current, sections, memoryKey]);
  // After a change: the new section's heading takes focus, the stage top comes into view, and the rail keeps
  // the selected entry visible inside its own scroll area (the page itself does not jump to the rail).
  useEffect(() => {
    if (!playlist) return;
    const rail = railRef.current;
    const active = rail?.querySelector<HTMLElement>("[aria-current]");
    if (rail && active) {
      // Keep the open entry in view, centred when it was out of view; this scrolls the rail, never the page.
      const top = active.offsetTop, bottom = top + active.offsetHeight;
      if (top < rail.scrollTop || bottom > rail.scrollTop + rail.clientHeight) rail.scrollTop = Math.max(0, top - (rail.clientHeight - active.offsetHeight) / 2);
    }
    if (!changed.current) return;
    changed.current = false;
    const heading = document.getElementById(`${sections[current]?.id}-h`);
    heading?.focus({ preventScroll: true });
    const stage = stageRef.current;
    if (stage && stage.getBoundingClientRect().top < 0) stage.scrollIntoView({ block: "start" });
  }, [current, playlist, sections]);

  const onRailKey = (event: ReactKeyboardEvent<HTMLOListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    const buttons = [...(railRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    event.preventDefault();
    const target = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, at + (event.key === "ArrowDown" ? 1 : -1)));
    buttons[target]?.focus();
  };
  const entries = (rail: boolean) => sections.map((section, index) => {
    const role = sectionRole(section.title, index);
    return <li key={section.id}>
      <button type="button" aria-current={index === current ? "true" : undefined} data-done={index < current ? "" : undefined} onClick={() => select(index)}>
        <span className="ll3-outline-num" aria-hidden="true">{index + 1}</span>
        <span className="min-w-0"><span className="ll4-entry-title"><InlineText text={section.title} /></span>{rail && <span className="ll4-entry-role">{SECTION_ROLE_LABEL[role]}</span>}</span>
        {index === current && <span className="sr-only">(open)</span>}
      </button>
    </li>;
  });

  if (!playlist) {
    return <div className="ll3-read-layout" data-tools={tools ? "" : undefined} data-reading-layout="single">
      <article className="ll3-read-main" aria-label={`${title}: reading`} style={{ gridColumn: "1 / -1" }}>
        {objectives && objectives.length > 0 && <Goals objectives={objectives} />}
        {html
          ? <div className="ll3-reading" dangerouslySetInnerHTML={{ __html: html }} />
          : sections.map((section) => <section key={section.id} id={section.id} className="ll3-section">{section.authoredHeading && <h2 className="ll3-section-title"><InlineText text={section.title} /></h2>}<div className="ll3-reading"><LessonBlocks blocks={section.blocks} headingOffset={1} /></div></section>)}
        {after && <div className="mt-10 max-w-[var(--ll-measure)]">{after}</div>}
      </article>
      {tools && <aside className="ll3-read-tools" aria-label="Reading tools"><div className="ll3-support">{tools}</div></aside>}
    </div>;
  }

  const section = sections[current];
  const previous = current > 0 ? sections[current - 1] : null;
  const next = current < sections.length - 1 ? sections[current + 1] : null;
  return <div className="ll4-read" data-reading-layout="playlist" data-section-index={current} data-section-count={sections.length}>
    <ContentsDrawer label="Contents" className="ll4-read-drawer" summary={<>{current + 1} of {sections.length} · <InlineText text={section.title} /></>}>
      <nav aria-label="Lesson contents"><ol className="ll3-outline-list ll4-playlist">{entries(false)}</ol></nav>
    </ContentsDrawer>
    <nav className="ll4-read-rail" aria-label="Lesson contents">
      <p className="ll4-rail-head"><span>Contents</span><span>{current + 1} / {sections.length}</span></p>
      <ol ref={railRef} className="ll3-outline-list ll4-playlist" onKeyDown={onRailKey}>{entries(true)}</ol>
    </nav>
    <article ref={stageRef} className="ll4-read-stage" aria-label={`${title}: reading`}>
      {sections.map((candidate, index) => {
        const role = sectionRole(candidate.title, index);
        return <section key={candidate.id} id={candidate.id} hidden={index !== current} className="ll3-section ll4-read-section" data-role={role} data-read-section={candidate.id} aria-labelledby={`${candidate.id}-h`}>
          <p className="ll4-read-kicker"><span className="ll3-section-role">{SECTION_ROLE_LABEL[role]}</span><span>Section {index + 1} of {sections.length}</span></p>
          <h2 id={`${candidate.id}-h`} tabIndex={-1} className="ll3-section-title ll4-read-title"><InlineText text={candidate.title} /></h2>
          {index === 0 && objectives && objectives.length > 0 && <Goals objectives={objectives} />}
          <div className="ll3-reading mt-4"><LessonBlocks blocks={candidate.blocks} headingOffset={1} /></div>
        </section>;
      })}
      {after && <div className="mt-8 max-w-[var(--ll-measure)]" hidden={next !== null} data-read-final>{after}</div>}
      <nav className="ll4-read-pager" aria-label="Section navigation">
        <button type="button" className="ll3-btn ll4-pager-btn" onClick={() => select(current - 1)} disabled={!previous}>
          <ChevronLeft size={18} aria-hidden="true" /><span><span className="ll4-pager-dir">Previous</span>{previous && <span className="ll4-pager-title"><InlineText text={previous.title} /></span>}</span>
        </button>
        <button type="button" className="ll3-btn ll4-pager-btn" data-primary="" onClick={() => select(current + 1)} disabled={!next}>
          <span><span className="ll4-pager-dir">{next ? "Next" : "Last section"}</span>{next && <span className="ll4-pager-title"><InlineText text={next.title} /></span>}</span>{next && <ChevronRight size={18} aria-hidden="true" />}
        </button>
      </nav>
    </article>
    {tools && <aside className="ll3-read-tools" aria-label="Reading tools"><div className="ll3-support">{tools}</div></aside>}
  </div>;
}

function Goals({ objectives }: { objectives: readonly string[] }) {
  return <section aria-labelledby="read-goals" className="ll3-panel mb-6 mt-4 max-w-[var(--ll-measure)]">
    <h3 id="read-goals" className="ll3-panel-title">In this lesson you will</h3>
    <div className="ll3-reading"><ul>{objectives.map((objective, index) => <li key={index}>{objective}</li>)}</ul></div>
  </section>;
}

export type LegacySlide = { title: string; blocks: readonly LessonBlock[] };

const isMathSubject = (subject?: string | null) => /^(math|mathematics)$/i.test((subject ?? "").trim());

/**
 * Multi-paragraph legacy text as reading cards that use the slide's width (each card keeps a readable
 * measure). A paragraph with its own authored label ("Worked Example 1: …") shows that label as its heading.
 */
function ReadingCards({ paragraphs }: { paragraphs: readonly string[] }) {
  return <div className="ll4-read-cards">{paragraphs.map((text, position) => {
    const labelled = labelledParagraph(text);
    return <article key={position} className="ll4-read-card" data-labelled={labelled ? "" : undefined}>
      {labelled ? <h3 className="ll4-read-card-label"><InlineText text={labelled.label} /></h3> : <p className="ll4-read-card-part" aria-hidden="true">Part {position + 1}</p>}
      <p><InlineText text={labelled ? labelled.text : text} /></p>
    </article>;
  })}</div>;
}

/** One legacy slide presented as a teaching scene, parts taken only from the slide's own blocks. */
export function LegacySlideScene({ slide, index, titleId, subject }: { slide: LegacySlide; index: number; titleId: string; subject?: string | null }) {
  const role = sectionRole(slide.title, index);
  const audience = sectionAudience(slide.title);
  const parts = teachingParts(slide.blocks);
  const paragraphs = slide.blocks.filter((block): block is Extract<LessonBlock, { kind: "paragraph" }> => block.kind === "paragraph");
  // Labelled paragraphs or a run of paragraphs become cards; otherwise the first paragraph leads as before.
  const asCards = paragraphs.length >= 2 && (paragraphs.some((block) => labelledParagraph(block.text)) || paragraphs.length >= 3 || slide.blocks.every((block) => block.kind === "paragraph"));
  const { points, steps, visuals } = parts;
  const lead = asCards ? null : parts.lead;
  const rest = asCards ? parts.rest.filter((block) => block.kind !== "paragraph") : parts.rest;
  const numbers = isMathSubject(subject) && visuals.length === 0 ? numbersInBlocks(slide.blocks) : [];
  const visual = visuals.length > 0
    ? <>{visuals.map((block, position) => block.kind === "table" ? <LessonTable key={position} block={block} caption={slide.title} /> : <LessonImage key={position} block={block} />)}</>
    : numbers.length > 0 ? <NumberLens numbers={numbers} /> : undefined;
  const leadNode = lead ? <InlineText text={lead.text} /> : undefined;
  const restNode = rest.length > 0 ? <div className="ll3-reading"><LessonBlocks blocks={rest} headingOffset={1} /></div> : null;
  const cards = asCards ? <ReadingCards paragraphs={paragraphs.map((block) => block.text)} /> : null;
  const pointItems = (points?.items ?? []).map((item, position) => <InlineText key={position} text={item} />);
  const stepItems = (steps?.items ?? []).map((item, position) => <InlineText key={position} text={item} />);
  const audienceNote = audience !== "LEARNER" && <p className="ll4-audience" data-audience={audience}>
    <strong>{AUDIENCE_LABEL[audience]}.</strong> {audience === "TEACHER" ? "This part of the lesson was written to help your teacher run it. Read it to see what your class will do." : "This part suggests how someone at home can help you practise."}
  </p>;
  return <TeachingScene kind={SECTION_ROLE_LABEL[role]} title={<InlineText text={slide.title} />} titleId={titleId} visual={visual}
    lead={role === "PRACTICE" ? undefined : leadNode} className={`ll4-slide-scene${cards && !visual ? " ll4-slide-wide" : ""}`}>
    {audienceNote}
    {role === "PRACTICE"
      ? <LearnerTask>{leadNode && <p className="text-lg leading-relaxed">{leadNode}</p>}{cards}{pointItems.length > 0 && <TeachingPoints items={pointItems} label="Task steps" />}{stepItems.length > 0 && <ol className="ll3-steps">{stepItems.map((step, position) => <li key={position}><span>{step}</span></li>)}</ol>}{restNode}</LearnerTask>
      : <>
        {cards}
        {pointItems.length > 0 && <TeachingPoints items={pointItems} label={role === "REVIEW" ? "Key takeaways" : "Teaching points"} />}
        {stepItems.length > 0 && (role === "EXAMPLE" ? <WorkedExample label="Step by step" steps={stepItems} /> : <ol className="ll3-steps">{stepItems.map((step, position) => <li key={position}><span>{step}</span></li>)}</ol>)}
        {restNode}
      </>}
  </TeachingScene>;
}

/**
 * Optional place-value tool for a Mathematics slide, built only from numbers written in that slide. It shows
 * the number's places, expanded form and words; it does not add to or change the lesson.
 */
function NumberLens({ numbers }: { numbers: readonly number[] }) {
  const [value, setValue] = useState(numbers[0]);
  return <figure className="ll3-figure ll4-figure ll4-lens" data-number-lens>
    <p className="ll3-support-label">Tool · explore a number from this slide</p>
    {numbers.length > 1 && <div className="ll4-row" role="group" aria-label="Numbers in this slide">{numbers.map((number) => <button key={number} type="button" className="ll3-btn" aria-pressed={value === number} onClick={() => setValue(number)}>{formatNumber(number)}</button>)}</div>}
    <PlaceValueChart value={value} caption={`Place-value chart for ${formatNumber(value)}`} />
    <dl className="ll3-builder-forms">
      <div><dt>Expanded form</dt><dd>{expandedForm(value)}</dd></div>
      <div><dt>In words</dt><dd>{wordForm(value)}</dd></div>
    </dl>
    <figcaption>Built from the numbers written in this slide. It is a tool, not part of the lesson text.</figcaption>
  </figure>;
}

/**
 * Legacy slide deck: one teaching scene at a time with Previous / Next, position and arrow keys. When some
 * slides are headed as notes for teachers or families, the learner may skip them; nothing is removed, and
 * the same slides stay in Read mode.
 */
export function LegacySlides({ slides, index, onIndexChange, containerRef, topActions, deckLabel, lastAction, subject }: {
  slides: readonly LegacySlide[];
  index: number;
  onIndexChange: (next: number) => void;
  containerRef?: RefObject<HTMLDivElement | null>;
  topActions?: ReactNode;
  deckLabel?: string;
  /** Replaces Next on the final slide (e.g. go to the assessment). */
  lastAction?: ReactNode;
  /** The lesson's subject; Mathematics slides offer the place-value tool for numbers they contain. */
  subject?: string | null;
}) {
  const total = slides.length;
  const ownRoot = useRef<HTMLDivElement>(null);
  const rootRef = containerRef ?? ownRoot;
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    let wasFullscreen = false;
    const sync = () => {
      const active = getFullscreenElement() === rootRef.current || getFullscreenElement() === document.documentElement;
      setFullscreen(active);
      if (wasFullscreen && !active) requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>("[aria-label='View slides fullscreen']")?.focus());
      wasFullscreen = active;
    };
    sync();
    return addFullscreenChangeListener(document, sync);
  }, [rootRef]);
  const current = Math.min(index, Math.max(0, total - 1));
  const notes = slides.map((slide) => sectionAudience(slide.title) !== "LEARNER");
  const noteCount = notes.filter(Boolean).length;
  const [skipNotes, setSkipNotes] = useState(false);
  const canSkip = noteCount > 0 && noteCount < total;
  const visible = slides.map((_, position) => position).filter((position) => !(skipNotes && canSkip && notes[position]));
  const at = visible.indexOf(current);
  const previousIndex = at > 0 ? visible[at - 1] : at < 0 ? [...visible].reverse().find((position) => position < current) ?? null : null;
  const nextIndex = at >= 0 ? (at < visible.length - 1 ? visible[at + 1] : null) : visible.find((position) => position > current) ?? null;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (fullscreen) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input,textarea,select,[contenteditable=true],[role=slider]") || event.altKey || event.ctrlKey || event.metaKey)) return;
      if (event.key === "ArrowLeft" && previousIndex !== null) onIndexChange(previousIndex);
      if (event.key === "ArrowRight" && nextIndex !== null) onIndexChange(nextIndex);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previousIndex, nextIndex, onIndexChange, fullscreen]);
  if (total === 0) return <p className="ll3-muted">Slides are not available for this lesson yet.</p>;
  const toggleNotes = () => {
    const next = !skipNotes;
    setSkipNotes(next);
    // Leaving a note slide when skipping: go on to the next learner slide (or back to the last one).
    if (next && notes[current]) {
      const forward = slides.findIndex((slide, position) => position > current && !notes[position]);
      const back = [...slides.keys()].reverse().find((position) => position < current && !notes[position]);
      onIndexChange(forward >= 0 ? forward : back ?? current);
    }
  };
  const slide = slides[current];
  const isLast = nextIndex === null;
  return <div ref={rootRef} className="ll-slide-fullscreen" data-legacy-slides data-slide-index={current} data-presentation={fullscreen ? "fullscreen" : undefined}>
    {fullscreen ? <FullscreenPresentation slides={slides} sourceIndex={current} onSourceChange={onIndexChange} topActions={topActions} lastAction={lastAction} deckLabel={deckLabel} /> : <>
    <div className="ll3-slide ll-slide-fullscreen-card">
      <div className="ll3-slide-top">
        <p className="ll3-chip" aria-live="polite">Slide {current + 1} of {total}{deckLabel ? ` · ${deckLabel}` : ""}{skipNotes && canSkip ? ` · ${noteCount} note ${noteCount === 1 ? "slide" : "slides"} skipped` : ""}</p>
        <div className="ll4-row">
          {canSkip && <button type="button" className="ll3-btn ll4-skip-notes" aria-pressed={skipNotes} onClick={toggleNotes}>{skipNotes ? `Show notes for teachers (${noteCount})` : `Skip notes for teachers (${noteCount})`}</button>}
          {topActions}
        </div>
      </div>
      <LegacySlideScene key={current} slide={slide} index={current} titleId={`slide-${current}-title`} subject={subject} />
    </div>
    <div className="ll3-slide-nav">
      <button type="button" className="ll3-btn" onClick={() => previousIndex !== null && onIndexChange(previousIndex)} disabled={previousIndex === null}><ChevronLeft size={18} aria-hidden="true" /> Previous</button>
      <div className="ll3-dots" style={{ display: "flex", flexWrap: "wrap" }} aria-hidden="true">{visible.map((position) => <span key={position} data-state={position < current ? "done" : position === current ? "current" : "todo"} />)}</div>
      {isLast && lastAction ? lastAction : <button type="button" className="ll3-btn" data-primary="" onClick={() => nextIndex !== null && onIndexChange(nextIndex)} disabled={nextIndex === null}>Next <ChevronRight size={18} aria-hidden="true" /></button>}
    </div>
    </>}
  </div>;
}
