"use client";

import { lazy, Suspense, useCallback, useState } from "react";

import LabShell from "@/components/labs/LabShell";
import {
  isEcosystemBalanceAction,
  type EcosystemBalanceAction,
} from "@/lib/labs/ecosystem-balance/actions";
import { applyEcosystemBalanceAction } from "@/lib/labs/ecosystem-balance/runtime";
import {
  ECOSYSTEM_INITIAL_STATE,
  type EcosystemBalanceState,
} from "@/lib/labs/ecosystem-balance/state";
import type { PlannedLabAction } from "@/lib/labs/types";

const SUGGESTED_PROMPTS = [
  "What happens if I add more carnivores?",
  "Simulate a drought",
  "Why are the populations cycling?",
];

const EcosystemBalanceScene = lazy(() => import("@/components/labs/ecosystem-balance/Scene"));
const EcosystemBalanceFallback = lazy(() => import("@/components/labs/ecosystem-balance/Fallback"));

export default function EcosystemBalanceLabPage({ lessonId }: { lessonId?: string | null }) {
  const [state, setState] = useState<EcosystemBalanceState>(ECOSYSTEM_INITIAL_STATE);

  const applyAction = useCallback((action: EcosystemBalanceAction) => {
    setState((current) => applyEcosystemBalanceAction(current, action));
  }, []);

  const handlePlannedAction = useCallback((planned: PlannedLabAction, currentState: unknown) => {
    if (!planned.action || !isEcosystemBalanceAction(planned.action)) {
      return currentState;
    }
    const nextState = applyEcosystemBalanceAction(currentState as EcosystemBalanceState, planned.action);
    setState(nextState);
    return nextState;
  }, []);

  return (
    <LabShell
      labId="ecosystem-balance"
      lessonId={lessonId}
      initialState={ECOSYSTEM_INITIAL_STATE}
      state={state}
      onAction={handlePlannedAction}
      suggestedPrompts={SUGGESTED_PROMPTS}
      fallback={
        <Suspense fallback={<div className="rounded-md border border-[var(--ll-border)] p-4 text-sm text-[var(--ll-text-faint)]">Loading lab fallback...</div>}>
          <EcosystemBalanceFallback state={state} onAction={applyAction} />
        </Suspense>
      }
    >
      <EcosystemBalanceScene state={state} onAction={applyAction} />
    </LabShell>
  );
}
