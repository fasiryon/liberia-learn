"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import {
  isHumanHeartAction,
  type HumanHeartAction,
} from "@/lib/labs/human-heart/actions";
import { applyHumanHeartAction } from "@/lib/labs/human-heart/runtime";
import {
  HEART_INITIAL_STATE,
  type HumanHeartState,
} from "@/lib/labs/human-heart/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "What happens when I exercise?",
  "Simulate a blockage",
  "Clear the blockage",
];

const HumanHeartScene = lazy(() => import("@/components/labs/human-heart/Scene"));
const HumanHeartFallback = lazy(() => import("@/components/labs/human-heart/Fallback"));

export default function HumanHeartLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<HumanHeartState>(HEART_INITIAL_STATE);

  const applyAction = useCallback((action: HumanHeartAction) => {
    setState((current) => applyHumanHeartAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isHumanHeartAction(planned.action)) {
      return currentState;
    }
    const nextState = applyHumanHeartAction(currentState as HumanHeartState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="human-heart"
      lessonId={lessonId}
      initialState={HEART_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-[var(--ll-border)] p-4 text-sm text-[var(--ll-text-faint)]">Loading lab fallback...</div>}>
          <HumanHeartFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <HumanHeartScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
