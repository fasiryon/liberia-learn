"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SECTION_ROLE_LABEL, sectionRole } from "@/lib/learner-experience/lessonText";
import { groupPresentationFragments, packPresentationFragments, presentationFragments, presentationLayout, type PresentationFragment, type PresentationPage, type PresentationSource } from "@/lib/learner-experience/presentation";
import { InlineText, LessonBlocks } from "./LessonText";
import "./presentation.css";

function Fragment({ fragment }: { fragment: PresentationFragment & { ids?: string[] } }) {
  const block = fragment.block;
  return <div className="ll5-fragment" data-fragment-id={fragment.id} data-fragment-ids={(fragment.ids ?? [fragment.id]).join(",")}>
    {block.kind === "list" ? block.ordered
      ? <ol start={fragment.listStart} data-continued={fragment.continued || undefined}><li><InlineText text={block.items[0]} /></li></ol>
      : <ul data-continued={fragment.continued || undefined}><li><InlineText text={block.items[0]} /></li></ul>
      : <LessonBlocks blocks={[block]} headingOffset={1} />}
  </div>;
}

function Heading({ slide, sourceIndex, id }: { slide: PresentationSource; sourceIndex: number; id?: string }) {
  const layout = presentationLayout(slide, sourceIndex);
  const label = layout === "story" ? "Opening story" : layout === "objectives" ? "Learning goals" : layout === "discussion" ? "Discuss together" : SECTION_ROLE_LABEL[sectionRole(slide.title, sourceIndex)];
  return <header className="ll5-heading" data-layout={layout}>
    <p className="ll3-scene-kind">{label}</p>
    <h2 id={id} tabIndex={id ? -1 : undefined}><InlineText text={slide.title} /></h2>
  </header>;
}

/** Fullscreen-only composition. Measures at presentation type size and paginates; never scales text to fit. */
export function FullscreenPresentation({ slides, sourceIndex, onSourceChange, topActions, lastAction, deckLabel }: {
  slides: readonly PresentationSource[];
  sourceIndex: number;
  onSourceChange: (index: number) => void;
  topActions?: ReactNode;
  lastAction?: ReactNode;
  deckLabel?: string;
}) {
  const [textLimit, setTextLimit] = useState(260);
  const fragments = useMemo(() => presentationFragments(slides, textLimit), [slides, textLimit]);
  const [pages, setPages] = useState<PresentationPage[]>([]);
  const [anchor, setAnchor] = useState("");
  const entrySource = useRef(sourceIndex);
  const stage = useRef<HTMLElement>(null);
  const measureRoot = useRef<HTMLDivElement>(null);
  const focusAfterMove = useRef(false);
  const anchorPage = pages.findIndex(page => page.fragments.some(fragment => fragment.id === anchor));
  const current = Math.max(0, anchorPage >= 0 ? anchorPage : pages.findIndex(page => page.sourceIndex === sourceIndex));
  const page = pages[current];
  const shownSource = page?.sourceIndex ?? sourceIndex;
  const shownSlide = slides[shownSource];
  const sourcePages = pages.filter(page => page.sourceIndex === shownSource);
  const part = sourcePages.indexOf(page) + 1;
  const isLast = current === pages.length - 1;
  // The stage's height sets page capacity, so the chrome around it must not change size from page to page:
  // a status line that wraps only for "Part 10 of 13" (or a wider last action) would repaginate the deck
  // mid-navigation. Each chrome row reserves its widest form for the current deck. The reserve can only grow
  // as pages are added, so it settles instead of oscillating.
  const widest = (value: number) => String(value).replace(/\d/g, "8");
  const maxParts = Math.max(1, ...slides.map((_, index) => pages.filter(page => page.sourceIndex === index).length));
  const nextButton = <button type="button" className="ll3-btn" data-primary="" disabled={current >= pages.length - 1} onClick={() => move(current + 1)}>Next<ChevronRight size={20} aria-hidden="true" /></button>;

  useLayoutEffect(() => {
    if (!stage.current || !measureRoot.current) return;
    let cancelled = false;
    const measure = () => {
      if (cancelled || !stage.current || !measureRoot.current) return;
      const root = measureRoot.current!, frame = stage.current!;
      const heights = [...root.querySelectorAll<HTMLElement>("[data-measure-fragment]")].map(element => element.getBoundingClientRect().height);
      const capacities = [...root.querySelectorAll<HTMLElement>("[data-measure-heading]")].map(element => frame.clientHeight - element.getBoundingClientRect().height - 22);
      // Reflow at larger text/shorter viewports splits passages further, keeping the same font size.
      if (textLimit > 40 && fragments.some((fragment, index) => heights[index] > capacities[fragment.sourceIndex] && ("text" in fragment.block || fragment.block.kind === "list"))) {
        setTextLimit(Math.max(40, Math.floor(textLimit / 2))); return;
      }
      const next = packPresentationFragments(fragments, heights, capacities);
      setPages(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage.current);
    document.fonts?.ready.then(measure);
    return () => { cancelled = true; observer.disconnect(); };
  }, [fragments, textLimit]);

  useEffect(() => {
    const restore = () => {
      const id = new URLSearchParams(window.location.search).get("slide");
      const fragment = fragments.find(fragment => fragment.id === id) ?? fragments.find(fragment => fragment.sourceIndex === entrySource.current);
      if (fragment) { setAnchor(fragment.id); onSourceChange(fragment.sourceIndex); }
    };
    if (new URLSearchParams(window.location.search).has("slide")) restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [fragments, onSourceChange]);

  const move = (next: number) => {
    if (next < 0 || next >= pages.length) return;
    const target = pages[next];
    focusAfterMove.current = true;
    setAnchor(target.fragments[0].id); onSourceChange(target.sourceIndex);
    const url = new URL(window.location.href);
    url.searchParams.set("slide", target.fragments[0].id);
    window.history.pushState(window.history.state, "", url);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || (event.target as HTMLElement | null)?.closest("input,textarea,select,[contenteditable=true],[role=slider]")) return;
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); move(current + (event.key === "ArrowRight" ? 1 : -1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  useEffect(() => {
    if (focusAfterMove.current) { document.getElementById("presentation-title")?.focus({ preventScroll: true }); focusAfterMove.current = false; }
  }, [current]);

  if (!shownSlide) return null;
  return <div className="ll5-presentation" data-presentation-page={current} data-presentation-total={pages.length}>
    <div className="ll5-slide-meta">
      <div className="ll5-reserve">
        <p role="status" aria-live="polite">Slide {current + 1} of {pages.length || "…"}<span>Section {shownSource + 1} of {slides.length}{sourcePages.length > 1 ? ` · Part ${part} of ${sourcePages.length}` : ""}</span></p>
        <p aria-hidden="true">Slide {widest(pages.length || 1)} of {widest(pages.length || 1)}<span>Section {widest(slides.length)} of {widest(slides.length)}{maxParts > 1 ? ` · Part ${widest(maxParts)} of ${widest(maxParts)}` : ""}</span></p>
      </div>
      <div className="ll5-slide-actions">{deckLabel && <span>{deckLabel}</span>}{topActions}</div>
    </div>
    <section ref={stage} className="ll5-slide-stage" data-layout={presentationLayout(shownSlide, shownSource)} aria-labelledby="presentation-title">
      <Heading slide={shownSlide} sourceIndex={shownSource} id="presentation-title" />
      <div className="ll5-slide-content">{groupPresentationFragments(page?.fragments ?? []).map(fragment => <Fragment key={fragment.id} fragment={fragment} />)}</div>
      <div ref={measureRoot} className="ll5-measure" aria-hidden="true">
        {slides.map((slide, index) => <div key={index} data-measure-heading><Heading slide={slide} sourceIndex={index} /></div>)}
        {fragments.map(fragment => <div key={fragment.id} data-measure-fragment><Fragment fragment={fragment} /></div>)}
      </div>
    </section>
    <nav className="ll5-slide-nav" aria-label="Presentation controls">
      <button type="button" className="ll3-btn" disabled={current === 0} onClick={() => move(current - 1)}><ChevronLeft size={20} aria-hidden="true" />Previous</button>
      <span aria-hidden="true">{current + 1} / {pages.length || "…"}</span>
      {lastAction ? <div className="ll5-reserve">
        {isLast ? lastAction : nextButton}
        <div aria-hidden="true">{isLast ? nextButton : lastAction}</div>
      </div> : nextButton}
    </nav>
  </div>;
}
