"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { InteractiveLabPlayer, type LabReviewPreview } from "../InteractiveLabPlayer";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { getLabReviewScenarioSet } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { replayReviewScenario, scenarioActions } from "@/lib/interactive-labs/v2/review/scenarios";
import type { CapabilityProfile, LabAction } from "@/lib/interactive-labs/v2/types";

type ReviewWindow = Window & { __labReviewRemount?: () => number; __labReview?: { labId: string; scenarioId: string; profile: CapabilityProfile; finalAction: LabAction | null; dispatch: (action: LabAction) => { ok: boolean; reason?: string } } };

/** Renders the real learner player in a replayed scenario state for capture. Records no evidence. */
export function LabReviewHarness({ labId, scenarioId, profile, holdFinalAction }: { labId: string; scenarioId: string; profile: CapabilityProfile; holdFinalAction: boolean }) {
  const definition = getInteractiveLabDefinition(labId);
  const scenario = getLabReviewScenarioSet(labId)?.scenarios.find((candidate) => candidate.id === scenarioId) ?? null;
  const replay = useMemo(() => definition && scenario ? replayReviewScenario(definition, scenario, { holdFinalAction }) : null, [definition, scenario, holdFinalAction]);
  const finalAction = useMemo(() => definition && scenario && holdFinalAction ? scenarioActions(definition, scenario).at(-1) ?? null : null, [definition, scenario, holdFinalAction]);
  const onReady = useCallback<NonNullable<LabReviewPreview["onReady"]>>(({ dispatch }) => {
    (window as ReviewWindow).__labReview = { labId, scenarioId, profile, finalAction, dispatch };
  }, [labId, scenarioId, profile, finalAction]);
  const preview = useMemo<LabReviewPreview | null>(() => replay?.ok ? { initialState: replay.state, onReady } : null, [replay, onReady]);
  // RX-005 A5 lifecycle test: remount the whole player (and its renderer) on demand.
  const [mount, setMount] = useState(0);
  useEffect(() => {
    const reviewWindow = window as ReviewWindow;
    reviewWindow.__labReviewRemount = () => { setMount((value) => value + 1); return mount + 1; };
    return () => { delete reviewWindow.__labReviewRemount; };
  }, [mount]);

  if (!definition || !scenario) return <p data-lab-review-error className="text-red-200">Unknown lab or scenario: {labId} / {scenarioId}</p>;
  if (!replay?.ok || !preview) return <p data-lab-review-error className="text-red-200">Scenario {scenarioId} does not replay: {replay && "reason" in replay ? replay.reason : "unknown"}</p>;
  return (
    <div data-lab-review-ready data-lab-id={labId} data-lab-version={definition.version} data-scenario={scenarioId} data-profile={profile}>
      <p className="mx-auto mb-3 max-w-6xl rounded-full bg-fuchsia-500/15 px-4 py-1 text-xs font-semibold text-fuchsia-100">
        Review preview · not learner-facing · no evidence recorded · {definition.id}@{definition.version} ({definition.reviewState}) · {scenario.title} · {profile}
      </p>
      <InteractiveLabPlayer key={`${scenarioId}:${profile}:${holdFinalAction}:${mount}`} labId={labId} override={profile} reviewPreview={preview} />
    </div>
  );
}
