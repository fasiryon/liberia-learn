"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react";

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

export function LearningStage({ outline, outlineLabel = "Lesson outline", support, supportLabel = "Lesson help", children, bottomSpace, mainId, mainLabelledBy }: {
  outline?: ReactNode;
  outlineLabel?: string;
  support?: ReactNode;
  supportLabel?: string;
  children: ReactNode;
  /** Space reserved under the stage for a fixed footer (px). */
  bottomSpace?: number;
  mainId?: string;
  mainLabelledBy?: string;
}) {
  const [open, setOpen] = useState(true);
  const supportId = useId();
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
  return <div className="ll3-stage" data-outline={outline ? "" : undefined} data-support={support ? (open ? "open" : "closed") : undefined} style={bottomSpace ? { paddingBottom: bottomSpace + 32 } : undefined}>
    {outline && <nav className="ll3-stage-outline" aria-label={outlineLabel}><div>{outline}</div></nav>}
    <main className="ll3-stage-main" id={mainId} aria-labelledby={mainLabelledBy}>
      {support && !open && <div className="mb-4 flex justify-end"><button ref={showRef} type="button" className="ll3-support-toggle" aria-expanded={false} aria-controls={supportId} onClick={() => toggle(true)}><PanelRightOpen size={18} aria-hidden="true" /> Show {supportLabel.toLowerCase()}</button></div>}
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
