import { notFound } from "next/navigation";
import { LabReviewHarness } from "@/components/interactive-labs/v2/review/LabReviewHarness";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { getLabReviewScenarioSet } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { isLabReviewHarnessEnabled, LAB_REVIEW_PROFILES } from "@/lib/interactive-labs/v2/review/scenarios";
import type { CapabilityProfile } from "@/lib/interactive-labs/v2/types";

// Dev-only capture surface for the Interactive Lab Production Team. It renders labs that are not
// approved for learners, so it 404s unless isLabReviewHarnessEnabled (never in a production build).
export const dynamic = "force-dynamic";

export default function LabReviewPage({ params, searchParams }: { params: { labId: string }; searchParams: Record<string, string | string[] | undefined> }) {
  if (!isLabReviewHarnessEnabled(process.env)) notFound();
  const definition = getInteractiveLabDefinition(params.labId);
  const scenarios = getLabReviewScenarioSet(params.labId);
  if (!definition || !scenarios) notFound();
  const scenarioId = typeof searchParams.scenario === "string" ? searchParams.scenario : scenarios.scenarios[0]?.id ?? "";
  const requested = typeof searchParams.profile === "string" ? searchParams.profile : "HIGH";
  const profile: CapabilityProfile = (LAB_REVIEW_PROFILES as readonly string[]).includes(requested) ? requested as CapabilityProfile : "HIGH";
  return <main className="min-h-screen bg-slate-900 px-4 py-6"><LabReviewHarness labId={definition.id} scenarioId={scenarioId} profile={profile} holdFinalAction={searchParams.hold === "1"} /></main>;
}
