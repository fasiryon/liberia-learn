"use client";

import { ReactNode, Suspense, lazy, useEffect, useMemo, useState } from "react";
import LabChatPanel from "@/components/labs/LabChatPanel";
import LabFallback from "@/components/labs/LabFallback";
import type { LabId, PlannedLabAction } from "@/lib/labs/types";

function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  return Boolean(
    canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")
  );
}

const labStateLabels: Record<string, string> = {
  gravity: "Gravity (m/s)",
  mass: "Mass (kg)",
  height: "Height (m)",
  velocity: "Velocity (m/s)",
  angle: "Angle",
  angularVelocity: "Angular Velocity",
  length: "String Length (m)",
  damping: "Damping",
  temperature: "Temperature (K)",
  particleCount: "Particles",
  pressure: "Pressure",
  phase: "Phase",
  heartRate: "Heart Rate (bpm)",
  oxygenLevel: "Oxygen Level (%)",
  exerciseLevel: "Exercise Level",
  blockage: "Blockage",
  frequency: "Frequency (Hz)",
  amplitude: "Amplitude (m)",
  waveSpeed: "Wave Speed (m/s)",
  wavelength: "Wavelength (m)",
  voltage: "Voltage (V)",
  current: "Current (A)",
  power: "Power (W)",
  plantCount: "Plants",
  herbivoreCount: "Herbivores",
  carnivoreCount: "Carnivores",
  reactantA: "Reactant A (mol)",
  reactantB: "Reactant B (mol)",
  productC: "Product C (mol)",
  plate1Speed: "Plate 1 Speed (cm/yr)",
  plate2Speed: "Plate 2 Speed (cm/yr)",
  boundaryType: "Boundary Type",
  earthquakeRisk: "Earthquake Risk",
  windSpeed: "Wind Speed (km/h)",
  cloudCover: "Cloud Cover (%)",
  precipitation: "Precipitation",
  season: "Season",
  paused: "Status",
  catalyst: "Catalyst",
  droughtActive: "Drought",
  reactionStarted: "Reaction",
};

const hiddenStateKeys = new Set(["time", "history", "eventTimer", "lastEvent", "progress"]);

function formatStateValue(key: string, value: unknown): string {
  if (typeof value === "boolean") {
    if (key === "paused") return value ? "Paused" : "Running";
    if (key === "blockage") return value ? "Present" : "Clear";
    if (key === "catalyst") return value ? "Active" : "None";
    if (key === "droughtActive") return value ? "Active" : "None";
    if (key === "reactionStarted") return value ? "Running" : "Not started";
    return value ? "Yes" : "No";
  }
  return typeof value === "number" ? value.toFixed(2) : String(value);
}

function stateEntries(state: unknown): Array<[string, string]> {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return [["Observation", String(state ?? "not available")]];
  }

  return Object.entries(state as Record<string, unknown>)
    .filter(([key]) => !hiddenStateKeys.has(key))
    .map(([key, value]) => [
      labStateLabels[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2"),
      formatStateValue(key, value),
    ]);
}

export default function LabShell({
  labId,
  lessonId,
  initialState,
  state,
  suggestedPrompts,
  webglAvailableOverride,
  fallback,
  onAction,
  children,
}: {
  labId: LabId;
  lessonId?: string | null;
  initialState: unknown;
  state?: unknown;
  suggestedPrompts?: string[];
  webglAvailableOverride?: boolean;
  fallback?: ReactNode;
  onAction: (planned: PlannedLabAction, currentState: unknown) => Promise<unknown> | unknown;
  children: ReactNode;
}) {
  const [webglAvailable, setWebglAvailable] = useState<boolean | null>(
    webglAvailableOverride ?? null
  );
  const [currentState, setCurrentState] = useState(initialState);
  const displayedState = state ?? currentState;
  const entries = useMemo(() => stateEntries(displayedState), [displayedState]);
  const LazyScene = useMemo(
    () => lazy(async () => ({ default: () => <>{children}</> })),
    [children]
  );

  useEffect(() => {
    if (typeof webglAvailableOverride === "boolean") return;
    setWebglAvailable(hasWebGL());
  }, [webglAvailableOverride]);

  async function handleAction(planned: PlannedLabAction) {
    const nextState = await onAction(planned, displayedState);
    if (nextState !== undefined) {
      setCurrentState(nextState);
      return nextState;
    }
    return displayedState;
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] text-slate-50 shadow-none">
      <div className="grid min-h-[28rem] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 bg-slate-950">
          {webglAvailable === false ? (
            fallback ?? <LabFallback labId={labId} state={displayedState} />
          ) : (
            <Suspense
              fallback={
                <div className="flex min-h-72 items-center justify-center bg-slate-950 text-sm text-slate-300">
                  Loading lab scene...
                </div>
              }
            >
              {typeof webglAvailableOverride === "boolean" ? children : <LazyScene />}
            </Suspense>
          )}
        </div>

        <aside className="ll-page-enter border-t border-[var(--ll-border)] bg-[var(--ll-bg)] p-4 lg:border-l lg:border-t-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-text-muted)]">
            Observations
          </p>
          <dl className="mt-3 space-y-2">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-[var(--ll-surface-muted)] px-3 py-2 text-sm [transition:background-color_300ms_ease-out]">
                <dt className="text-[var(--ll-text-muted)]">{key}</dt>
                <dd className="font-medium text-slate-100">{value}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>

      <LabChatPanel
        labId={labId}
        lessonId={lessonId}
        state={displayedState}
        suggestedPrompts={suggestedPrompts ?? []}
        onAction={handleAction}
      />
    </section>
  );
}
