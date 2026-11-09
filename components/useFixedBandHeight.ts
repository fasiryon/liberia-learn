"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Publishes a fixed bottom band's measured height as a CSS variable on <html>, so globals.css can reserve it:
 * body padding lets every control scroll clear, and scroll-padding keeps keyboard focus from landing underneath
 * (issue #199, WCAG 2.4.11). The variable is removed when the band unmounts.
 */
export function useFixedBandHeight<T extends HTMLElement>(variable: `--${string}`, gap = 0) {
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    const root = document.documentElement;
    if (!node) { root.style.removeProperty(variable); return; }
    const sync = () => root.style.setProperty(variable, `${Math.ceil(node.getBoundingClientRect().height) + gap}px`);
    sync();
    if (typeof ResizeObserver === "function") { observer.current = new ResizeObserver(sync); observer.current.observe(node); }
  }, [variable, gap]);
  useEffect(() => () => { observer.current?.disconnect(); document.documentElement.style.removeProperty(variable); }, [variable]);
  return ref;
}
