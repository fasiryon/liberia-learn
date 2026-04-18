"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import { isWaveMotionAction, type WaveMotionAction } from "@/lib/labs/wave-motion/actions";
import { applyWaveMotionAction } from "@/lib/labs/wave-motion/runtime";
import { WAVE_INITIAL_STATE, type WaveMotionState } from "@/lib/labs/wave-motion/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "Make the wave higher",
  "What happens if frequency increases?",
  "Show a longitudinal wave",
];

const WaveMotionScene = lazy(() => import("@/components/labs/wave-motion/Scene"));
const WaveMotionFallback = lazy(() => import("@/components/labs/wave-motion/Fallback"));

export default function WaveMotionLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<WaveMotionState>(WAVE_INITIAL_STATE);

  const applyAction = useCallback((action: WaveMotionAction) => {
    setState((current) => applyWaveMotionAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isWaveMotionAction(planned.action)) {
      return currentState;
    }
    const nextState = applyWaveMotionAction(currentState as WaveMotionState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="wave-motion"
      lessonId={lessonId}
      initialState={WAVE_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-slate-200 p-4 text-sm text-slate-600">Loading lab fallback...</div>}>
          <WaveMotionFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <WaveMotionScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
