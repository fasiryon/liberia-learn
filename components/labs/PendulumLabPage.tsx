"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import {
  isPendulumLabAction,
  type PendulumLabAction,
} from "@/lib/labs/pendulum-lab/actions";
import { applyPendulumLabAction } from "@/lib/labs/pendulum-lab/runtime";
import {
  PENDULUM_INITIAL_STATE,
  type PendulumLabState,
} from "@/lib/labs/pendulum-lab/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "What if the string was twice as long?",
  "Release from a higher angle",
  "Add more air resistance",
];

const PendulumScene = lazy(() => import("@/components/labs/pendulum-lab/Scene"));
const PendulumFallback = lazy(() => import("@/components/labs/pendulum-lab/Fallback"));

export default function PendulumLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<PendulumLabState>(PENDULUM_INITIAL_STATE);

  const applyAction = useCallback((action: PendulumLabAction) => {
    setState((current) => applyPendulumLabAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isPendulumLabAction(planned.action)) {
      return currentState;
    }
    const nextState = applyPendulumLabAction(currentState as PendulumLabState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="pendulum-lab"
      lessonId={lessonId}
      initialState={PENDULUM_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-slate-200 p-4 text-sm text-slate-600">Loading lab fallback...</div>}>
          <PendulumFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <PendulumScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
