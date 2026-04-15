"use client";

import { useEffect, useState } from "react";
import {
  applyLowBandwidthAttribute,
  persistLowBandwidthPreference,
  readLowBandwidthPreference,
  resolveLowBandwidthMode,
  type LowBandwidthPreference,
} from "@/lib/lowBandwidthMode";

type NavigatorConnection = {
  saveData?: boolean;
  effectiveType?: string;
};

function getConnection(): NavigatorConnection | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as any).connection ?? (navigator as any).mozConnection ?? null;
}

export function LowBandwidthToggle() {
  const [preference, setPreference] = useState<LowBandwidthPreference>("auto");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const nextPreference = readLowBandwidthPreference(window.localStorage);
    const nextEnabled = resolveLowBandwidthMode(nextPreference, getConnection());
    setPreference(nextPreference);
    setEnabled(nextEnabled);
    applyLowBandwidthAttribute(document.documentElement, nextEnabled);
  }, []);

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200">
      <span className="text-slate-400">Low-bandwidth mode</span>
      <select
        value={preference}
        onChange={(event) => {
          if (typeof window === "undefined" || typeof document === "undefined") return;
          const nextPreference = event.target.value as LowBandwidthPreference;
          const nextEnabled = resolveLowBandwidthMode(nextPreference, getConnection());
          persistLowBandwidthPreference(window.localStorage, nextPreference);
          applyLowBandwidthAttribute(document.documentElement, nextEnabled);
          setPreference(nextPreference);
          setEnabled(nextEnabled);
        }}
        className="rounded-full border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-100"
      >
        <option value="auto">Auto</option>
        <option value="on">On</option>
        <option value="off">Off</option>
      </select>
      <span className={enabled ? "text-emerald-300" : "text-slate-500"}>{enabled ? "Active" : "Standard"}</span>
    </label>
  );
}
