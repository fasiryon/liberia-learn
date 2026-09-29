import { describe, expect, it } from "vitest";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { buildRenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { validateHighFidelityDefinition } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { HYDROPOWER_REVIEW_SCENARIOS } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { replayReviewScenario } from "@/lib/interactive-labs/v2/review/scenarios";

describe("Mount Coffee hydropower design stage", () => {
  it("satisfies the shared authoring and colour gates with ten flows and five checks", () => {
    expect(validateHighFidelityDefinition(hydropowerDefinition)).toEqual([]);
    expect(hydropowerDefinition.fidelity?.flows).toHaveLength(10);
    expect(hydropowerDefinition.checks).toHaveLength(5);
  });

  it("covers all 22 storyboard captures and replays them", () => {
    expect(HYDROPOWER_REVIEW_SCENARIOS.scenarios.length).toBeGreaterThanOrEqual(22);
    expect(HYDROPOWER_REVIEW_SCENARIOS.scenarios.every((scenario) => scenario.storyboardScene)).toBe(true);
    for (const scenario of HYDROPOWER_REVIEW_SCENARIOS.scenarios) {
      const result = replayReviewScenario(hydropowerDefinition, scenario);
      expect(result.ok, scenario.id).toBe(true);
    }
  });

  it("begins the guided overload beat below capability before the learner switches on demand", () => {
    const step = hydropowerDefinition.fidelity?.guidedPath.find((candidate) => candidate.id === "overload");
    expect(step?.prompt).toContain("keep the hospital on, then switch on homes and shops one at a time");
    const scenario = HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((candidate) => candidate.id === "hydro-guided-overload-beat");
    expect(scenario).toBeDefined();
    const replay = replayReviewScenario(hydropowerDefinition, scenario!);
    if ("reason" in replay) throw new Error(replay.reason);
    expect(replay.state.fidelity?.variables).toMatchObject({ riverFlow: 430, unitsOnline: 3, feederHospital: 1, feederHomes: 0, feederShops: 0 });
  });

  it("keeps LOW render draw count within the locked 40 draw budget", () => {
    for (const scenario of HYDROPOWER_REVIEW_SCENARIOS.scenarios) {
      const result = replayReviewScenario(hydropowerDefinition, scenario);
      if ("reason" in result) throw new Error(`${scenario.id}: ${result.reason}`);
      const list = buildRenderList({ definition: hydropowerDefinition, state: result.state, profile: "LOW" });
      const draws = list.items.length + (list.flows.length ? 3 : 0) + (list.markers.length ? 1 : 0);
      expect(draws, scenario.id).toBeLessThanOrEqual(40);
    }
  });

  it("keeps every decorative render property invariant through the HIGH storyboard sweep and away from trace nodes/labels", () => {
    const start = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios[0]);
    if ("reason" in start) throw new Error(start.reason);
    const baseline = buildRenderList({ definition: hydropowerDefinition, state: start.state, profile: "HIGH" });
    const decor = baseline.items.filter((item) => item.detail === "decor");
    const signature = (item: (typeof decor)[number]) => ({ matrix: item.matrix, center: item.center, color: item.color, alpha: item.alpha, emissive: item.emissive, highlighted: item.highlighted, showLabel: item.showLabel, selectable: item.selectable });
    const traceNodes = baseline.flows.flatMap((flow) => flow.nodes.filter((node) => node.traceable).map((node) => node.position));
    for (const item of decor) {
      const nearby = [...traceNodes, ...baseline.items.filter((other) => other.detail !== "decor" && other.showLabel).map((other) => other.center)];
      expect(nearby.every((point) => Math.hypot(point[0] - item.center[0], point[1] - item.center[1]) > 0.75), item.id).toBe(true);
    }
    for (const scenario of HYDROPOWER_REVIEW_SCENARIOS.scenarios) {
      const replay = replayReviewScenario(hydropowerDefinition, scenario);
      if ("reason" in replay) throw new Error(`${scenario.id}: ${replay.reason}`);
      const current = buildRenderList({ definition: hydropowerDefinition, state: replay.state, profile: "HIGH" });
      for (const item of decor) {
        expect(signature(current.items.find((candidate) => candidate.id === item.id)!), `${scenario.id}/${item.id}`).toEqual(signature(item));
      }
    }
  });
});
