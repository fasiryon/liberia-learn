"use client";

import { useState } from "react";

interface CollapsiblePanelProps {
  title: string;
  children: React.ReactNode;
  /** Whether the panel is open on first render. Defaults to false (collapsed). */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * CollapsiblePanel — progressive disclosure for advanced / secondary sections.
 *
 * Used in teacher and admin dashboards to keep the default view uncluttered
 * while still making advanced options accessible on demand.
 *
 * Usage:
 *   <CollapsiblePanel title="Resources & quick links">
 *     ...secondary content...
 *   </CollapsiblePanel>
 */
export function CollapsiblePanel({
  title,
  children,
  defaultOpen = false,
  className = "",
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={`rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-800/50 transition-colors"
      >
        <span className="text-base font-semibold text-slate-100">{title}</span>
        <span
          aria-hidden="true"
          className="text-slate-500 text-sm transition-transform duration-200"
          style={{ display: "inline-block", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  );
}
