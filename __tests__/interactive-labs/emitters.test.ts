import { describe, expect, it } from "vitest";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { acceptLabAction, initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { buildRenderList, instructionalView } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { emitterParticles, hash01, resolveCues, resolveEmitters, validateEmitters, type EmitterDefinition, type RenderEmitter } from "@/lib/interactive-labs/v2/fidelity/emitters";
import { validateHighFidelityDefinition } from "@/lib/interactive-labs/v2/fidelity/boundary";
import { planLowFrame, planThreeFrame } from "@/lib/interactive-labs/v2/fidelity/framePlan";
import { CIRCUIT_LAB_ID } from "@/lib/interactive-labs/v2/definitions/circuit";
import type { RenderFlow } from "@/lib/interactive-labs/v2/fidelity/renderList";
import type { CapabilityProfile, InteractiveLabDefinition, LabState } from "@/lib/interactive-labs/v2/types";

const circuit = () => getInteractiveLabDefinition(CIRCUIT_LAB_ID)!;
const closed = (definition: InteractiveLabDefinition<LabState>) => { const result = acceptLabAction(definition, initializeLab(definition), { type: "set-variable", variableId: "switch", value: 1 }); if (!result.ok) throw new Error("switch"); return result.state; };
const PROFILES: CapabilityProfile[] = ["HIGH", "STANDARD", "LOW", "FALLBACK_2D"];
const base: EmitterDefinition = { id: "e", label: "E", kind: "spray", medium: "water", origin: [1, 2, 3], direction: [1, 0, 0], reach: 2, activeQuantity: "on", rateQuantity: "rate", color: "#38bdf8", lowProxy: { kind: "points" }, staticCue: { kind: "chevron" } };
const spec = (emitters: EmitterDefinition[]) => ({ ...circuit().fidelity!, emitters });

describe("RX-005b emitters", () => {
  it("bind only to model quantities: inactive means no particles, rate scales reach", () => {
    const [off] = resolveEmitters(spec([base]), { on: 0, rate: 1 }, 18);
    expect(off).toMatchObject({ active: false, rate: 0, particleCount: 0 });
    expect(emitterParticles(off, 3, false)).toEqual([]);
    const [on] = resolveEmitters(spec([base]), { on: 1, rate: 0.5 }, 18);
    expect(on).toMatchObject({ active: true, rate: 0.5, particleCount: 18, direction: [1, 0, 0] });
    const [rising] = resolveEmitters(spec([{ ...base, kind: "upwell", direction: [1, 0, 0] }]), { on: 1, rate: 1 }, 10);
    expect(rising.direction).toEqual([0, 1, 0]);
  });

  it("are deterministic, frozen under reduced motion, and stay within their reach", () => {
    for (const kind of ["stream", "spray", "upwell", "bubble", "pulse"] as const) {
      const [emitter] = resolveEmitters(spec([{ ...base, kind }]), { on: 1, rate: 1 }, 18) as RenderEmitter[];
      expect(emitterParticles(emitter, 1.7, false), kind).toEqual(emitterParticles(emitter, 1.7, false));
      expect(emitterParticles(emitter, 0, true)).toEqual(emitterParticles(emitter, 9, true));
      expect(emitterParticles(emitter, 0.2, false)).not.toEqual(emitterParticles(emitter, 0.6, false));
      for (const point of emitterParticles(emitter, 2.3, false)) expect(Math.hypot(point[0] - 1, point[1] - 2, point[2] - 3), kind).toBeLessThanOrEqual(emitter.reach * 1.6);
    }
    const samples = Array.from({ length: 2000 }, (_, index) => hash01(7, index));
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...samples)).toBeLessThan(1);
    expect(samples.reduce((sum, value) => sum + value, 0) / samples.length).toBeCloseTo(0.5, 1);
  });

  it("are identical in instructional view on every profile (circuit: light pulses only while current flows)", () => {
    const definition = circuit();
    for (const state of [initializeLab(definition), closed(definition)]) {
      const views = PROFILES.map((profile) => instructionalView(buildRenderList({ definition, state, profile })));
      for (const view of views) expect(view).toEqual(views[0]);
    }
    const lit = buildRenderList({ definition, state: closed(definition), profile: "HIGH" });
    expect(lit.emitters).toEqual([expect.objectContaining({ id: "bulb-light", active: true })]);
    expect(buildRenderList({ definition, state: initializeLab(definition), profile: "HIGH" }).emitters[0].active).toBe(false);
  });

  it("cost one draw each on three.js and share LOW's particle batch (or none, for a glyph proxy)", () => {
    const definition = circuit(), state = closed(definition);
    const high = buildRenderList({ definition, state, profile: "HIGH" });
    const withoutEmitters = { ...high, emitters: [] };
    expect(planThreeFrame(high, { profile: "HIGH", traceFlowId: null }).drawCalls).toBe(planThreeFrame(withoutEmitters, { profile: "HIGH", traceFlowId: null }).drawCalls + 1);
    const low = buildRenderList({ definition, state, profile: "LOW" });
    expect(planLowFrame(low, { traceFlowId: null }).drawCalls).toBe(planLowFrame({ ...low, emitters: [] }, { traceFlowId: null }).drawCalls);
  });
});

describe("A15 cues and the emitter gate", () => {
  const flow = (direction: 1 | -1, active = true): RenderFlow => ({ id: "f", label: "F", color: "#facc15", points: [[0, 0, 0], [2, 0, 0], [2, 2, 0]], active, rate: 1, direction, particleCount: 4, nodes: [], traced: [] });
  it("puts direction chevrons on active flows, moving surfaces and emitters", () => {
    expect(resolveCues([flow(1)], [], [])).toEqual([expect.objectContaining({ id: "f:0", kind: "chevron", position: [1, 0, 0], direction: [1, 0, 0] })]);
    expect(resolveCues([flow(-1)], [], [])[0].direction).toEqual([-1, 0, 0]);
    expect(resolveCues([flow(1, false)], [], [])).toEqual([]);
    const surface = { id: "s", label: "S", kind: "channel" as const, medium: "water" as const, points: [[0, 0, 0], [0, 0, 4]] as [number, number, number][], width: 1, active: true, rate: 0.5 };
    expect(resolveCues([], [surface, { ...surface, id: "still", rate: 0 }], []).map((cue) => cue.id)).toEqual(["surface:s"]);
    const [emitter] = resolveEmitters(spec([{ ...base, staticCue: { kind: "glyph", glyph: "≈" } }]), { on: 1, rate: 1 }, 4);
    expect(resolveCues([], [], [emitter])).toEqual([expect.objectContaining({ id: "emitter:e", kind: "glyph", glyph: "≈" })]);
  });

  it("gives no static cue to an emitter that is switched on but running at zero rate", () => {
    const [stopped] = resolveEmitters(spec([base]), { on: 1, rate: 0 }, 18);
    expect(stopped).toMatchObject({ active: true, rate: 0, particleCount: 0 });
    expect(resolveCues([], [], [stopped])).toEqual([]);
  });

  it("rejects unknown quantities, bad geometry and missing LOW proxies or static cues", () => {
    const quantities = { on: 1, rate: 1 };
    expect(validateEmitters(spec([base]), quantities)).toEqual([]);
    expect(validateEmitters(spec([{ ...base, activeQuantity: "nope" }]), quantities)).toContain("emitter_quantity_unknown:e:nope");
    expect(validateEmitters(spec([{ ...base, reach: 0 }]), quantities)).toContain("emitter_reach_invalid:e");
    expect(validateEmitters(spec([{ ...base, direction: [0, 0, 0] }]), quantities)).toContain("emitter_direction_invalid:e");
    expect(validateEmitters(spec([{ ...base, componentId: "ghost" }]), quantities)).toContain("emitter_component_unknown:e");
    expect(validateEmitters(spec([{ ...base, lowProxy: { kind: "glyph", glyph: " " } }]), quantities)).toContain("emitter_low_proxy_missing:e");
    expect(validateEmitters(spec([{ ...base, staticCue: undefined as unknown as EmitterDefinition["staticCue"] }]), quantities)).toContain("emitter_static_cue_missing:e");
    expect(validateEmitters(spec([base, base]), quantities)).toContain("emitter_duplicate:e");
    expect(validateHighFidelityDefinition(circuit()).filter((error) => error.startsWith("emitter_"))).toEqual([]);
  });
});
