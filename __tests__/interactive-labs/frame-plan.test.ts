import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { LAB_REVIEW_SCENARIO_SETS } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { replayReviewScenario } from "@/lib/interactive-labs/v2/review/scenarios";
import { buildRenderList, type RenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { activeTraceFlowId, planLowFrame, planThreeFrame, THREE_GROUND_TRIANGLES, THREE_PRIMITIVE_TRIANGLES, THREE_SKY_TRIANGLES } from "@/lib/interactive-labs/v2/fidelity/framePlan";
import { createLowBatchCache, MAX_LOW_BATCH_VERTICES, planLowBatches, syncLowBatchCache } from "@/lib/interactive-labs/v2/fidelity/lowBatch";
import { compareFramePlan } from "@/lib/interactive-labs/v2/review/framePlanEvidence";
import { createThreeSceneStores, disposeThreeSceneStores, primitiveGeometry, syncThreeScene } from "@/components/interactive-labs/v2/threeSceneSync";
import { skyGeometry } from "@/components/interactive-labs/v2/threeEnvironment";
import type { GeometryKind, InteractiveLabDefinition, LabState } from "@/lib/interactive-labs/v2/types";

const triangles = (geometry: THREE.BufferGeometry) => (geometry.index ? geometry.index.count : geometry.getAttribute("position").count) / 3;

/** What WebGLRenderer.projectObject + renderBufferDirect draw with frustum culling off (three r186). */
function countDraws(scene: THREE.Scene, pass: "main" | "shadow") {
  let drawCalls = 0, tris = 0;
  scene.traverseVisible((object) => {
    const drawable = object as THREE.Mesh | THREE.Line | THREE.Points;
    if (!(drawable instanceof THREE.Mesh || drawable instanceof THREE.Line || drawable instanceof THREE.Points)) return;
    if (pass === "shadow" && !drawable.castShadow) return;
    const material = drawable.material as THREE.Material;
    if (!material.visible) return;
    const instances = drawable instanceof THREE.InstancedMesh ? drawable.count : 1;
    if (instances === 0 || triangles(drawable.geometry) === 0 && drawable instanceof THREE.Mesh) return;
    // WebGLRenderer.renderObject draws a transparent DoubleSide material twice (back faces, then front faces).
    const passes = pass === "main" && drawable instanceof THREE.Mesh && material.transparent && material.side === THREE.DoubleSide && !material.forceSinglePass ? 2 : 1;
    drawCalls += passes;
    if (drawable instanceof THREE.Mesh) tris += triangles(drawable.geometry) * instances * passes;
  });
  return { drawCalls, triangles: tris };
}

function reviewStates(labId: string): { definition: InteractiveLabDefinition<LabState>; state: LabState; id: string }[] {
  const definition = getInteractiveLabDefinition(labId)!;
  const states = [{ definition, state: initializeLab(definition), id: "initial" }];
  for (const scenario of LAB_REVIEW_SCENARIO_SETS[labId].scenarios) {
    const replay = replayReviewScenario(definition, scenario);
    if (replay.ok) states.push({ definition, state: replay.state, id: scenario.id });
  }
  return states;
}

/** The scene ThreeScene builds for one frame: environment (ground, daylight sky) plus the synced render list. */
function buildFrameScene(list: RenderList, profile: "HIGH" | "STANDARD", traceFlowId: string | null) {
  const scene = new THREE.Scene();
  const daylight = list.environment === "DAYLIGHT", shadows = daylight && profile === "HIGH";
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial()));
  if (daylight) scene.add(new THREE.Mesh(skyGeometry(140), new THREE.MeshBasicMaterial()));
  const stores = createThreeSceneStores(scene, shadows);
  const plan = syncThreeScene(stores, list, { profile, time: 1.25, reducedMotion: false, traceFlowId });
  return { scene, stores, plan };
}

describe("RX-005 A8: the three.js frame planner", () => {
  it("knows the triangle count of every primitive, the sky dome and the ground ThreeScene builds", () => {
    for (const kind of Object.keys(THREE_PRIMITIVE_TRIANGLES) as GeometryKind[]) expect(triangles(primitiveGeometry(kind)), kind).toBe(THREE_PRIMITIVE_TRIANGLES[kind]);
    expect(triangles(skyGeometry(140))).toBe(THREE_SKY_TRIANGLES);
    expect(triangles(new THREE.PlaneGeometry(200, 200))).toBe(THREE_GROUND_TRIANGLES);
  });

  it("equals the main and shadow passes of the real scene graph for every registered lab scenario", () => {
    let frames = 0;
    for (const labId of Object.keys(LAB_REVIEW_SCENARIO_SETS)) for (const { definition, state, id } of reviewStates(labId)) for (const profile of ["HIGH", "STANDARD"] as const) {
      const list = buildRenderList({ definition, state, profile });
      const traceFlowId = activeTraceFlowId(definition, state);
      const { scene, stores, plan } = buildFrameScene(list, profile, traceFlowId);
      const planned = planThreeFrame(list, { profile, traceFlowId, plan });
      const main = countDraws(scene, "main"), shadow = countDraws(scene, "shadow");
      const parity = compareFramePlan({ renderer: "three", planned, measured: { drawCalls: main.drawCalls, triangles: main.triangles, shadowDrawCalls: planned.shadowDrawCalls === 0 ? 0 : shadow.drawCalls, shadowTriangles: planned.shadowDrawCalls === 0 ? 0 : shadow.triangles } });
      expect(parity.mismatches, `${labId}/${id}/${profile}`).toEqual([]);
      // STANDARD and STUDIO rigs never draw a shadow pass.
      if (profile === "STANDARD" || list.environment !== "DAYLIGHT") expect(shadow.drawCalls, `${labId}/${id}/${profile} casters`).toBe(0);
      disposeThreeSceneStores(stores);
      frames += 1;
    }
    expect(frames).toBeGreaterThan(20);
  });

  it("keeps the material cache bounded under continuously changing emissive values (R3P-007)", () => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    const list = buildRenderList({ definition, state: initializeLab(definition), profile: "HIGH" });
    const { stores } = buildFrameScene(list, "HIGH", null);
    const baseline = stores.materials.size;
    for (let step = 0; step < 200; step += 1) {
      const emissive = step / 199;
      syncThreeScene(stores, { ...list, items: list.items.map((item, index) => index % 3 === 0 ? { ...item, emissive } : item) }, { profile: "HIGH", time: step / 30, reducedMotion: false, traceFlowId: null });
      expect(stores.materials.size).toBeLessThanOrEqual(list.items.length);
    }
    syncThreeScene(stores, list, { profile: "HIGH", time: 0, reducedMotion: false, traceFlowId: null });
    expect(stores.materials.size).toBe(baseline);
    disposeThreeSceneStores(stores);
  });
});

describe("RX-006 test 1: the LOW frame planner", () => {
  it("counts exactly the batches, singles and shared draws WebGLScene issues", () => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    const state = initializeLab(definition);
    const list = buildRenderList({ definition, state, profile: "LOW" });
    const frame = planLowFrame(list, { traceFlowId: null });
    expect(frame.shadowDrawCalls).toBe(0);
    expect(frame.textures).toEqual([]);
    expect(frame.drawCalls).toBeLessThanOrEqual(40);
    // A trace target adds the trace-node batch only when the traced flow has traceable nodes.
    const traced = list.flows.find((flow) => flow.nodes.some((node) => node.traceable));
    if (traced) expect(planLowFrame(list, { traceFlowId: traced.id }).drawCalls).toBe(frame.drawCalls + 1);
    expect(planLowFrame(list, { traceFlowId: "no-such-flow" }).drawCalls).toBe(frame.drawCalls);
  });

  it("splits large merged batches below the WebGL1 16-bit vertex boundary", () => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    const list = buildRenderList({ definition, state: initializeLab(definition), profile: "LOW" });
    const source = list.items.find((item) => !item.parametricGeometry && item.geometry === "box" && item.alpha >= 0.9 && item.inFocus && !item.highlighted && !item.clip && !item.spin)!;
    const many = { ...list, items: Array.from({ length: 1900 }, (_, index) => ({ ...source, id: `batch-${index}` })) };
    const plan = planLowBatches(many);
    expect(plan.batches.length).toBeGreaterThan(1);
    expect(plan.batches.flatMap((batch) => batch.itemIds)).toHaveLength(1900);
    expect(plan.batches.every((batch) => batch.items.length * 36 <= MAX_LOW_BATCH_VERTICES)).toBe(true);
  });

  it("keeps compatible geometry batched across per-component color and emission states", () => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    const list = buildRenderList({ definition, state: initializeLab(definition), profile: "LOW" });
    const candidates = list.items.filter((item) => !item.parametricGeometry && item.geometry === "box" && item.alpha >= 0.9 && item.inFocus && !item.highlighted && !item.clip && !item.spin).slice(0, 2);
    expect(candidates).toHaveLength(2);
    const [first, second] = candidates;
    const lowPlan = planLowBatches({ ...list, items: [{ ...first, color: "#ff0000", emissive: 0 }, { ...second, color: "#0000ff", emissive: 1 }] }, { perItemState: true });
    const threePlan = planLowBatches({ ...list, items: [{ ...first, color: "#ff0000", emissive: 0 }, { ...second, color: "#0000ff", emissive: 1 }] });
    expect(lowPlan.batches).toHaveLength(1);
    expect(lowPlan.batches[0].itemIds).toEqual([first.id, second.id]);
    expect(threePlan.batches).toHaveLength(0);
  });

  it("reuses the LOW batch plan and its arrays for state-only changes, while refreshing live render items", () => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    const list = buildRenderList({ definition, state: initializeLab(definition), profile: "LOW" });
    const cache = createLowBatchCache(), firstPlan = syncLowBatchCache(cache, list);
    const batch = firstPlan.batches[0], singles = firstPlan.singles;
    const nextItems = list.items.map((item, index) => index === 0 ? { ...item, color: "#ff0000", emissive: 1, label: "Updated live label" } : item);
    const nextPlan = syncLowBatchCache(cache, { ...list, items: nextItems });
    expect(nextPlan).toBe(firstPlan);
    expect(nextPlan.batches[0]).toBe(batch);
    expect(nextPlan.singles).toBe(singles);
    const updated = nextPlan.batches.find((candidate) => candidate.itemIds.includes(nextItems[0].id))?.items.find((item) => item.id === nextItems[0].id)
      ?? nextPlan.singles.find((item) => item.id === nextItems[0].id);
    expect(updated).toMatchObject({ color: "#ff0000", emissive: 1, label: "Updated live label" });
  });

  it("rebuilds membership when a batched component becomes highlighted", () => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    const list = buildRenderList({ definition, state: initializeLab(definition), profile: "LOW" });
    const cache = createLowBatchCache(), initial = syncLowBatchCache(cache, list);
    const batchedId = initial.batches[0].itemIds[0];
    const highlightedItems = list.items.map((item) => item.id === batchedId ? { ...item, highlighted: true } : item);
    const next = syncLowBatchCache(cache, { ...list, items: highlightedItems });
    expect(next).not.toBe(initial);
    expect(next.batches.flatMap((batch) => batch.itemIds)).not.toContain(batchedId);
    expect(next.singles.find((item) => item.id === batchedId)?.highlighted).toBe(true);
  });

  it("keeps every Mount Coffee storyboard scenario within the measured LOW draw budget", () => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    for (const scenario of LAB_REVIEW_SCENARIO_SETS[definition.id].scenarios) {
      const replay = replayReviewScenario(definition, scenario);
      expect(replay.ok, scenario.id).toBe(true);
      if (!replay.ok) continue;
      const list = buildRenderList({ definition, state: replay.state, profile: "LOW" });
      const plan = planLowBatches(list);
      const frame = planLowFrame(list, { traceFlowId: activeTraceFlowId(definition, replay.state), plan });
      expect(frame.drawCalls, scenario.id).toBeLessThanOrEqual(40);
      expect(plan.drawCalls, scenario.id).toBeLessThanOrEqual(frame.drawCalls);
    }
  });
});
