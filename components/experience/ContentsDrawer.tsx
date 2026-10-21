"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ListOrdered, X } from "lucide-react";

/**
 * Phone/tablet lesson contents: a button that opens an accessible, scrollable bottom sheet. Choosing any
 * button or link inside the list closes the sheet (focus then belongs to the new section). Escape and the
 * backdrop close it and return focus to the trigger. The page behind does not scroll while it is open, so
 * there is never a second scrollbar competing with the page.
 */
export function ContentsDrawer({ label, summary, children, className = "", icon, closeOnSelect = true }: {
  label: string;
  /** Trigger icon; the lesson contents list icon by default. */
  icon?: ReactNode;
  /** Close when a button or link inside is chosen (navigation lists). Off for tool panels. */
  closeOnSelect?: boolean;
  /** Short position text beside the trigger, e.g. "3 of 17 · Reading large numbers". */
  summary?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const returnFocus = useRef(false);
  useEffect(() => {
    if (!open) {
      if (returnFocus.current) { returnFocus.current = false; triggerRef.current?.focus(); }
      return;
    }
    const sheet = sheetRef.current;
    const current = sheet?.querySelector<HTMLElement>("[aria-current]") ?? sheet?.querySelector<HTMLElement>("button:not([disabled]),a[href]");
    current?.focus();
    current?.scrollIntoView?.({ block: "nearest" });
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { returnFocus.current = true; setOpen(false); }
      if (event.key === "Tab" && sheet) {
        // Keep focus inside the open sheet.
        const focusable = [...sheet.querySelectorAll<HTMLElement>("button:not([disabled]),a[href]")];
        if (focusable.length === 0) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previous; };
  }, [open]);
  return <div className={`ll4-drawer ${className}`.trim()}>
    <button ref={triggerRef} type="button" className="ll4-drawer-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
      {icon ?? <ListOrdered size={18} aria-hidden="true" />}<span className="ll4-drawer-label">{label}</span>{summary && <span className="ll4-drawer-summary">{summary}</span>}
    </button>
    {open && <div className="ll4-drawer-layer">
      <button type="button" className="ll4-drawer-backdrop" aria-label={`Close ${label.toLowerCase()}`} tabIndex={-1} onClick={() => { returnFocus.current = true; setOpen(false); }} />
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="ll4-drawer-sheet"
        onClick={(event) => { const target = event.target as HTMLElement; if (closeOnSelect && target.closest(".ll4-drawer-list button:not([disabled]), .ll4-drawer-list a[href]")) setOpen(false); }}>
        <div className="ll4-drawer-head">
          <p id={titleId} className="ll4-drawer-title">{label}</p>
          <button type="button" className="ll4-icon-btn" aria-label={`Close ${label.toLowerCase()}`} onClick={() => { returnFocus.current = true; setOpen(false); }}><X size={20} aria-hidden="true" /></button>
        </div>
        <div className="ll4-drawer-list">{children}</div>
      </div>
    </div>}
  </div>;
}
