"use client";

/**
 * components/LowBandwidthToggle.tsx
 *
 * User-facing toggle for low-bandwidth mode.
 * Shows a banner when slow connection is auto-detected.
 * Reads/writes via lib/lowBandwidthMode.ts.
 */

import { useEffect, useState } from "react";
import {
  getLowBandwidthMode,
  setLowBandwidthMode,
  clearLowBandwidthOverride,
  subscribeLowBandwidth,
} from "@/lib/lowBandwidthMode";

const STORAGE_KEY = "llbm";

function hasManualOverride(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export function LowBandwidthBanner() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const conn = (navigator as any).connection ?? (navigator as any).mozConnection ?? (navigator as any).webkitConnection;
    const autoDetected =
      conn &&
      (conn.effectiveType === "2g" ||
        conn.effectiveType === "slow-2g" ||
        (typeof conn.downlink === "number" && conn.downlink > 0 && conn.downlink < 0.5));

    if (autoDetected && !hasManualOverride()) {
      setShow(true);
    }
  }, []);

  if (!show || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-amber-600/90 px-4 py-2 text-sm text-white"
    >
      <span>Slow connection detected. Low-bandwidth mode is on.</span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss low-bandwidth banner"
        className="ml-4 rounded px-2 py-0.5 text-xs font-medium bg-white/20 hover:bg-white/30"
      >
        Dismiss
      </button>
    </div>
  );
}

export function LowBandwidthToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(getLowBandwidthMode());
    const unsub = subscribeLowBandwidth((next) => setEnabled(next));
    return unsub;
  }, []);

  function toggle() {
    const next = !enabled;
    setLowBandwidthMode(next);
    setEnabled(next);
  }

  function reset() {
    clearLowBandwidthOverride();
    setEnabled(getLowBandwidthMode());
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-slate-300">Low-bandwidth mode</span>
      <button
        role="switch"
        aria-checked={enabled}
        onClick={toggle}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          enabled ? "bg-emerald-600" : "bg-slate-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      {hasManualOverride() && (
        <button
          onClick={reset}
          className="text-xs text-slate-400 hover:text-slate-200 underline"
        >
          Reset to auto
        </button>
      )}
    </div>
  );
}
