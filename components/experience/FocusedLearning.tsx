"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, LifeBuoy, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { ContentsDrawer } from "./ContentsDrawer";
import "./lesson.css";

/**
 * Focused learning chrome shared by the native Lesson Player, the legacy lesson routes and the Grade 7
 * demo: a contextual Back, title and status; a wide stage with an optional outline rail and a support
 * rail that can close (its width returns to the stage); and a measured Previous / Next footer.
 * Presentation only: no component here decides release, completion, evidence or mastery.
 */
export function FocusedHeader({ backHref, backLabel, title, context, extra, progress }: {
  backHref: string;
  backLabel: string;
  title: ReactNode;
  context?: ReactNode;
  extra?: ReactNode;
  /** 0–100, or null for no bar. Shows position, never mastery. */
  progress?: { value: number; label: string } | null;
}) {
  return <header className="ll3-focus-header">
    <div className="ll3-focus-bar">
      <Link href={backHref} className="ll3-back" aria-label={backLabel}><ChevronLeft size={20} aria-hidden="true" /><span className="ll3-back-label" aria-hidden="true">{backLabel.replace(/^Back to /, "")}</span></Link>
      <div className="ll3-focus-title"><p>{title}</p>{context && <p>{context}</p>}</div>
      {extra && <div className="ll3-focus-extra">{extra}</div>}
    </div>
    {progress && <div className="ll3-progress" role="progressbar" aria-label={progress.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.value)}><span style={{ width: `${Math.max(0, Math.min(100, progress.value))}%` }} /></div>}
  </header>;
}

/** Rail open/closed, remembered for this tab only (a layout preference, never learner data). */
function useRailPreference(key: string, initial: boolean) {
  const [open, setOpen] = useState(initial);
  useEffect(() => {
    try { const saved = window.sessionStorage.getItem(key); if (saved === "open" || saved === "closed") setOpen(saved === "open"); } catch { /* storage unavailable */ }
  }, [key]);
  const change = (next: boolean) => { setOpen(next); try { window.sessionStorage.setItem(key, next ? "open" : "closed"); } catch { /* storage unavailable */ } };
  return [open, change] as const;
}

/**
 * Interactive Learning V4 workspace: contents rail (left, ~208px), a wide learning canvas, and a tools rail
 * (right, ~232px). Either rail collapses and its width returns to the canvas; the learner's place is kept
 * (rails only change layout). Below 1024px contents is a drawer; below 1280px the tools rail is a drawer too, so
 * neither squeezes the canvas or stacks under the lesson.
 */
export function LearningStage({ outline, outlineLabel = "Lesson outline", outlineSummary, support, supportLabel = "Lesson help", children, bottomSpace, mainId, mainLabelledBy }: {
  outline?: ReactNode;
  outlineLabel?: string;
  /** Position text for the phone/tablet contents button, e.g. "Scene 3 of 12". */
  outlineSummary?: ReactNode;
  support?: ReactNode;
  supportLabel?: string;
  children: ReactNode;
  /** Space reserved under the stage for a fixed footer (px). */
  bottomSpace?: number;
  mainId?: string;
  mainLabelledBy?: string;
}) {
  const [open, setOpen] = useRailPreference("ll-stage-support", true);
  const [outlineOpen, setOutlineOpen] = useRailPreference("ll-stage-outline", true);
  const supportId = useId();
  const outlineId = useId();
  const outlineShowRef = useRef<HTMLButtonElement>(null);
  const outlineHideRef = useRef<HTMLButtonElement>(null);
  const outlineToggled = useRef(false);
  const toggleOutline = (next: boolean) => { outlineToggled.current = true; setOutlineOpen(next); };
  useEffect(() => {
    if (!outlineToggled.current) return;
    outlineToggled.current = false;
    (outlineOpen ? outlineHideRef.current : outlineShowRef.current)?.focus();
  }, [outlineOpen]);
  const showRef = useRef<HTMLButtonElement>(null);
  const hideRef = useRef<HTMLButtonElement>(null);
  const toggled = useRef(false);
  const toggle = (next: boolean) => { toggled.current = true; setOpen(next); };
  // Keep keyboard focus on the control that replaced the one just pressed (never on first render).
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    (open ? hideRef.current : showRef.current)?.focus();
  }, [open]);
  return <div className="ll3-stage" data-workspace="" data-outline={outline ? (outlineOpen ? "" : "closed") : undefined} data-support={support ? (open ? "open" : "closed") : undefined} style={bottomSpace ? { paddingBottom: bottomSpace + 32 } : undefined}>
    {outline && outlineOpen && <nav className="ll3-stage-outline" id={outlineId} aria-label={outlineLabel}><div>
      <div className="ll5-rail-head"><span>Contents</span><button ref={outlineHideRef} type="button" className="ll5-rail-toggle" aria-expanded={true} aria-controls={outlineId} onClick={() => toggleOutline(false)}><PanelLeftClose size={16} aria-hidden="true" /> Hide</button></div>
      {outline}
    </div></nav>}
    <main className="ll3-stage-main" id={mainId} aria-labelledby={mainLabelledBy}>
      {/* Below 1024px the outline rail is a Contents drawer, and below 1280px the help rail is a drawer, so neither squeezes the canvas. */}
      {(outline || support) && <div className="ll5-stage-bar">
        {outline && <ContentsDrawer label="Contents" summary={outlineSummary} className="ll4-stage-drawer"><nav aria-label={outlineLabel}>{outline}</nav></ContentsDrawer>}
        {outline && !outlineOpen && <button ref={outlineShowRef} type="button" className="ll3-support-toggle ll5-outline-show" aria-expanded={false} onClick={() => toggleOutline(true)}><PanelLeftOpen size={18} aria-hidden="true" /> Show contents</button>}
        {support && <ContentsDrawer label={supportLabel} className="ll5-support-drawer" closeOnSelect={false} icon={<LifeBuoy size={18} aria-hidden="true" />}><div className="ll3-support ll5-support-sheet">{support}</div></ContentsDrawer>}
        {support && !open && <button ref={showRef} type="button" className="ll3-support-toggle ll5-support-show" aria-expanded={false} aria-controls={supportId} onClick={() => toggle(true)}><PanelRightOpen size={18} aria-hidden="true" /> Show {supportLabel.toLowerCase()}</button>}
      </div>}
      {children}
    </main>
    {support && <aside className="ll3-stage-support" id={supportId} aria-label={supportLabel} hidden={!open}>
      <div className="ll3-support">
        <div className="ll3-support-head"><p className="ll3-support-label">{supportLabel}</p><button ref={hideRef} type="button" className="ll3-support-toggle" aria-expanded={true} aria-controls={supportId} onClick={() => toggle(false)}><PanelRightClose size={18} aria-hidden="true" /> Hide</button></div>
        {support}
      </div>
    </aside>}
  </div>;
}

/** Fixed Previous / position / Next footer. The last button is always the forward action. */
export function StageFooter({ index, total, onPrevious, previousDisabled, next, hint, hintId, states, footerRef, unit = "Scene" }: {
  index: number;
  total: number;
  onPrevious: () => void;
  previousDisabled: boolean;
  next: ReactNode;
  hint?: ReactNode;
  hintId?: string;
  /** Per-step state for the position dots: done / current / todo. */
  states?: readonly ("done" | "current" | "todo")[];
  footerRef?: Ref<HTMLElement>;
  unit?: string;
}) {
  return <footer ref={footerRef} className="ll3-footer">
    {hint && <p id={hintId} className="ll3-footer-hint">{hint}</p>}
    <div className="ll3-footer-inner">
      <button type="button" className="ll3-btn" onClick={onPrevious} disabled={previousDisabled}><ChevronLeft size={18} aria-hidden="true" /> Previous</button>
      <div className="ll3-footer-count">
        <p>{unit} {index + 1} of {total}</p>
        {states && <div className="ll3-dots" aria-hidden="true">{states.map((state, position) => <span key={position} data-state={state} />)}</div>}
      </div>
      {next}
    </div>
  </footer>;
}

export function ForwardIcon() { return <ChevronRight size={18} aria-hidden="true" />; }
