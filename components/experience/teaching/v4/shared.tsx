"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { InlineText } from "@/components/experience/LessonText";

/**
 * Interactive Learning V4 block plumbing. Blocks report `onDone(id, true)` once the learner has finished the
 * learning move (never a score); the player keeps that marker so Continue stays open on return. Nothing a
 * block does is sent, saved as evidence or used for mastery.
 */
export type BlockDone = (blockId: string, done: boolean) => void;

/** Report completion once, when it first becomes true. */
export function useReportDone(id: string, done: boolean, onDone: BlockDone) {
  const reported = useRef(false);
  useEffect(() => {
    if (done && !reported.current) { reported.current = true; onDone(id, true); }
  }, [id, done, onDone]);
}

/** Lesson-level facts some blocks need: reading passages by block id (for quotation checks). */
export const BlockLessonContext = createContext<Readonly<{ sources: Readonly<Record<string, string>> }>>({ sources: {} });
export const useBlockLesson = () => useContext(BlockLessonContext);

export function Feedback({ result, children }: { result: "right" | "retry" | "pending" | null; children: ReactNode }) {
  return <p role="status" className={result && result !== "pending" ? "ll3-feedback" : "ll3-small ll3-muted"} data-result={result === "right" || result === "retry" ? result : undefined}>
    {result === "right" && <strong>Correct. </strong>}{result === "retry" && <strong>Not yet. </strong>}{children}
  </p>;
}

export function BlockFrame({ label, title, children, className = "", data }: { label: string; title?: string; children: ReactNode; className?: string; data?: Record<string, string> }) {
  return <section className={`ll5-block ${className}`.trim()} {...data}>
    <p className="ll5-block-label">{label}</p>
    {title && <p className="ll5-block-title"><InlineText text={title} /></p>}
    {children}
  </section>;
}

/** Steady per-viewer draft storage for writing (this tab only; never sent). */
export function readDraft(key: string): Record<string, string> {
  try { return JSON.parse(window.sessionStorage.getItem(key) ?? "{}") as Record<string, string>; } catch { return {}; }
}
export function writeDraft(key: string, value: Record<string, string>) {
  try { window.sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: the draft stays on this page */ }
}
