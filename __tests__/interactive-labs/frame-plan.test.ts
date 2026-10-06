import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { acceptLabAction, initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { SECTION_CREAM } from "@/lib/interactive-labs/v2/fidelity/palette";
import { LAB_REVIEW_SCENARIO_SETS } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import { replayReviewScenario } from "@/lib/interactive-labs/v2/review/scenarios";
import { buildRenderList, type RenderItem, type RenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { activeTraceFlowId, planLowFrame, planThreeFrame, THREE_GROUND_TRIANGLES, THREE_PRIMITIVE_TRIANGLES, THREE_SKY_TRIANGLES } from "@/lib/interactive-labs/v2/fidelity/framePlan";
import { createLowBatchCache, MAX_LOW_BATCH_VERTICES, planLowBatches, syncLowBatchCache } from "@/lib/interactive-labs/v2/fidelity/lowBatch";
import { compareFramePlan } from "@/lib/interactive-labs/v2/review/framePlanEvidence";
import { createThreeSceneStores, disposeThreeSceneStores, primitiveGeometry, REVEALED_FILL, syncThreeScene } from "@/components/interactive-labs/v2/threeSceneSync";
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

describe("RX-005 A15: section caps", () => {
  it("caps every clipped solid in section cream (back faces, same plane, no shadow), and removes the cap with the cutaway", () => {
    const definition = getInteractiveLabDefinition("fixture-simple-circuit")!;
    const cut = acceptLabAction(definition, initializeLab(definition), { type: "set-cutaway", cutawayId: "bulb-cutaway" });
    if ("reason" in cut) throw new Error(cut.reason);
    const list = buildRenderList({ definition, state: cut.state, profile: "HIGH" });
    const clipped = list.items.filter((item) => item.clip);
    expect(clipped.map((item) => item.id)).toEqual(["bulb-glass"]);
    const { scene, stores, plan } = buildFrameScene(list, "HIGH", null);
    const caps = [...stores.caps.values()];
    expect(caps.map((cap) => cap.userData.sectionCapOf)).toEqual(["bulb-glass"]);
    const material = caps[0].material as THREE.MeshBasicMaterial;
    expect([material.color.getHexString(), material.side, material.toneMapped, material.clippingPlanes?.length, caps[0].castShadow, caps[0].receiveShadow]).toEqual([SECTION_CREAM.slice(1), THREE.BackSide, false, 1, false, false]);
    expect(material.clippingPlanes![0].normal.toArray()).toEqual(clipped[0].clip!.normal);
    expect(caps[0].geometry).toBe(stores.objects.get("bulb-glass")!.geometry);
    const planned = planThreeFrame(list, { profile: "HIGH", traceFlowId: null, plan });
    expect(compareFramePlan({ renderer: "three", planned, measured: { ...countDraws(scene, "main"), shadowDrawCalls: 0, shadowTriangles: 0 } }).mismatches).toEqual([]);
    // Revealed parts get fill light and never receive shadow (A15).
    const filament = stores.objects.get("bulb-filament")!;
    expect(list.items.find((item) => item.id === "bulb-filament")!.revealed).toBe(true);
    expect([(filament.material as THREE.MeshStandardMaterial).emissiveIntensity >= REVEALED_FILL, filament.receiveShadow]).toEqual([true, false]);
    // Closing the cutaway removes the cap and disposes its material.
    syncThreeScene(stores, buildRenderList({ definition, state: initializeLab(definition), profile: "HIGH" }), { profile: "HIGH", time: 0, reducedMotion: false, traceFlowId: null });
    expect([stores.caps.size, stores.capMaterials.size, caps[0].parent]).toEqual([0, 0, null]);
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

  it.each([
    { change: "leaves focus", update: (item: RenderItem): RenderItem => ({ ...item, inFocus: false }) },
    { change: "is highlighted/selected", update: (item: RenderItem): RenderItem => ({ ...item, highlighted: true }) },
    { change: "is isolated/faded", update: (item: RenderItem): RenderItem => ({ ...item, inFocus: false, alpha: 0.12 }) },
    { change: "is clipped", update: (item: RenderItem): RenderItem => ({ ...item, clip: { normal: [0, 1, 0], offset: 0 } }) },
    { change: "starts spinning", update: (item: RenderItem): RenderItem => ({ ...item, spin: { pre: item.matrix, local: item.matrix, pivot: [0, 0, 0], axis: "y", radPerSec: 1 } }) },
    { change: "changes geometry", update: (item: RenderItem): RenderItem => ({ ...item, geometry: "sphere" }) },
    { change: "becomes translucent", update: (item: RenderItem): RenderItem => ({ ...item, alpha: 0.5 }) },
  ])("rebuilds membership when a batched component $change", ({ update }) => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    const list = buildRenderList({ definition, state: initializeLab(definition), profile: "LOW" });
    const cache = createLowBatchCache(), initial = syncLowBatchCache(cache, list), id = initial.batches[0].itemIds[0];
    const items = list.items.map((item) => item.id === id ? update(item) : item);
    const next = syncLowBatchCache(cache, { ...list, items });
    expect(next).not.toBe(initial);
    expect(next.batches.flatMap((batch) => batch.itemIds)).not.toContain(id);
    expect(next.singles.find((item) => item.id === id)).toEqual(items.find((item) => item.id === id));
  });

  it("keeps membership stable when a batched component's pose changes", () => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    const list = buildRenderList({ definition, state: initializeLab(definition), profile: "LOW" });
    const cache = createLowBatchCache(), initial = syncLowBatchCache(cache, list), id = initial.batches[0].itemIds[0];
    const items = list.items.map((item) => {
      if (item.id !== id) return item;
      const matrix = [...item.matrix]; matrix[12] += 0.25;
      return { ...item, matrix };
    });
    const next = syncLowBatchCache(cache, { ...list, items });
    expect(next).toBe(initial);
    expect(next.batches.find((batch) => batch.itemIds.includes(id))?.items.find((item) => item.id === id)?.matrix[12]).toBe(items.find((item) => item.id === id)?.matrix[12]);
  });

  it("rebuilds membership when a component becomes invisible", () => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    const list = buildRenderList({ definition, state: initializeLab(definition), profile: "LOW" });
    const cache = createLowBatchCache(), initial = syncLowBatchCache(cache, list), id = initial.batches[0].itemIds[0];
    const next = syncLowBatchCache(cache, { ...list, items: list.items.filter((item) => item.id !== id) });
    expect(next).not.toBe(initial);
    expect(next.batches.flatMap((batch) => batch.itemIds)).not.toContain(id);
    expect(next.singles.some((item) => item.id === id)).toBe(false);
  });

  it.each([
    { change: "is highlighted/selected", update: (item: RenderItem): RenderItem => ({ ...item, highlighted: true }) },
    { change: "is clipped", update: (item: RenderItem): RenderItem => ({ ...item, clip: { normal: [0, 1, 0], offset: 0 } }) },
    { change: "becomes translucent", update: (item: RenderItem): RenderItem => ({ ...item, alpha: 0.5 }) },
    { change: "leaves focus", update: (item: RenderItem): RenderItem => ({ ...item, inFocus: false }) },
  ])("returns a component to its batch when it stops being excluded (it $change, then reverts)", ({ update }) => {
    const definition = getInteractiveLabDefinition("mount-coffee-hydropower")!;
    const list = buildRenderList({ definition, state: initializeLab(definition), profile: "LOW" });
    const cache = createLowBatchCache(), initial = syncLowBatchCache(cache, list), id = initial.batches[0].itemIds[0], key = initial.batches[0].key;
    syncLowBatchCache(cache, { ...list, items: list.items.map((item) => item.id === id ? update(item) : item) });
    const restored = syncLowBatchCache(cache, list);
    expect(restored.batches.find((batch) => batch.itemIds.includes(id))?.key).toBe(key);
    expect(restored.singles.map((item) => item.id)).not.toContain(id);
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
