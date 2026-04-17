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

function stateEntries(state: unknown): Array<[string, string]> {
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return [["state", String(state ?? "not available")]];
  }

  return Object.entries(state as Record<string, unknown>).map(([key, value]) => [
    key,
    typeof value === "number" ? value.toFixed(2) : String(value),
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
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 text-slate-50 shadow-2xl shadow-black/40">
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

        <aside className="border-t border-slate-800 bg-slate-950/95 p-4 lg:border-l lg:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            State
          </p>
          <dl className="mt-3 space-y-2">
            {entries.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 px-3 py-2 text-sm">
                <dt className="text-slate-400">{key}</dt>
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
