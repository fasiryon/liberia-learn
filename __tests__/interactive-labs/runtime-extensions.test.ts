import { describe, expect, it } from "vitest";
import { acceptLabAction, initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { batchFlowGeometry, createFlowBatchStorage } from "@/lib/interactive-labs/v2/fidelity/flowBatch";
import { validateHighFidelityDefinition } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { buildRenderList, instructionalView, orderFallbackItems, type RenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { flowParticles, flowPoints, spinMatrix } from "@/lib/interactive-labs/v2/fidelity/presentation";
import { shouldScheduleWebGLFrame } from "@/lib/interactive-labs/v2/fidelity/renderLoop";
import { contrastRatio, compositeHex, deltaE00, highlightColor, HIGHLIGHT_COLOR, INACTIVE_FLOW_COLOR, MARKER_COLOR } from "@/lib/interactive-labs/v2/fidelity/palette";
import { RENDER_BUDGETS } from "@/lib/interactive-labs/v2/fidelity/profiles";
import { fitHorizontalFieldOfView, multiply, transformMatrix, transformPoint } from "@/lib/interactive-labs/v2/fidelity/math";
import { circuitDefinition, CIRCUIT_FIDELITY } from "@/lib/interactive-labs/v2/definitions/circuit";
import { CIRCUIT_REVIEW_SCENARIOS } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { replayReviewScenario } from "@/lib/interactive-labs/v2/review/scenarios";
import { pickNearest } from "@/components/interactive-labs/v2/picking";
import type { HighFidelitySpec } from "@/lib/interactive-labs/v2/fidelity/types";

const motion = { id: "switch-motion", label: "Switch lever", componentIds: ["switch-lever"], pivot: [-0.8, 2, 0] as [number, number, number], axis: "z" as const, rpm: 60, symmetryOrder: 1, activeWhen: { componentId: "switch-lever", statuses: ["closed"] } };
const motionSpec: HighFidelitySpec = { ...CIRCUIT_FIDELITY, motions: [motion] };
const motionDefinition = { ...circuitDefinition, fidelity: motionSpec };
const withDecor = (patch: Record<string, unknown> = {}) => ({
  ...circuitDefinition,
  fidelity: { ...CIRCUIT_FIDELITY, components: [...CIRCUIT_FIDELITY.components, { id: "decor-tree", label: "", geometry: "cube" as const, transform: { position: [5, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number] }, material: { color: "#4a7a45", roughness: 1, metalness: 0 }, selectable: false, detail: "decor" as const, ...patch }] },
});

describe("shared interactive-lab runtime extensions", () => {
  it("spins rigidly around one pivot and snaps under reduced motion", () => {
    const spin = { pre: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], local: transformMatrix({ position: [2, 0, 0], rotation: [0, 0, 0], scale: [2, 1, 1] }), pivot: [0, 0, 0] as [number, number, number], axis: "z" as const, radPerSec: Math.PI / 2 };
    const turned = spinMatrix(spin, 1, false);
    expect(transformPoint(turned, [0, 0, 0])[0]).toBeCloseTo(0);
    expect(transformPoint(turned, [0, 0, 0])[1]).toBeCloseTo(2);
    expect(Math.hypot(...transformPoint(turned, [1, 0, 0]).map((v, index) => v - transformPoint(turned, [0, 0, 0])[index]))).toBeCloseTo(2);
    expect(spinMatrix(spin, 1, true)).toEqual(multiply(spin.pre, spin.local));
  });

  it("derives spin from driver statuses identically across all four profiles", () => {
    const initial = initializeLab(motionDefinition);
    const open = buildRenderList({ definition: motionDefinition, state: initial, profile: "HIGH" });
    expect(open.motions[0]).toMatchObject({ id: "switch-motion", active: false });
    const accepted = acceptLabAction(motionDefinition, initial, { type: "set-variable", variableId: "switch", value: 1 });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    const reference = buildRenderList({ definition: motionDefinition, state: accepted.state, profile: "HIGH" });
    expect(reference.items.find((item) => item.id === "switch-lever")?.spin).toBeDefined();
    expect(instructionalView(reference).spinning).toEqual(["switch-motion"]);
    for (const profile of ["STANDARD", "LOW", "FALLBACK_2D"] as const) {
      const list = buildRenderList({ definition: motionDefinition, state: accepted.state, profile });
      expect(instructionalView(list)).toEqual(instructionalView(reference));
    }
    expect(validateHighFidelityDefinition(motionDefinition)).not.toContain("motion_aliasing:switch-motion");
  });

  it("rejects motion aliasing and groups whose spin cannot be seen", () => {
    const alias: HighFidelitySpec = { ...CIRCUIT_FIDELITY, motions: [{ ...motion, rpm: 721 }] };
    expect(validateHighFidelityDefinition({ ...circuitDefinition, fidelity: alias })).toContain("motion_aliasing:switch-motion");
    const invisible: HighFidelitySpec = { ...CIRCUIT_FIDELITY, motions: [{ ...motion, componentIds: ["bulb-glass"], activeWhen: { componentId: "switch-lever", statuses: ["closed"] } }] };
    expect(validateHighFidelityDefinition({ ...circuitDefinition, fidelity: invisible })).toContain("motion_invisible:switch-motion");
  });

  it("keeps decor non-instructional and omits it only at LOW", () => {
    const definition = withDecor() as typeof circuitDefinition;
    const state = initializeLab(definition);
    expect(validateHighFidelityDefinition(definition)).toEqual([]);
    expect(buildRenderList({ definition, state, profile: "HIGH" }).items.some((item) => item.id === "decor-tree")).toBe(true);
    expect(buildRenderList({ definition, state, profile: "STANDARD" }).items.some((item) => item.id === "decor-tree")).toBe(true);
    expect(buildRenderList({ definition, state, profile: "FALLBACK_2D" }).items.some((item) => item.id === "decor-tree")).toBe(true);
    expect(buildRenderList({ definition, state, profile: "LOW" }).items.some((item) => item.id === "decor-tree")).toBe(false);
    const referenceProperties = ["matrix", "center", "color", "alpha", "emissive"] as const;
    const baselineDecor = buildRenderList({ definition, state, profile: "HIGH" }).items.find((item) => item.id === "decor-tree")!;
    const signature = (item: typeof baselineDecor) => Object.fromEntries(referenceProperties.map((key) => [key, item[key]]));
    for (const scenario of CIRCUIT_REVIEW_SCENARIOS.scenarios) {
      const replay = replayReviewScenario(definition, scenario);
      expect(replay.ok).toBe(true);
      if (replay.ok) {
        const item = buildRenderList({ definition, state: replay.state, profile: "HIGH" }).items.find((candidate) => candidate.id === "decor-tree")!;
        expect(signature(item)).toEqual(signature(baselineDecor));
      }
    }
    const high = buildRenderList({ definition, state, profile: "HIGH" });
    expect(orderFallbackItems(high.items)[0].detail).toBe("decor");
    const decor = high.items.find((item) => item.id === "decor-tree")!;
    const tooClose = [...high.flows.flatMap((flow) => flow.nodes.filter((node) => node.traceable).map((node) => node.position)), ...high.items.filter((item) => item.id !== "decor-tree").map((item) => item.center)];
    expect(tooClose.every((point) => Math.hypot(point[0] - decor.center[0], point[1] - decor.center[1], point[2] - decor.center[2]) > 1)).toBe(true);
    expect(pickNearest({ ...high, items: [{ ...decor, selectable: true }] }, (point) => ({ x: point[0], y: point[1] }), { x: decor.center[0], y: decor.center[1] }, null)).toBeNull();
    const bad = withDecor({ id: "hospital-sign", label: "Hospital sign", carriesPlaceIdentity: true }) as typeof circuitDefinition;
    expect(validateHighFidelityDefinition(bad)).toEqual(expect.arrayContaining(["decor_has_label:hospital-sign", "decor_instructional_identity:hospital-sign", "decor_named_instructional_landmark:hospital-sign"]));
  });

  it("batches inactive paths as alternating segment pairs and reuses capacity", () => {
    const list: RenderList = { items: [], markers: [], motions: [], camera: null, budget: RENDER_BUDGETS.HIGH, explanation: [], quantities: {}, flows: [{
      id: "flow", label: "Flow", color: "#22d3ee", points: [[0, 0, 0], [1, 0, 0], [2, 0, 0], [3, 0, 0]], active: false, rate: 0, direction: 1, particleCount: 0,
      nodes: [{ id: "a", label: "A", position: [0, 0, 0], traceable: true }, { id: "b", label: "B", position: [1, 0, 0], traceable: true }], traced: [],
    }] };
    const storage = createFlowBatchStorage();
    batchFlowGeometry(list, 0, false, "flow", storage);
    const capacity = storage.lines.positions;
    expect(storage.lines.count).toBe(4);
    expect(storage.lines.colors[0]).toBeCloseTo(119 / 255, 6);
    expect(storage.lines.colors[1]).toBeCloseTo(154 / 255, 6);
    expect(storage.lines.colors[2]).toBeCloseTo(178 / 255, 6);
    expect(storage.particles.count).toBe(0);
    expect(storage.traceNodes.count).toBe(2);
    batchFlowGeometry(list, 1, false, "flow", storage);
    expect(storage.lines.positions).toBe(capacity);
  });

  it("writes active particle positions into reusable storage without per-particle arrays", () => {
    const points: [number, number, number][] = [[0, 0, 0], [3, 0, 0], [3, 4, 0]];
    const list: RenderList = { items: [], markers: [], motions: [], camera: null, budget: RENDER_BUDGETS.HIGH, explanation: [], quantities: {}, flows: [{
      id: "active", label: "Active", color: "#22d3ee", points, active: true, rate: 0.7, direction: -1, particleCount: 5,
      nodes: [], traced: [],
    }] };
    const storage = createFlowBatchStorage();
    batchFlowGeometry(list, 1.25, false, null, storage);
    const positions = storage.particles.positions, metrics = storage.pathMetrics.get("active")!;
    const expected = flowParticles(points, 5, 0.7, -1, 1.25, false);
    for (let index = 0; index < expected.length; index += 1) expect(Array.from(storage.particles.positions.slice(index * 3, index * 3 + 3))).toEqual(expected[index].map((value) => expect.closeTo(value, 5)));

    batchFlowGeometry(list, 1.5, false, null, storage);
    expect(storage.particles.positions).toBe(positions);
    expect(storage.pathMetrics.get("active")).toBe(metrics);
    expect(storage.particles.count).toBe(5);
  });

  it("caches immutable flow path point lists by definition", () => {
    const flow = CIRCUIT_FIDELITY.flows[0];
    const points = flowPoints(flow);
    expect(flowPoints(flow)).toBe(points);
    expect(points).toHaveLength(flow.nodes.length + (flow.closedLoop && flow.nodes.length > 1 ? 1 : 0));
  });

  it("idles WebGL when settled and resumes for visible or review-clock frames", () => {
    const settled = { reviewClockActive: false, reducedMotion: false, fidelityMoving: false, cameraMoving: false, flowMoving: false, spinMoving: false, pulseMoving: false };
    expect(shouldScheduleWebGLFrame(settled)).toBe(false);
    expect(shouldScheduleWebGLFrame({ ...settled, flowMoving: true })).toBe(true);
    expect(shouldScheduleWebGLFrame({ ...settled, reducedMotion: true, flowMoving: true, spinMoving: true })).toBe(false);
    expect(shouldScheduleWebGLFrame({ ...settled, reducedMotion: true, reviewClockActive: true })).toBe(true);
  });

  it("keeps landscape scene width in portrait WebGL viewports", () => {
    const horizontalFieldOfView = (verticalFov: number, aspect: number) => 2 * Math.atan(Math.tan(verticalFov * Math.PI / 360) * aspect) * 180 / Math.PI;
    const desktopAspect = 1.45, portraitAspect = 0.75, sourceFov = 45;
    expect(fitHorizontalFieldOfView(sourceFov, portraitAspect, desktopAspect)).toBeGreaterThan(sourceFov);
    expect(horizontalFieldOfView(fitHorizontalFieldOfView(sourceFov, portraitAspect, desktopAspect), portraitAspect)).toBeCloseTo(horizontalFieldOfView(sourceFov, desktopAspect));
    expect(fitHorizontalFieldOfView(sourceFov, desktopAspect, desktopAspect)).toBe(sourceFov);
  });

  it("keeps flow, highlight, marker and emissive palettes separated after compositing", () => {
    const activeFlows = ["#67e8f9", "#cffafe", "#facc15"];
    expect(contrastRatio(compositeHex(INACTIVE_FLOW_COLOR, "#263d72", 1), "#263d72")).toBeGreaterThanOrEqual(3);
    for (const color of activeFlows) {
      expect(deltaE00(INACTIVE_FLOW_COLOR, color)).toBeGreaterThanOrEqual(20);
      expect(deltaE00(HIGHLIGHT_COLOR, color)).toBeGreaterThanOrEqual(25);
    }
    expect(deltaE00(HIGHLIGHT_COLOR, INACTIVE_FLOW_COLOR)).toBeGreaterThanOrEqual(25);
    expect(deltaE00(HIGHLIGHT_COLOR, "#fde68a")).toBeGreaterThanOrEqual(25);
    expect(deltaE00(HIGHLIGHT_COLOR, MARKER_COLOR)).toBeGreaterThanOrEqual(25);
    const materials = ["#2f8fe8", "#c9c2b4", "#9fb2c6", "#aab4c0", "#6f86a0", "#5f6d7e", "#cfe0ea", "#ee8f52", "#5fb8a8", "#4a7a45", "#b06a42", "#7a869a", "#96a3b6", "#2f6fe0", "#f8fafc", "#8c9ab0", "#c98a4b"];
    for (const base of materials) expect(deltaE00(base, highlightColor(base, true, false))).toBeGreaterThanOrEqual(15);
    expect(highlightColor("#7a869a", false, false)).toBe("#7a869a");
  });
});
