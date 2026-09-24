"use client";

import { useEffect, useRef } from "react";

/** True when a periodic network refresh would be useful: page visible and
 * the browser believes it is online. */
export function shouldRefreshNow(): boolean {
  if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;
  return true;
}

/**
 * Low-end/metered-data friendly interval. It runs `callback` immediately,
 * then every `intervalMs` only while the tab is visible and online. Hidden
 * or offline tabs make no requests; returning to visible/online refreshes
 * once and resumes the schedule. `intervalMs = null` disables the timer.
 */
export function useVisibleInterval(callback: () => void, intervalMs: number | null): void {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (intervalMs === null) return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => {
      if (timer !== null) clearInterval(timer);
      timer = null;
    };
    const start = () => {
      if (timer !== null || !shouldRefreshNow()) return;
      saved.current();
      timer = setInterval(() => {
        if (shouldRefreshNow()) saved.current();
        else stop();
      }, intervalMs);
    };
    const onChange = () => (shouldRefreshNow() ? start() : stop());

    start();
    document.addEventListener("visibilitychange", onChange);
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onChange);
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    };
  }, [intervalMs]);
}
