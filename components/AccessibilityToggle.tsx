"use client";

import { useState, useEffect } from "react";
import { readA11yMode, writeA11yMode, applyA11yMode } from "@/lib/accessibilityMode";

/**
 * AccessibilityToggle — persists large-font + simplified density mode.
 *
 * On mount, reads ll_a11y_mode from localStorage and applies data-a11y="true"
 * to <html> so globals.css rules take effect immediately across the page.
 *
 * Feature-flagged via NEXT_PUBLIC_ENABLE_ACCESSIBILITY_MODE.
 */
export function AccessibilityToggle() {
  const [enabled, setEnabled] = useState(false);

  // Sync from localStorage on first paint
  useEffect(() => {
    const stored = readA11yMode();
    setEnabled(stored);
    applyA11yMode(stored);
  }, []);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    writeA11yMode(next);
    applyA11yMode(next);
  }

  return (
    <button
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={`Accessibility mode ${enabled ? "on" : "off"} — click to toggle large font`}
      title="Toggle large font and simplified layout"
      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all ${
        enabled
          ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 shadow shadow-emerald-500/20"
          : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-500 hover:text-slate-200"
      }`}
    >
      {enabled ? "Aa ✓" : "Aa"}
    </button>
  );
}
