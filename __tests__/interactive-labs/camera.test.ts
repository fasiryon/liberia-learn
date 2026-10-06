import { describe, expect, it } from "vitest";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { buildRenderList } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { advanceRail, cameraHeight, constrainOrbit, fallbackFrame, findPreset, fitDistance, framedPose, framedSphere, GATE_ASPECTS, projectPoint, railStop, tweenPose, validateCamera } from "@/lib/interactive-labs/v2/fidelity/camera";
import { classifyLabAction, validateHighFidelityDefinition } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { CIRCUIT_LAB_ID } from "@/lib/interactive-labs/v2/definitions/circuit";
import { fitHorizontalFieldOfView, multiply, multiplyInto } from "@/lib/interactive-labs/v2/fidelity/math";
import { LAB_REVIEW_SCENARIO_SETS } from "@/lib/interactive-labs/v2/review/referenceScenarios";
import type { CameraPose } from "@/lib/interactive-labs/v2/fidelity/presentation";
import type { CameraConstraints } from "@/lib/interactive-labs/v2/fidelity/types";
import type { InteractiveLabDefinition, LabState } from "@/lib/interactive-labs/v2/types";

const limits: CameraConstraints = { minDistance: 2, maxDistance: 20, minPitch: -0.5, maxPitch: 1.2, minYaw: -1.5, maxYaw: 1.5 };
const anchor: CameraPose = { target: [1, 0, 0], distance: 8, yaw: 0.2, pitch: 0.3 };
const circuit = () => getInteractiveLabDefinition(CIRCUIT_LAB_ID)!;
const itemsOf = (definition: InteractiveLabDefinition<LabState>) => buildRenderList({ definition, state: initializeLab(definition), profile: "HIGH" }).items;
const withCamera = (definition: InteractiveLabDefinition<LabState>, camera: Partial<NonNullable<InteractiveLabDefinition<LabState>["fidelity"]>["camera"]>) =>
  ({ ...definition, fidelity: { ...definition.fidelity!, camera: { ...definition.fidelity!.camera, ...camera } } }) as InteractiveLabDefinition<LabState>;

describe("caller-owned matrix scratch", () => {
  it("matches allocating matrix multiplication while reusing the output buffer", () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    const b = [...a].reverse();
    const output = new Float32Array(16);
    expect(multiplyInto(output, a, b)).toBe(output);
    expect([...output]).toEqual(multiply(a, b));
  });
});

describe("RX-005d / A16: constrained orbit", () => {
  it("pins the target to the preset without a target box, and pans only inside a declared box", () => {
    const panned = { ...anchor, target: [9, 9, 9] as CameraPose["target"] };
    expect(constrainOrbit(panned, limits, { anchor, mode: "explore" }).target).toEqual(anchor.target);
    const boxed = { ...limits, targetBox: { min: [-2, -1, -1] as CameraPose["target"], max: [3, 2, 1] as CameraPose["target"] } };
    expect(constrainOrbit(panned, boxed, { anchor, mode: "explore" }).target).toEqual([3, 2, 1]);
    expect(constrainOrbit({ ...anchor, target: [0.5, 0.5, 0] }, boxed, { anchor, mode: "explore" }).target).toEqual([0.5, 0.5, 0]);
  });

  it("keeps a guided step near its preset and explore within the lab's limits", () => {
    const guided = { ...limits, guided: { distance: 1, yaw: 0.25, pitch: 0.1 } };
    const wild: CameraPose = { target: anchor.target, distance: 19, yaw: 1.4, pitch: -0.4 };
    const held = constrainOrbit(wild, guided, { anchor, mode: "guided" });
    expect(held).toEqual({ target: anchor.target, distance: 9, yaw: anchor.yaw + 0.25, pitch: anchor.pitch - 0.1 });
    expect(constrainOrbit(wild, guided, { anchor, mode: "explore" })).toEqual(wild);
    expect(constrainOrbit({ ...wild, distance: 40 }, guided, { anchor, mode: "explore" }).distance).toBe(20);
  });

  it("never drops the eye below a declared ground or water surface", () => {
    const grounded = { ...limits, groundY: 0 };
    const low = constrainOrbit({ ...anchor, pitch: -0.45 }, grounded, { anchor, mode: "explore" });
    expect(cameraHeight(low)).toBeGreaterThanOrEqual(0.3 - 1e-9);
    expect(low.pitch).toBeGreaterThan(-0.45);
  });
});

describe("RX-005d: preset framing", () => {
  it("fits a framed preset's parts on every stage shape", () => {
    const definition = circuit(), spec = definition.fidelity!, items = itemsOf(definition);
    const preset = findPreset(spec, "bulb-close");
    const framed = items.filter((item) => preset.frame!.componentIds.includes(item.id));
    expect(framed.length).toBe(preset.frame!.componentIds.length);
    const sphere = framedSphere(framed)!;
    for (const aspect of [...GATE_ASPECTS, 0.5, 2.2]) {
      const pose = framedPose(spec, preset, items, definition.scene.camera.fov, aspect);
      const fov = fitHorizontalFieldOfView(definition.scene.camera.fov, aspect);
      for (const item of framed) {
        const at = projectPoint(pose, item.center, fov, aspect)!;
        expect(Math.abs(at[0]), `${item.id} @ ${aspect}`).toBeLessThan(1);
        expect(Math.abs(at[1]), `${item.id} @ ${aspect}`).toBeLessThan(1);
      }
      // Clamped to the lab's limits, never closer than the fitted sphere needs.
      expect(pose.distance).toBeGreaterThanOrEqual(Math.min(spec.camera.constraints.maxDistance, fitDistance(sphere.radius, fov, aspect)) - 1e-9);
      expect(pose.yaw).toBe(preset.yaw);
    }
    // A preset without a frame stays authored.
    expect(framedPose(spec, findPreset(spec, "overview"), items, 42, 1.5)).toMatchObject({ target: [0, 0, 0], distance: 10 });
  });

  it("fits the 2D view box to every framed preset (A18) on phone and desktop", () => {
    for (const labId of Object.keys(LAB_REVIEW_SCENARIO_SETS)) {
      const definition = getInteractiveLabDefinition(labId)!, items = itemsOf(definition);
      for (const preset of definition.fidelity!.camera.presets.filter((candidate) => candidate.frame)) for (const narrow of [false, true]) {
        const box = fallbackFrame(items, preset, narrow);
        for (const item of items.filter((candidate) => preset.frame!.componentIds.includes(candidate.id))) {
          expect(item.center[0], `${labId}/${preset.id}/${item.id}`).toBeGreaterThan(box.x);
          expect(item.center[0]).toBeLessThan(box.x + box.width);
          expect(-item.center[1]).toBeGreaterThan(box.y);
          expect(-item.center[1]).toBeLessThan(box.y + box.height);
        }
      }
    }
  });
});

describe("RX-005d: rails", () => {
  it("advances stop by stop, then finishes, and each stop is an ordinary (IGNORED) camera preset", () => {
    const spec = circuit().fidelity!;
    let position: { railId: string; index: number } | null = { railId: "follow-current", index: 0 };
    const visited: string[] = [];
    while (position) { const stop = railStop(spec, position)!; visited.push(stop.presetId); expect(classifyLabAction({ type: "camera-preset", presetId: stop.presetId })).toBe("IGNORED"); position = advanceRail(spec, position); }
    expect(visited).toEqual(["overview", "switch-close", "bulb-close", "overview"]);
    expect(railStop(spec, { railId: "follow-current", index: 3 })!.leg).toEqual({ durationMs: 600, easing: "linear" });
    expect(railStop(spec, { railId: "follow-current", index: 9 })).toBeNull();
  });

  it("eases each leg and cuts under reduced motion", () => {
    const to: CameraPose = { target: [3, 1, 0], distance: 4, yaw: -0.4, pitch: 0.6 };
    expect(tweenPose(anchor, to, 0, 700, "ease-in-out", false)).toEqual(anchor);
    expect(tweenPose(anchor, to, 700, 700, "ease-in-out", false)).toEqual(to);
    expect(tweenPose(anchor, to, 350, 700, "ease-in-out", false).distance).toBeCloseTo(6);
    expect(tweenPose(anchor, to, 175, 700, "linear", false).distance).toBeCloseTo(7);
    expect(tweenPose(anchor, to, 175, 700, "ease-in-out", false).distance).toBeGreaterThan(7);
    expect(tweenPose(anchor, to, 10, 700, "ease-in-out", true)).toEqual(to);
  });
});

describe("RX-005d / A16: camera authoring gate", () => {
  it("passes every registered lab", () => {
    for (const labId of Object.keys(LAB_REVIEW_SCENARIO_SETS)) {
      const definition = getInteractiveLabDefinition(labId)!;
      expect(validateCamera(definition, itemsOf(definition)), labId).toEqual([]);
      expect(validateHighFidelityDefinition(definition).filter((error) => error.startsWith("camera_") || error.startsWith("guided_step_rail")), labId).toEqual([]);
    }
  });

  it("rejects presets outside the limits or box, unknown frames, bad rails and unframed targets", () => {
    const definition = circuit(), spec = definition.fidelity!, items = itemsOf(definition);
    const presets = spec.camera.presets;
    expect(validateCamera(withCamera(definition, { presets: [...presets, { id: "far", label: "Far", target: [0, 0, 0], distance: 99, yaw: 0, pitch: 0 }] }), items)).toContain("camera_preset_outside_limits:far");
    expect(validateCamera(withCamera(definition, { constraints: { ...spec.camera.constraints, targetBox: { min: [5, 5, 5], max: [6, 6, 6] } } }), items)).toContain("camera_preset_target_outside_box:overview");
    expect(validateCamera(withCamera(definition, { presets: [{ ...presets[0], frame: { componentIds: ["no-such-part"] } }, ...presets.slice(1)] }), items)).toContain("camera_frame_component_unknown:overview:no-such-part");
    const rails = [{ id: "r", label: "R", stops: [{ presetId: "overview" }, { presetId: "nowhere" }] }, { id: "short", label: "S", stops: [{ presetId: "overview" }] }];
    const railErrors = validateCamera(withCamera(definition, { rails }), items);
    expect(railErrors).toContain("camera_rail_stop_unknown:r:nowhere");
    expect(railErrors).toContain("camera_rail_too_short:short");
    const stepRail = { ...definition, fidelity: { ...spec, guidedPath: [{ ...spec.guidedPath[0], railId: "missing" }, ...spec.guidedPath.slice(1)] } } as InteractiveLabDefinition<LabState>;
    expect(validateCamera(stepRail, items)).toContain(`guided_step_rail_unknown:${spec.guidedPath[0].id}:missing`);
    // A trace node no preset can see is an unframed target (A16: no target may require camera freedom).
    const hidden = { ...definition, fidelity: { ...spec, flows: spec.flows.map((flow) => ({ ...flow, nodes: flow.nodes.map((node) => node.id === "switch" ? { ...node, position: [0, 0, 60] as [number, number, number] } : node) })) } } as InteractiveLabDefinition<LabState>;
    expect(validateCamera(hidden, items)).toContain("camera_target_unframed:current:switch");
  });
});
