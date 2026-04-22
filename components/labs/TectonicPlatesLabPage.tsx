"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import {
  isTectonicPlatesAction,
  type TectonicPlatesAction,
} from "@/lib/labs/tectonic-plates/actions";
import { applyTectonicPlatesAction } from "@/lib/labs/tectonic-plates/runtime";
import {
  TECTONIC_INITIAL_STATE,
  type TectonicPlatesState,
} from "@/lib/labs/tectonic-plates/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "What happens at a convergent boundary?",
  "Why do earthquakes happen?",
  "Show me what happens when plates move faster",
];

const TectonicPlatesScene = lazy(() => import("@/components/labs/tectonic-plates/Scene"));
const TectonicPlatesFallback = lazy(() => import("@/components/labs/tectonic-plates/Fallback"));

export default function TectonicPlatesLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<TectonicPlatesState>(TECTONIC_INITIAL_STATE);

  const applyAction = useCallback((action: TectonicPlatesAction) => {
    setState((current) => applyTectonicPlatesAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isTectonicPlatesAction(planned.action)) {
      return currentState;
    }
    const nextState = applyTectonicPlatesAction(currentState as TectonicPlatesState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="tectonic-plates"
      lessonId={lessonId}
      initialState={TECTONIC_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-[var(--ll-border)] p-4 text-sm text-[var(--ll-text-faint)]">Loading lab fallback...</div>}>
          <TectonicPlatesFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <TectonicPlatesScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
