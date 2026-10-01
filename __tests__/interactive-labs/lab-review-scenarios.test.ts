import { describe, expect, it } from "vitest";
import { circuitDefinition } from "@/lib/interactive-labs/v2/definitions/circuit";
import { solidsDefinition } from "@/lib/interactive-labs/v2/definitions/solids";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { buildRenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { CIRCUIT_REVIEW_SCENARIOS, LAB_REVIEW_SCENARIO_SETS, SOLIDS_REVIEW_SCENARIOS } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { isLabReviewHarnessEnabled, replayReviewScenario, requiredReviewStages, validateScenarioSet, type LabReviewScenarioSet } from "@/lib/interactive-labs/v2/review/scenarios";

describe("lab review scenarios", () => {
  it("every registered scenario set replays cleanly against the current definition", () => {
    for (const set of Object.values(LAB_REVIEW_SCENARIO_SETS)) {
      const definition = getInteractiveLabDefinition(set.labId);
      expect(definition, set.labId).not.toBeNull();
      expect(validateScenarioSet(definition!, set)).toEqual([]);
    }
  });

  it("derives required stages from what the lab actually contains", () => {
    expect(requiredReviewStages(solidsDefinition)).toEqual(["overview", "guided", "challenge", "assessment", "exploded"]);
    expect(requiredReviewStages(circuitDefinition)).toEqual(["overview", "guided", "challenge", "assessment", "exploded", "cutaway", "process", "variable"]);
  });

  it("assessment captures really show passed checks", () => {
    const solids = replayReviewScenario(solidsDefinition, SOLIDS_REVIEW_SCENARIOS.scenarios.find((s) => s.id === "prism-rebuilt")!);
    expect(solids.ok && solids.state.completedChecks).toEqual(["rebuild-prism"]);
    const circuit = replayReviewScenario(circuitDefinition, CIRCUIT_REVIEW_SCENARIOS.scenarios.find((s) => s.id === "assessment-complete")!);
    expect(circuit.ok && [...circuit.state.completedChecks].sort()).toEqual(["find-filament", "light-bulb", "medium-glow", "trace-current"]);
  });

  it("causal scenarios reach the states their titles claim", () => {
    const quantities = (id: string) => {
      const replay = replayReviewScenario(circuitDefinition, CIRCUIT_REVIEW_SCENARIOS.scenarios.find((s) => s.id === id)!);
      if ("reason" in replay) throw new Error(replay.reason);
      return buildRenderList({ definition: circuitDefinition, state: replay.state, profile: "HIGH" });
    };
    const open = quantities("open-circuit"), dim = quantities("high-resistance"), bright = quantities("max-brightness");
    expect(open.quantities.current).toBe(0);
    expect(dim.quantities.brightness).toBeLessThan(bright.quantities.brightness);
    expect(bright.quantities.brightness).toBe(1);
  });

  it("holding the final action leaves the pre-motion state for live capture", () => {
    const scenario = CIRCUIT_REVIEW_SCENARIOS.scenarios.find((s) => s.id === "current-starts")!;
    const held = replayReviewScenario(circuitDefinition, scenario, { holdFinalAction: true });
    expect(held.ok && held.state.fidelity?.variables.switch).toBe(0);
  });

  it("rejects stale, broken or incomplete scenario sets", () => {
    const stale: LabReviewScenarioSet = { ...SOLIDS_REVIEW_SCENARIOS, labVersion: "2.0.0" };
    expect(validateScenarioSet(solidsDefinition, stale).join(" ")).toContain("definition is 2.1.0");
    const broken: LabReviewScenarioSet = { ...CIRCUIT_REVIEW_SCENARIOS, scenarios: [...CIRCUIT_REVIEW_SCENARIOS.scenarios, { id: "bad", title: "Bad", stage: "fault", actions: [{ type: "set-cutaway", cutawayId: "nope" }] }] };
    expect(validateScenarioSet(circuitDefinition, broken).join(" ")).toContain('Scenario "bad" does not replay');
    const unproven: LabReviewScenarioSet = { ...CIRCUIT_REVIEW_SCENARIOS, scenarios: [{ id: "claims-pass", title: "Claims pass", stage: "assessment", actions: [], expectCompletedChecks: ["light-bulb"] }] };
    const problems = validateScenarioSet(circuitDefinition, unproven).join(" ");
    expect(problems).toContain("Expected completed checks are missing: light-bulb");
    expect(problems).toContain('No "cutaway" scenario');
  });

  it("the review harness is off unless explicitly enabled in a non-production, non-Vercel process", () => {
    expect(isLabReviewHarnessEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isLabReviewHarnessEnabled({ NODE_ENV: "development", LAB_REVIEW_HARNESS: "1" })).toBe(true);
    expect(isLabReviewHarnessEnabled({ NODE_ENV: "production", LAB_REVIEW_HARNESS: "1" })).toBe(false);
    expect(isLabReviewHarnessEnabled({ NODE_ENV: "development", LAB_REVIEW_HARNESS: "1", VERCEL: "1" })).toBe(false);
  });
});
