"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import {
  isMoleculeMotionAction,
  type MoleculeMotionAction,
} from "@/lib/labs/molecule-motion/actions";
import { applyMoleculeMotionAction } from "@/lib/labs/molecule-motion/runtime";
import {
  MOLECULE_INITIAL_STATE,
  type MoleculeMotionState,
} from "@/lib/labs/molecule-motion/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "What happens when temperature rises?",
  "Cool it below freezing",
  "Add more particles",
];

const MoleculeMotionScene = lazy(() => import("@/components/labs/molecule-motion/Scene"));
const MoleculeMotionFallback = lazy(() => import("@/components/labs/molecule-motion/Fallback"));

export default function MoleculeMotionLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<MoleculeMotionState>(MOLECULE_INITIAL_STATE);

  const applyAction = useCallback((action: MoleculeMotionAction) => {
    setState((current) => applyMoleculeMotionAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isMoleculeMotionAction(planned.action)) {
      return currentState;
    }
    const nextState = applyMoleculeMotionAction(currentState as MoleculeMotionState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="molecule-motion"
      lessonId={lessonId}
      initialState={MOLECULE_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-[var(--ll-border)] p-4 text-sm text-[var(--ll-text-faint)]">Loading lab fallback...</div>}>
          <MoleculeMotionFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <MoleculeMotionScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
