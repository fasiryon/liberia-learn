import type { ReactNode } from "react";

/**
 * One vocabulary for section states (VISUAL_DESIGN_SYSTEM_V3 "States and control acceptance"): say what
 * happened, why, and offer a permitted way forward. A failure is never presented as empty or zero, and an
 * unrecorded preview never as submitted, graded, released or mastered.
 */
export type NoticeKind = "loading" | "empty" | "error" | "denied" | "offline" | "stale" | "unknown" | "preview";

const DEFAULT_TITLE: Record<NoticeKind, string> = {
  loading: "Loading…",
  empty: "Nothing here yet",
  error: "This could not load",
  denied: "Not available to you",
  offline: "You are offline",
  stale: "Last checked earlier",
  unknown: "Not known yet",
  preview: "Preview only",
};

export function StateNotice({ kind, title, children, action, compact }: { kind: NoticeKind; title?: ReactNode; children?: ReactNode; action?: ReactNode; compact?: boolean }) {
  const live = kind === "loading" || kind === "error" || kind === "offline" || kind === "stale";
  return <div className="ll3-notice" data-kind={kind} data-compact={compact ? "" : undefined} role={live ? "status" : undefined} aria-busy={kind === "loading" || undefined}>
    <p className="ll3-notice-title">{title ?? DEFAULT_TITLE[kind]}</p>
    {children && <div className="ll3-notice-body">{children}</div>}
    {action}
  </div>;
}
