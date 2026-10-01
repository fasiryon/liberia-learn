import { describe, expect, it } from "vitest";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { buildRenderList, fallbackVisibleItems } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { validateHighFidelityDefinition } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { HYDROPOWER_REVIEW_SCENARIOS } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { replayReviewScenario } from "@/lib/interactive-labs/v2/review/scenarios";
import { planLowBatches } from "@/lib/interactive-labs/v2/fidelity/lowBatch";

describe("Mount Coffee hydropower design stage", () => {
  it("satisfies the shared authoring and colour gates with ten flows and five checks", () => {
    expect(validateHighFidelityDefinition(hydropowerDefinition)).toEqual([]);
    expect(hydropowerDefinition.fidelity?.flows).toHaveLength(10);
    expect(hydropowerDefinition.checks).toHaveLength(5);
  });

  it("shows every turbine water path returning through the tailrace to the river", () => {
    const flows = hydropowerDefinition.fidelity?.flows.filter((flow) => flow.id.startsWith("water-u")) ?? [];
    expect(flows).toHaveLength(4);
    for (const flow of flows) {
      expect(flow.destinationNodeId).toBe("river-downstream");
      expect(flow.nodes.some((node) => node.label.toLowerCase() === "tailrace")).toBe(true);
      expect(flow.nodes.at(-1)?.id).toBe("river-downstream");
    }
  });

  it("keeps instructional labels available at every profile and separates crowded process callouts", () => {
    const start = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-process-water-starts")!);
    if ("reason" in start) throw new Error(start.reason);
    const labels = (profile: "HIGH" | "STANDARD" | "LOW") => buildRenderList({ definition: hydropowerDefinition, state: start.state, profile }).items.filter((item) => item.showLabel).map((item) => item.id).sort();
    expect(labels("LOW")).toEqual(labels("STANDARD"));
    expect(labels("HIGH")).toEqual(labels("STANDARD"));
    const list = buildRenderList({ definition: hydropowerDefinition, state: start.state, profile: "STANDARD" });
    expect(list.items.find((item) => item.id === "unit-1")?.labelOffset).toBeDefined();
    expect(list.items.find((item) => item.id === "unit-1")?.mobileLabel).toBe(false);
    expect(list.items.find((item) => item.id === "unit-2")?.mobileLabel).toBe(false);
    expect(list.items.find((item) => item.id === "headpond")?.mobileLabel).toBeUndefined();
    expect(list.items.find((item) => item.id === "unit-1-marker")?.showLabel).toBe(false);
    expect(list.items.filter((item) => item.id.startsWith("gauge-seg-") || item.id.startsWith("demand-")).every((item) => !item.showLabel)).toBe(true);
  });

  it("opens with a meet-the-plant beat that does not give away the trace assessment (v1.1 pedagogy P1)", () => {
    expect(hydropowerDefinition.fidelity?.guidedPath[0].prompt).toContain("Meet the plant");
    expect(hydropowerDefinition.fidelity?.guidedPath[0].prompt).not.toContain("Trace the water");
    expect(hydropowerDefinition.checks[0].prompt).toBe("Trace the water through the six nodes, in order.");
    expect(hydropowerDefinition.checks.find((check) => check.id === "dry-season-output")?.prompt).toBe("With all four units on, make the plant produce about 10 MW (8–12).");
  });

  it("shows the energy-chain explanation as the seventh guided task", () => {
    const finalStep = hydropowerDefinition.fidelity?.guidedPath.at(-1);
    expect(finalStep?.prompt).toContain("gravitational potential energy of high water → kinetic energy of falling water");
    const replay = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-guided-name-chain")!);
    if ("reason" in replay) throw new Error(replay.reason);
    expect(replay.state.fidelity?.guidedStepIndex).toBe(6);
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
    expect(step?.prompt).toContain("set homes to all 4 blocks, then add shops blocks one at a time");
    const scenario = HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((candidate) => candidate.id === "hydro-guided-overload-beat");
    expect(scenario).toBeDefined();
    const replay = replayReviewScenario(hydropowerDefinition, scenario!);
    if ("reason" in replay) throw new Error(replay.reason);
    expect(replay.state.fidelity?.variables).toMatchObject({ riverFlow: 430, unitsOnline: 3, feederHospital: 1, homesBlocks: 4, shopsBlocks: 0 });
  });

  it("reveals the unit 3 stack during explosion and supplies live challenge feedback", () => {
    const exploded = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-exploded-unit")!);
    if ("reason" in exploded) throw new Error(exploded.reason);
    const list = buildRenderList({ definition: hydropowerDefinition, state: exploded.state, profile: "LOW" });
    expect(list.items.map((item) => item.id)).toEqual(expect.arrayContaining(["u3-runner", "u3-shaft", "u3-generator"]));
    expect(list.items.map((item) => item.id)).not.toContain("unit-3");
    const stackCenters = ["u3-runner", "u3-shaft", "u3-generator"].map((id) => list.items.find((item) => item.id === id)!.center[1]).sort((a, b) => a - b);
    expect(stackCenters[1] - stackCenters[0]).toBeGreaterThan(0.8);
    expect(stackCenters[2] - stackCenters[1]).toBeGreaterThan(0.8);

    const overview = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-overview")!);
    if ("reason" in overview) throw new Error(overview.reason);
    const overviewList = buildRenderList({ definition: hydropowerDefinition, state: overview.state, profile: "LOW" });
    expect(overviewList.items.map((item) => item.id)).toContain("unit-3");
    expect(overviewList.items.map((item) => item.id)).not.toContain("u3-generator");

    const challenge = hydropowerDefinition.fidelity!;
    expect(challenge.authoring.challenge).toContain("keep the hospital lit and serve as much other load as fits");
    expect(challenge.challengeStatus?.({ gridStableWithPriority: 1 })).toContain("Challenge met");
    expect(challenge.challengeStatus?.({ gridStableWithPriority: 0 })).toContain("Not met yet");
  });

  it("starts the challenge unmet, frames the exploded stack, and previews checks in order", () => {
    const challenge = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-challenge-start")!);
    if ("reason" in challenge) throw new Error(challenge.reason);
    expect(buildRenderList({ definition: hydropowerDefinition, state: challenge.state, profile: "HIGH" }).quantities.gridStableWithPriority).toBe(0);

    const exploded = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-exploded-unit")!);
    if ("reason" in exploded) throw new Error(exploded.reason);
    expect(buildRenderList({ definition: hydropowerDefinition, state: exploded.state, profile: "HIGH" }).camera?.distance).toBe(9);

    const expected: Array<[string, string[]]> = [
      ["hydro-assessment-generator", ["trace-water"]],
      ["hydro-assessment-dry-output", ["trace-water", "find-generator"]],
      ["hydro-assessment-repair", ["trace-water", "find-generator", "dry-season-output", "dry-season-peak"]],
    ];
    for (const [id, checks] of expected) {
      const replay = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === id)!);
      if ("reason" in replay) throw new Error(replay.reason);
      expect(replay.state.completedChecks, id).toEqual(checks);
      if (id === "hydro-assessment-repair") expect(replay.state.lastFeedback).toBeNull();
    }
  });

  it("shows the spillway as active in the rainy three-unit flood state", () => {
    const replay = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-variable-flood-cap")!);
    if ("reason" in replay) throw new Error(replay.reason);
    const list = buildRenderList({ definition: hydropowerDefinition, state: replay.state, profile: "FALLBACK_2D" });
    const spillway = list.flows.find((flow) => flow.id === "spillway");
    expect(spillway?.active).toBe(true);
    expect(list.quantities.spillFlow).toBeGreaterThan(0);
    expect(spillway?.points).toHaveLength(4);
  });

  it("omits removed cutaway solids from the SVG fallback", () => {
    const replay = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-assessment-all-passed")!);
    if ("reason" in replay) throw new Error(replay.reason);
    const list = buildRenderList({ definition: hydropowerDefinition, state: replay.state, profile: "FALLBACK_2D" });
    expect(list.items.find((item) => item.id === "powerhouse")?.clip).not.toBeNull();
    expect(fallbackVisibleItems(list.items).map((item) => item.id)).not.toContain("powerhouse");
    expect(fallbackVisibleItems(list.items).map((item) => item.id)).toEqual(expect.arrayContaining(["u3-runner", "u3-shaft", "u3-generator"]));
  });

  it("shows a spin glyph only for units the model says are generating", () => {
    const dry = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-variable-dry-drop")!);
    if ("reason" in dry) throw new Error(dry.reason);
    const dryList = buildRenderList({ definition: hydropowerDefinition, state: dry.state, profile: "LOW" });
    expect(dryList.motions.filter((motion) => motion.active)).toHaveLength(0);

    const solved = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-challenge-solved")!);
    if ("reason" in solved) throw new Error(solved.reason);
    const solvedList = buildRenderList({ definition: hydropowerDefinition, state: solved.state, profile: "LOW" });
    expect(solvedList.motions.filter((motion) => motion.active).map((motion) => motion.id)).toEqual(["unit-1-spin"]);

    const off = replayReviewScenario(hydropowerDefinition, HYDROPOWER_REVIEW_SCENARIOS.scenarios.find((scenario) => scenario.id === "hydro-fault-zero-units-dark")!);
    if ("reason" in off) throw new Error(off.reason);
    const offList = buildRenderList({ definition: hydropowerDefinition, state: off.state, profile: "LOW" });
    expect(offList.motions.filter((motion) => motion.active)).toHaveLength(0);
  });

  it("keeps LOW render draw count within the locked 40 draw budget", () => {
    for (const scenario of HYDROPOWER_REVIEW_SCENARIOS.scenarios) {
      const result = replayReviewScenario(hydropowerDefinition, scenario);
      if ("reason" in result) throw new Error(`${scenario.id}: ${result.reason}`);
      const list = buildRenderList({ definition: hydropowerDefinition, state: result.state, profile: "LOW" });
      // RX-006: LOW renders through the batch planner, so the budget is the planner's draw count.
      const draws = planLowBatches(list).drawCalls;
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
      const overlaps = nearby.filter((point) => Math.hypot(point[0] - item.center[0], point[1] - item.center[1]) <= 0.75);
      expect(overlaps, item.id).toEqual([]);
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
