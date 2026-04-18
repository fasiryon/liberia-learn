"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import {
  isCellDivisionAction,
  type CellDivisionAction,
} from "@/lib/labs/cell-division/actions";
import { applyCellDivisionAction } from "@/lib/labs/cell-division/runtime";
import {
  CELL_DIVISION_INITIAL_STATE,
  type CellDivisionState,
} from "@/lib/labs/cell-division/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "Show me metaphase",
  "What happens to chromosomes in anaphase?",
  "Go back to the start",
];

const CellDivisionScene = lazy(() => import("@/components/labs/cell-division/Scene"));
const CellDivisionFallback = lazy(() => import("@/components/labs/cell-division/Fallback"));

export default function CellDivisionLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<CellDivisionState>(CELL_DIVISION_INITIAL_STATE);

  const applyAction = useCallback((action: CellDivisionAction) => {
    setState((current) => applyCellDivisionAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isCellDivisionAction(planned.action)) {
      return currentState;
    }
    const nextState = applyCellDivisionAction(currentState as CellDivisionState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="cell-division"
      lessonId={lessonId}
      initialState={CELL_DIVISION_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-slate-200 p-4 text-sm text-slate-600">Loading lab fallback...</div>}>
          <CellDivisionFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <CellDivisionScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
