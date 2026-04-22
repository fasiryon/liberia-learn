"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import {
  isPeriodicTableAction,
  type PeriodicTableAction,
} from "@/lib/labs/periodic-table/actions";
import { applyPeriodicTableAction } from "@/lib/labs/periodic-table/runtime";
import {
  PERIODIC_TABLE_INITIAL_STATE,
  type PeriodicTableState,
} from "@/lib/labs/periodic-table/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "Show me all the metals",
  "What is the Bohr model for Carbon?",
  "Which element has the highest electronegativity?",
];

const PeriodicTableScene = lazy(() => import("@/components/labs/periodic-table/Scene"));
const PeriodicTableFallback = lazy(() => import("@/components/labs/periodic-table/Fallback"));

export default function PeriodicTableLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<PeriodicTableState>(PERIODIC_TABLE_INITIAL_STATE);

  const applyAction = useCallback((action: PeriodicTableAction) => {
    setState((current) => applyPeriodicTableAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isPeriodicTableAction(planned.action)) {
      return currentState;
    }
    const nextState = applyPeriodicTableAction(currentState as PeriodicTableState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="periodic-table"
      lessonId={lessonId}
      initialState={PERIODIC_TABLE_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-[var(--ll-border)] p-4 text-sm text-[var(--ll-text-faint)]">Loading lab fallback...</div>}>
          <PeriodicTableFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <PeriodicTableScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
