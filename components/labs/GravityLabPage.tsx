"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import { isGravityLabAction, type GravityLabAction } from "@/lib/labs/gravity-explorer/actions";
import {
  GRAVITY_INITIAL_STATE,
  type GravityLabState,
} from "@/lib/labs/gravity-explorer/state";
import { applyGravityLabAction } from "@/lib/labs/gravity-explorer/runtime";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "What if gravity was stronger?",
  "What happens on the Moon? Gravity is 1.62",
  "Drop a heavier object",
];

const GravityScene = lazy(() => import("@/components/labs/gravity-explorer/Scene"));
const GravityFallback = lazy(() => import("@/components/labs/gravity-explorer/Fallback"));

export default function GravityLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<GravityLabState>(GRAVITY_INITIAL_STATE);

  const applyAction = useCallback((action: GravityLabAction) => {
    setState((current) => applyGravityLabAction(current, action));
  }, []);

  const handlePlannedAction = useCallback(
    (planned: PlannedLabAction, currentState: unknown) => {
      if (!planned.action || !isGravityLabAction(planned.action)) {
        return currentState;
      }
      const nextState = applyGravityLabAction(currentState as GravityLabState, planned.action);
      setState(nextState);
      return nextState;
    },
    []
  );

  return (
    <LabShell
      labId="gravity-explorer"
      lessonId={lessonId}
      initialState={GRAVITY_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-slate-200 p-4 text-sm text-slate-600">Loading lab fallback...</div>}>
          <GravityFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <GravityScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
