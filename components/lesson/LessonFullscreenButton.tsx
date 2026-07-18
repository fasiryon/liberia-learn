"use client";

import { useEffect, useState, type RefObject } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

import {
  addFullscreenChangeListener,
  exitLessonFullscreen,
  isElementFullscreen,
  requestLessonFullscreen,
} from "@/lib/lesson/fullscreen";

export function LessonFullscreenButton({
  targetRef,
  className = "",
}: {
  targetRef: RefObject<HTMLElement>;
  className?: string;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(isElementFullscreen(targetRef.current));
    sync();
    return addFullscreenChangeListener(document, sync);
  }, [targetRef]);

  async function handleToggle() {
    if (active) {
      await exitLessonFullscreen();
      return;
    }
    if (targetRef.current) {
      await requestLessonFullscreen(targetRef.current);
    }
  }

  const Icon = active ? Minimize2 : Maximize2;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={active ? "Exit fullscreen slides" : "View slides fullscreen"}
      className={`ll-touch-target inline-flex items-center gap-2 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/90 px-3 py-2 text-sm font-semibold text-[var(--ll-text)] shadow-sm backdrop-blur transition hover:border-[var(--ll-border-strong)] ${className}`}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span>{active ? "Exit fullscreen" : "Fullscreen"}</span>
    </button>
  );
}
