import { describe, expect, it } from "vitest";
import { acceptLabAction, checkpointSession, initializeLab, restoreSession } from "@/lib/interactive-labs/v2/kernel";
import { buildLabEvidence } from "@/lib/interactive-labs/v2/evidence";
import { adaptLabEvidence } from "@/lib/interactive-labs/v2/governance";
import { resolveCapabilityProfile } from "@/lib/interactive-labs/v2/capabilities";
import { solidsDefinition, SOLIDS_FIDELITY } from "@/lib/interactive-labs/v2/definitions/solids";
import { circuitDefinition, CIRCUIT_FIDELITY, circuitModel } from "@/lib/interactive-labs/v2/definitions/circuit";
import { leverDefinition } from "@/lib/interactive-labs/v2/definitions/lever";
import { evaluateFidelityCheck, initialFidelityState, isComponentRevealed, transitionFidelity, validateFidelityAction } from "@/lib/interactive-labs/v2/fidelity/engine";
import { buildRenderList, instructionalView } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { approach, approachCamera, constrainCamera, easeDisplayState, flowParticles, presetPose, samplePath } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { downgradeProfile, RENDER_BUDGETS, shouldDowngrade } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { buildOfflineManifest, classifyLabAction, isEvidenceBearingAction, validateHighFidelityDefinition } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { stepVariable } from "@/lib/interactive-labs/v2/fidelity/variables";
import { multiply, rotate, transformPoint, translate } from "@/lib/interactive-labs/v2/fidelity/math";
import type { CapabilityProfile, InteractiveLabDefinition, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import { FIDELITY_ACTION_TYPES, type HighFidelitySpec } from "@/lib/interactive-labs/v2/fidelity/types";

const PROFILES: CapabilityProfile[] = ["HIGH", "STANDARD", "LOW", "FALLBACK_2D"];

function run(definition: InteractiveLabDefinition<LabState>, actions: LabAction[], from?: LabState): LabState {
  return actions.reduce((state, action) => {
    const result = acceptLabAction(definition, state, action);
    if (result.ok === false) throw new Error(`${action.type}: ${result.reason}`);
    return result.state;
  }, from ?? initializeLab(definition));
}

function rejects(definition: InteractiveLabDefinition<LabState>, state: LabState, action: LabAction): string {
  const result = acceptLabAction(definition, state, action);
  if (result.ok === false) return result.reason;
  throw new Error(`expected ${action.type} to be rejected`);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.freeze(value); Object.values(value as object).forEach(deepFreeze); }
  return value;
}

const closeSwitch: LabAction = { type: "set-variable", variableId: "switch", value: 1 };
const prismSlots = SOLIDS_FIDELITY.assemblies.find((assembly) => assembly.id === "prism-faces")!.slots!;
const correctPrismBuild: LabAction[] = [{ type: "clear-assembly", assemblyId: "prism-faces" }, ...prismSlots.map((slot) => ({ type: "place-component" as const, assemblyId: "prism-faces", slotId: slot.id, componentId: slot.initialComponentId }))];

describe("high-fidelity standard: authoring gate", () => {
  it("accepts both reference definitions and rejects an incomplete one", () => {
    expect(validateHighFidelityDefinition(solidsDefinition)).toEqual([]);
    expect(validateHighFidelityDefinition(circuitDefinition)).toEqual([]);
    const broken: HighFidelitySpec = { ...CIRCUIT_FIDELITY, authoring: { ...CIRCUIT_FIDELITY.authoring, misconceptions: " " }, cutaways: [] };
    const errors = validateHighFidelityDefinition({ ...circuitDefinition, fidelity: broken, checks: circuitDefinition.checks.map((check) => ({ ...check, kind: "select" as const })) });
    expect(errors).toEqual(expect.arrayContaining(["authoring_missing:misconceptions", "internal_unreachable:bulb-filament", "direct_manipulation_check_missing"]));
    expect(validateHighFidelityDefinition(leverDefinition)).toEqual(["fidelity_spec_missing"]);
  });

  it("rejects fidelity actions on labs without a fidelity layer and malformed actions", () => {
    expect(rejects(leverDefinition, initializeLab(leverDefinition), { type: "set-explode", assemblyId: "x", factor: 1 })).toMatch(/no high-fidelity layer/);
    expect(acceptLabAction(circuitDefinition, initializeLab(circuitDefinition), null as unknown as LabAction).ok).toBe(false);
  });
});

describe("exploded view primitive", () => {
  it("validates the factor and moves each face out along its normal in proportion", () => {
    const start = initializeLab(solidsDefinition);
    for (const factor of [1.5, -0.1, Number.NaN]) expect(rejects(solidsDefinition, start, { type: "set-explode", assemblyId: "cube-faces", factor })).toBe("explode_factor_out_of_bounds");
    expect(rejects(solidsDefinition, start, { type: "set-explode", assemblyId: "sphere", factor: 1 })).toBe("exploded_view_unknown");

    const closed = buildRenderList({ definition: solidsDefinition, state: start, profile: "HIGH" });
    expect(closed.items.some((item) => item.id === "cube")).toBe(true);
    expect(closed.items.some((item) => item.id === "cube-faces-top")).toBe(false);

    const half = run(solidsDefinition, [{ type: "set-explode", assemblyId: "cube-faces", factor: 0.5 }]);
    const full = run(solidsDefinition, [{ type: "set-explode", assemblyId: "cube-faces", factor: 1 }]);
    const listHalf = buildRenderList({ definition: solidsDefinition, state: half, profile: "HIGH" });
    const listFull = buildRenderList({ definition: solidsDefinition, state: full, profile: "HIGH" });
    expect(listFull.items.some((item) => item.id === "cube")).toBe(false);
    expect(listFull.items.filter((item) => item.id.startsWith("cube-faces-"))).toHaveLength(6);
    const cubeCenter = solidsDefinition.scene.objects.find((object) => object.id === "cube")!.transform.position;
    const dist = (list: typeof listFull, id: string) => { const c = list.items.find((item) => item.id === id)!.center; return Math.hypot(c[0] - cubeCenter[0], c[1] - cubeCenter[1], c[2] - cubeCenter[2]); };
    expect(dist(listHalf, "cube-faces-top")).toBeCloseTo(1.25 + 0.55, 5);
    expect(dist(listFull, "cube-faces-top")).toBeCloseTo(1.25 + 1.1, 5);
    expect(full.fidelity?.cameraPresetId).toBe("cube-focus");
  });

  it("unfolds the cube into a net through the variable-driven pose transition", () => {
    const unfolded = run(solidsDefinition, [{ type: "set-variable", variableId: "cube-unfold", value: 1 }]);
    const list = buildRenderList({ definition: solidsDefinition, state: unfolded, profile: "STANDARD" });
    const centers = Object.fromEntries(list.items.filter((item) => item.id.startsWith("cube-faces-")).map((item) => [item.id, item.center]));
    expect(Object.keys(centers)).toHaveLength(6);
    // Net laid in the cube's local XY plane: top and bottom sit 2.5 units (one face) above and below the front face.
    const d = (a: string, b: string) => Math.hypot(...[0, 1, 2].map((i) => centers[a][i] - centers[b][i]) as [number, number, number]);
    expect(d("cube-faces-front", "cube-faces-top")).toBeCloseTo(2.5, 5);
    expect(d("cube-faces-front", "cube-faces-bottom")).toBeCloseTo(2.5, 5);
    expect(d("cube-faces-front", "cube-faces-back")).toBeCloseTo(5, 5);
    expect(list.explanation.map((line) => line.id)).toContain("cube-net");
  });
});

describe("cutaway primitive", () => {
  it("reveals internal structure at every profile; clips in HIGH/STANDARD and hides on LOW/FALLBACK_2D", () => {
    const start = initializeLab(circuitDefinition);
    expect(rejects(circuitDefinition, start, { type: "inspect-component", componentId: "bulb-filament" })).toBe("component_not_visible");
    expect(rejects(circuitDefinition, start, { type: "set-cutaway", cutawayId: "nope" })).toBe("cutaway_unknown");
    const cut = run(circuitDefinition, [{ type: "set-cutaway", cutawayId: "bulb-cutaway" }]);
    for (const profile of PROFILES) {
      const list = buildRenderList({ definition: circuitDefinition, state: cut, profile });
      expect(list.items.find((item) => item.id === "bulb-filament")?.selectable).toBe(true);
      const glass = list.items.find((item) => item.id === "bulb-glass");
      if (RENDER_BUDGETS[profile].shaderClipping) { expect(glass?.clip).toEqual({ normal: [0, 0, 1], offset: 0 }); expect(glass?.selectable).toBe(false); }
      else expect(glass).toBeUndefined();
    }
    const inspected = run(circuitDefinition, [{ type: "inspect-component", componentId: "bulb-filament" }], cut);
    expect(inspected.fidelity?.inspectedComponentId).toBe("bulb-filament");
    const closedAgain = run(circuitDefinition, [{ type: "set-cutaway", cutawayId: null }], inspected);
    expect(closedAgain.fidelity?.inspectedComponentId).toBeNull();

    const isolatedGlassThenCut = run(circuitDefinition, [
      { type: "isolate", targetId: "bulb-glass" },
      { type: "set-cutaway", cutawayId: "bulb-cutaway" },
    ]);
    expect(isolatedGlassThenCut.fidelity?.isolatedId).toBeNull();
    expect(buildRenderList({ definition: circuitDefinition, state: isolatedGlassThenCut, profile: "LOW" }).items.map((item) => item.id)).toContain("bulb-filament");
  });

  it("keeps an isolated plain scene object (not a spec component) across cutaway changes", () => {
    const spec: HighFidelitySpec = { ...SOLIDS_FIDELITY, cutaways: [{ id: "cut", label: "Cut", plane: { normal: [0, 0, 1], offset: 0 }, removesComponentIds: [], revealsComponentIds: [] }] };
    const isolated = { ...initialFidelityState(spec), isolatedId: "sphere" };
    const opened = transitionFidelity(spec, isolated, { type: "set-cutaway", cutawayId: "cut" });
    expect(opened.isolatedId).toBe("sphere");
    expect(transitionFidelity(spec, opened, { type: "set-cutaway", cutawayId: null }).isolatedId).toBe("sphere");
  });

  it("hides layered components and restores them", () => {
    const spec: HighFidelitySpec = { ...CIRCUIT_FIDELITY, layers: [{ id: "casing", label: "Casing", defaultVisible: true }], components: CIRCUIT_FIDELITY.components.map((component) => component.id === "battery" ? { ...component, layerId: "casing" } : component) };
    const state = initialFidelityState(spec);
    expect(validateFidelityAction(spec, state, { type: "toggle-layer", layerId: "unknown" }).ok).toBe(false);
    const hidden = transitionFidelity(spec, state, { type: "toggle-layer", layerId: "casing" });
    expect(isComponentRevealed(spec, hidden, "battery")).toBe(false);
    expect(isComponentRevealed(spec, transitionFidelity(spec, hidden, { type: "toggle-layer", layerId: "casing" }), "battery")).toBe(true);
  });

  it("isolates a part: LOW drops the context, other profiles fade it", () => {
    const isolated = run(circuitDefinition, [{ type: "isolate", targetId: "resistor" }]);
    expect(buildRenderList({ definition: circuitDefinition, state: isolated, profile: "LOW" }).items.map((item) => item.id)).toEqual(["resistor"]);
    const high = buildRenderList({ definition: circuitDefinition, state: isolated, profile: "HIGH" });
    expect(high.items.find((item) => item.id === "battery")?.alpha).toBeLessThan(0.2);
    expect(high.items.find((item) => item.id === "resistor")?.inFocus).toBe(true);
    expect(rejects(circuitDefinition, isolated, { type: "isolate", targetId: "ghost" })).toBe("isolate_target_unknown");
  });
});

describe("process flow primitive", () => {
  it("derives flow state from the simulation, never from the renderer", () => {
    const open = initializeLab(circuitDefinition);
    const openList = buildRenderList({ definition: circuitDefinition, state: open, profile: "HIGH" });
    expect(openList.flows[0]).toMatchObject({ id: "current", active: false, rate: 0, particleCount: 0 });
    const closed = run(circuitDefinition, [closeSwitch]);
    for (const profile of PROFILES) {
      const flow = buildRenderList({ definition: circuitDefinition, state: closed, profile }).flows[0];
      expect(flow.active).toBe(true);
      expect(flow.particleCount).toBe(RENDER_BUDGETS[profile].particlesPerFlow);
    }
    const lowR = run(circuitDefinition, [{ type: "set-variable", variableId: "resistance", value: 2 }], closed);
    expect(buildRenderList({ definition: circuitDefinition, state: lowR, profile: "HIGH" }).flows[0].rate).toBeGreaterThan(buildRenderList({ definition: circuitDefinition, state: closed, profile: "HIGH" }).flows[0].rate);
    const hidden = run(circuitDefinition, [{ type: "toggle-flow", flowId: "current" }], closed);
    expect(buildRenderList({ definition: circuitDefinition, state: hidden, profile: "HIGH" }).flows).toEqual([]);
  });

  it("animates particles along the governed path at a speed set by the rate", () => {
    const points: [number, number, number][] = [[0, 0, 0], [2, 0, 0], [2, 2, 0]];
    expect(samplePath(points, 0)).toEqual([0, 0, 0]);
    expect(samplePath(points, 0.5)).toEqual([2, 0, 0]);
    expect(samplePath(points, 1.25)).toEqual([1, 0, 0]);
    expect(flowParticles(points, 5, 0, 1, 3, false)).toEqual([]);
    const slow = flowParticles(points, 1, 0.2, 1, 1, false)[0], fast = flowParticles(points, 1, 1, 1, 1, false)[0];
    expect(fast[0] + fast[1]).toBeGreaterThan(slow[0] + slow[1]);
    expect(flowParticles(points, 2, 1, 1, 7, true)).toEqual(flowParticles(points, 2, 1, 1, 0, true));
  });
});

describe("simulation variables and rules", () => {
  it("changes state causally: more resistance, less current; more voltage, more current", () => {
    const evaluate = (voltage: number, resistance: number, sw = 1) => circuitModel.evaluate({ variables: { voltage, resistance, switch: sw }, placements: {} }).quantities;
    for (let r = 2; r < 20; r += 2) expect(evaluate(6, r + 2).current).toBeLessThan(evaluate(6, r).current);
    for (let v = 1.5; v < 9; v += 1.5) expect(evaluate(v + 1.5, 6).brightness).toBeGreaterThan(evaluate(v, 6).brightness);
    expect(evaluate(9, 2, 0)).toMatchObject({ current: 0, brightness: 0 });
    expect(evaluate(4.5, 2)).toMatchObject({ current: 0.75, brightness: 0.5 });
    expect(circuitModel.evaluate({ variables: { voltage: 3, resistance: 6, switch: 1 }, placements: {} })).toEqual(circuitModel.evaluate({ variables: { voltage: 3, resistance: 6, switch: 1 }, placements: {} }));
  });

  it("rejects invalid parameters without changing state", () => {
    const start = deepFreeze(initializeLab(circuitDefinition));
    const cases: [string, unknown, string][] = [["voltage", 10.5, "variable_out_of_bounds"], ["voltage", 2, "variable_off_step"], ["voltage", Number.NaN, "variable_value_not_finite"], ["voltage", "3", "variable_value_not_finite"], ["switch", 0.5, "variable_toggle_invalid"], ["mass", 1, "variable_unknown"]];
    for (const [variableId, value, reason] of cases) expect(rejects(circuitDefinition, start, { type: "set-variable", variableId, value: value as number })).toBe(reason);
    expect(start.fidelity?.variables).toEqual({ voltage: 3, resistance: 6, switch: 0 });
    const voltage = CIRCUIT_FIDELITY.variables[0];
    expect(stepVariable(voltage, 9, 1)).toBe(9);
    expect(stepVariable(voltage, 3, -1)).toBe(1.5);
  });
});

describe("direct-manipulation assessment", () => {
  it("lets the learner tap all 8 cube vertices (feature key regression)", () => {
    const tapped = run(solidsDefinition, [...Array.from({ length: 8 }, (_, index) => ({ type: "highlight-feature" as const, objectId: "cube", feature: "vertex" as const, index })), { type: "check", checkId: "cube-vertices", response: {} }]);
    expect(tapped.completedChecks).toEqual(["cube-vertices"]);
    expect(rejects(solidsDefinition, tapped, { type: "highlight-feature", objectId: "cube", feature: "vertex", index: 8 })).toMatch(/invalid/);
    expect(buildRenderList({ definition: solidsDefinition, state: tapped, profile: "FALLBACK_2D" }).markers).toHaveLength(8);
  });

  it("reach-target and trace-path require the learner to change the scene", () => {
    const start = initializeLab(circuitDefinition);
    expect(run(circuitDefinition, [{ type: "check", checkId: "light-bulb", response: {} }]).completedChecks).toEqual([]);
    const lit = run(circuitDefinition, [closeSwitch, { type: "check", checkId: "light-bulb", response: {} }]);
    expect(lit.completedChecks).toEqual(["light-bulb"]);

    const order = ["battery-positive", "switch", "resistor", "bulb", "battery-negative"];
    const tracedOpen = run(circuitDefinition, order.map((nodeId) => ({ type: "trace-node" as const, flowId: "current", nodeId })), start);
    expect(evaluateFidelityCheck(CIRCUIT_FIDELITY, tracedOpen.fidelity!, { kind: "trace-path", flowId: "current" })).toBe(false);
    const wrong = run(circuitDefinition, ["battery-positive", "resistor", "switch", "bulb", "battery-negative"].map((nodeId) => ({ type: "trace-node" as const, flowId: "current", nodeId })), lit);
    expect(run(circuitDefinition, [{ type: "check", checkId: "trace-current", response: {} }], wrong).retries).toBe(1);
    const right = run(circuitDefinition, [{ type: "clear-trace", flowId: "current" }, ...order.map((nodeId) => ({ type: "trace-node" as const, flowId: "current", nodeId })), { type: "check", checkId: "trace-current", response: {} }], lit);
    expect(right.completedChecks).toContain("trace-current");
    expect(rejects(circuitDefinition, start, { type: "trace-node", flowId: "current", nodeId: "corner-top-left" })).toBe("flow_node_not_traceable");

    const glow = run(circuitDefinition, [{ type: "set-variable", variableId: "voltage", value: 4.5 }, { type: "set-variable", variableId: "resistance", value: 2 }, { type: "check", checkId: "medium-glow", response: {} }, { type: "set-cutaway", cutawayId: "bulb-cutaway" }, { type: "inspect-component", componentId: "bulb-filament" }, { type: "check", checkId: "find-filament", response: {} }], right);
    expect(glow.completedChecks).toEqual(["light-bulb", "trace-current", "medium-glow", "find-filament"]);
    expect(glow.mode).toBe("COMPLETE");
  });

  it("the prism rebuild needs disassembly and shape-matched placement", () => {
    const start = initializeLab(solidsDefinition);
    expect(run(solidsDefinition, [{ type: "check", checkId: "rebuild-prism", response: {} }]).completedChecks).toEqual([]);
    expect(rejects(solidsDefinition, start, { type: "place-component", assemblyId: "prism-faces", slotId: prismSlots[0].id, componentId: prismSlots[0].initialComponentId })).toBe("assembly_not_disassembled");
    const cleared = run(solidsDefinition, [{ type: "clear-assembly", assemblyId: "prism-faces" }]);
    expect(buildRenderList({ definition: solidsDefinition, state: cleared, profile: "HIGH" }).items.some((item) => item.id === "rectangular-prism")).toBe(false);
    const top = prismSlots.find((slot) => slot.label === "Top")!, front = prismSlots.find((slot) => slot.label === "Front")!;
    const mismatched = run(solidsDefinition, [...correctPrismBuild.slice(1).filter((action) => action.type === "place-component" && action.slotId !== top.id && action.slotId !== front.id), { type: "place-component", assemblyId: "prism-faces", slotId: top.id, componentId: front.initialComponentId }, { type: "place-component", assemblyId: "prism-faces", slotId: front.id, componentId: top.initialComponentId }], cleared);
    expect(run(solidsDefinition, [{ type: "check", checkId: "rebuild-prism", response: {} }], mismatched).completedChecks).toEqual([]);
    const moved = run(solidsDefinition, [{ type: "place-component", assemblyId: "prism-faces", slotId: prismSlots[1].id, componentId: prismSlots[0].initialComponentId }], run(solidsDefinition, [{ type: "place-component", assemblyId: "prism-faces", slotId: prismSlots[0].id, componentId: prismSlots[0].initialComponentId }], cleared));
    expect(moved.fidelity?.placements["prism-faces"]).toEqual({ [prismSlots[1].id]: prismSlots[0].initialComponentId });
    const built = run(solidsDefinition, [...correctPrismBuild, { type: "check", checkId: "rebuild-prism", response: {} }]);
    expect(built.completedChecks).toEqual(["rebuild-prism"]);
    const placedTop = buildRenderList({ definition: solidsDefinition, state: built, profile: "LOW" }).items.find((item) => item.id === top.initialComponentId)!;
    const prism = solidsDefinition.scene.objects.find((object) => object.id === "rectangular-prism")!;
    const expected = transformPoint(multiply(translate(...prism.transform.position), rotate(...built.rotations["rectangular-prism"])), top.transform.position);
    placedTop.center.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 6));
  });
});

describe("determinism, replay and idempotency", () => {
  const script: LabAction[] = [closeSwitch, { type: "set-variable", variableId: "resistance", value: 10 }, { type: "set-explode", assemblyId: "bulb", factor: 0.7 }, { type: "camera-preset", presetId: "bulb-close" }, { type: "trace-node", flowId: "current", nodeId: "battery-positive" }, { type: "guided-step", index: 2 }];

  it("replays to identical state and never mutates the input state", () => {
    const frozen = deepFreeze(initializeLab(circuitDefinition));
    const a = run(circuitDefinition, script, frozen), b = run(circuitDefinition, script, frozen);
    expect(a).toEqual(b);
    expect(frozen.fidelity?.variables.switch).toBe(0);
    const frozenSolids = deepFreeze(initializeLab(solidsDefinition));
    expect(run(solidsDefinition, correctPrismBuild, frozenSolids)).toEqual(run(solidsDefinition, correctPrismBuild, frozenSolids));
  });

  it("emits identical evidence for a replayed check and does not double count completion", () => {
    const state = run(circuitDefinition, [closeSwitch, { type: "check", checkId: "light-bulb", response: {} }]);
    const again = run(circuitDefinition, [{ type: "check", checkId: "light-bulb", response: {} }], state);
    expect(again.completedChecks).toEqual(["light-bulb"]);
    const check = circuitDefinition.checks[0];
    const input = { definition: circuitDefinition, check, state: again, response: {}, tenantId: "school", schoolId: "school", studentId: "s", studentUserId: "u", sessionId: "session", retryCount: 0, hintCount: 0, occurredAt: "2026-09-27T00:00:00.000Z" };
    const first = buildLabEvidence(input), second = buildLabEvidence(input);
    expect(first.evidenceId).toBe(second.evidenceId);
    expect(first.idempotencyKey).toBe("session:light-bulb:complete");
    expect(first.performance.correct).toBe(true);
  });

  it("restores only structurally valid fidelity checkpoints", () => {
    const state = run(circuitDefinition, script);
    const checkpoint = checkpointSession({ sessionId: "s", labId: circuitDefinition.id, labVersion: circuitDefinition.version, learnerId: "u", tenantId: "t", mode: state.mode, completedChecks: [], retries: 0, hints: 0, state });
    expect(restoreSession(JSON.parse(JSON.stringify(checkpoint)), circuitDefinition)?.state.fidelity?.variables.resistance).toBe(10);
    const tamper = (fidelity: object) => restoreSession({ ...checkpoint, state: { ...state, fidelity: { ...state.fidelity, ...fidelity } } }, circuitDefinition);
    expect(tamper({ variables: { voltage: 99, resistance: 10, switch: 1 } })).toBeNull();
    expect(tamper({ activeCutawayId: "forged" })).toBeNull();
    expect(tamper({ explode: { bulb: 3 } })).toBeNull();
    expect(tamper({ tracedPaths: { current: ["nowhere"] } })).toBeNull();
    expect(restoreSession({ ...checkpoint, state: { ...state, fidelity: undefined } }, circuitDefinition)).toBeNull();
  });
});

describe("capability profiles", () => {
  it("downgrades one step at a time and only on sustained slow frames", () => {
    expect(["HIGH", "STANDARD", "LOW", "FALLBACK_2D"].map((profile) => downgradeProfile(profile as CapabilityProfile))).toEqual(["STANDARD", "LOW", "FALLBACK_2D", "FALLBACK_2D"]);
    expect(shouldDowngrade([...Array(59).fill(16), 400])).toBe(false);
    expect(shouldDowngrade(Array(60).fill(70))).toBe(true);
    expect(shouldDowngrade(Array(60).fill(16))).toBe(false);
    expect(resolveCapabilityProfile({ supportsWebGL: false })).toBe("FALLBACK_2D");
  });

  it("keeps FALLBACK_2D (and every profile) instructionally equivalent to HIGH", () => {
    const scenarios: [InteractiveLabDefinition<LabState>, LabAction[]][] = [
      [circuitDefinition, []],
      [circuitDefinition, [closeSwitch, { type: "set-variable", variableId: "voltage", value: 7.5 }]],
      [circuitDefinition, [closeSwitch, { type: "set-cutaway", cutawayId: "bulb-cutaway" }, { type: "inspect-component", componentId: "bulb-filament" }]],
      [circuitDefinition, [{ type: "isolate", targetId: "bulb-glass" }, { type: "set-explode", assemblyId: "bulb", factor: 1 }]],
      [solidsDefinition, [{ type: "select", objectId: "cube" }, { type: "highlight-feature", objectId: "cube", feature: "vertex", index: 3 }]],
      [solidsDefinition, [{ type: "set-explode", assemblyId: "cube-faces", factor: 1 }, { type: "set-variable", variableId: "cube-unfold", value: 0.5 }]],
      [solidsDefinition, correctPrismBuild.slice(0, 4)],
    ];
    for (const [definition, actions] of scenarios) {
      const state = run(definition, actions);
      const reference = instructionalView(buildRenderList({ definition, state, profile: "HIGH" }));
      for (const profile of PROFILES) expect(instructionalView(buildRenderList({ definition, state, profile }))).toEqual(reference);
    }
  });
});

describe("camera and animation primitives", () => {
  it("constrains presets, eases smoothly and snaps under reduced motion", () => {
    const constraints = CIRCUIT_FIDELITY.camera.constraints;
    expect(constrainCamera({ target: [0, 0, 0], distance: 99, yaw: 5, pitch: -5 }, constraints)).toEqual({ target: [0, 0, 0], distance: 14, yaw: 1, pitch: -0.5 });
    expect(presetPose(CIRCUIT_FIDELITY, "bulb-close", 0.1).distance).toBe(4);
    const from = presetPose(CIRCUIT_FIDELITY, "overview"), to = presetPose(CIRCUIT_FIDELITY, "bulb-close");
    const mid = approachCamera(from, to, 0.1, false);
    expect(mid.distance).toBeLessThan(from.distance);
    expect(mid.distance).toBeGreaterThan(to.distance);
    expect(approachCamera(from, to, 0.1, true)).toEqual(to);
    expect(approach(0, 1, 0.1, 6, false)).toBeGreaterThan(0);
    expect(approach(0, 1, 0.1, 6, true)).toBe(1);
  });

  it("eases the displayed explode factor toward the lab state", () => {
    const target = transitionFidelity(SOLIDS_FIDELITY, initialFidelityState(SOLIDS_FIDELITY), { type: "set-explode", assemblyId: "cube-faces", factor: 1 });
    const step = easeDisplayState(SOLIDS_FIDELITY, initialFidelityState(SOLIDS_FIDELITY), target, 0.05, false);
    expect(step.explode["cube-faces"]).toBeGreaterThan(0);
    expect(step.explode["cube-faces"]).toBeLessThan(1);
    expect(easeDisplayState(SOLIDS_FIDELITY, initialFidelityState(SOLIDS_FIDELITY), target, 0.05, true).explode["cube-faces"]).toBe(1);
  });
});

describe("evidence boundary", () => {
  it("classifies every visual interaction as non-evidence", () => {
    for (const type of FIDELITY_ACTION_TYPES) expect(classifyLabAction({ type } as LabAction)).not.toBe("LEARNING_CHECK");
    expect(classifyLabAction({ type: "camera-preset", presetId: "overview" })).toBe("IGNORED");
    expect(classifyLabAction({ type: "set-explode", assemblyId: "bulb", factor: 1 })).toBe("RAW_OBSERVATION");
    expect(classifyLabAction({ type: "rotate", objectId: "cube", delta: [1, 0] })).toBe("RAW_OBSERVATION");
    expect(isEvidenceBearingAction({ type: "check", checkId: "x", response: {} })).toBe(true);
    expect(isEvidenceBearingAction(undefined)).toBe(false);
  });

  it("routes direct-manipulation checks through governed evidence without canonical mastery", () => {
    const state = run(circuitDefinition, [closeSwitch]);
    const check = circuitDefinition.checks[0];
    const evidence = buildLabEvidence({ definition: circuitDefinition, check, state, response: {}, tenantId: "school", schoolId: "school", studentId: "s", studentUserId: "u", sessionId: "sess", retryCount: 0, hintCount: 0 });
    expect(evidence.canonicalMasteryMutation).toBe(false);
    expect(evidence.performance.correct).toBe(true);
    expect(adaptLabEvidence({ definition: circuitDefinition, check, evidence }).disposition).toBe("RAW_OBSERVATION");

    const built = run(solidsDefinition, correctPrismBuild);
    const rebuild = solidsDefinition.checks.find((candidate) => candidate.id === "rebuild-prism")!;
    const rebuildEvidence = buildLabEvidence({ definition: solidsDefinition, check: rebuild, state: built, response: {}, tenantId: "school", schoolId: "school", studentId: "s", studentUserId: "u", sessionId: "sess", retryCount: 0, hintCount: 0 });
    expect(rebuildEvidence.performance.correct).toBe(true);
    expect(adaptLabEvidence({ definition: solidsDefinition, check: rebuild, evidence: rebuildEvidence }).disposition).toBe("RAW_OBSERVATION");
    const sphere = solidsDefinition.checks[0];
    const sphereEvidence = buildLabEvidence({ definition: solidsDefinition, check: sphere, state: { ...initializeLab(solidsDefinition), selectedObjectId: "sphere" }, response: {}, tenantId: "school", schoolId: "school", studentId: "s", studentUserId: "u", sessionId: "sess", retryCount: 0, hintCount: 0 });
    expect(adaptLabEvidence({ definition: solidsDefinition, check: sphere, evidence: sphereEvidence }).disposition).toBe("PROVISIONAL");
  });
});

describe("offline packaging", () => {
  it("packages definitions as data within budget with no remote assets", () => {
    for (const definition of [solidsDefinition, circuitDefinition]) {
      const manifest = buildOfflineManifest(definition);
      expect(manifest.remoteAssets).toEqual([]);
      expect(manifest.withinBudget).toBe(true);
      expect(JSON.parse(JSON.stringify(manifest.data)).id).toBe(definition.id);
    }
  });
});
