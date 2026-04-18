"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import {
  isChemicalReactionAction,
  type ChemicalReactionAction,
} from "@/lib/labs/chemical-reaction/actions";
import { applyChemicalReactionAction } from "@/lib/labs/chemical-reaction/runtime";
import {
  REACTION_INITIAL_STATE,
  type ChemicalReactionState,
} from "@/lib/labs/chemical-reaction/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "What if I add a catalyst?",
  "What happens at higher temperature?",
  "Is this reaction releasing or absorbing energy?",
];

const ChemicalReactionScene = lazy(() => import("@/components/labs/chemical-reaction/Scene"));
const ChemicalReactionFallback = lazy(() => import("@/components/labs/chemical-reaction/Fallback"));

export default function ChemicalReactionLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<ChemicalReactionState>(REACTION_INITIAL_STATE);

  const applyAction = useCallback((action: ChemicalReactionAction) => {
    setState((current) => applyChemicalReactionAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isChemicalReactionAction(planned.action)) {
      return currentState;
    }
    const nextState = applyChemicalReactionAction(currentState as ChemicalReactionState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="chemical-reaction"
      lessonId={lessonId}
      initialState={REACTION_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-slate-200 p-4 text-sm text-slate-600">Loading lab fallback...</div>}>
          <ChemicalReactionFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <ChemicalReactionScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
