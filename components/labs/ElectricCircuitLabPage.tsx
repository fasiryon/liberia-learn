"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import {
  isElectricCircuitAction,
  type ElectricCircuitAction,
} from "@/lib/labs/electric-circuit/actions";
import { applyElectricCircuitAction } from "@/lib/labs/electric-circuit/runtime";
import {
  CIRCUIT_INITIAL_STATE,
  type ElectricCircuitState,
} from "@/lib/labs/electric-circuit/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "What if I increase the voltage?",
  "What happens with parallel resistors?",
  "Make the bulb twice as bright",
];

const ElectricCircuitScene = lazy(() => import("@/components/labs/electric-circuit/Scene"));
const ElectricCircuitFallback = lazy(() => import("@/components/labs/electric-circuit/Fallback"));

export default function ElectricCircuitLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<ElectricCircuitState>(CIRCUIT_INITIAL_STATE);

  const applyAction = useCallback((action: ElectricCircuitAction) => {
    setState((current) => applyElectricCircuitAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isElectricCircuitAction(planned.action)) {
      return currentState;
    }
    const nextState = applyElectricCircuitAction(currentState as ElectricCircuitState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="electric-circuit"
      lessonId={lessonId}
      initialState={CIRCUIT_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-slate-200 p-4 text-sm text-slate-600">Loading lab fallback...</div>}>
          <ElectricCircuitFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <ElectricCircuitScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
