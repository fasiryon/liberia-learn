// RX-005 A10: every palette and contrast gate holds against each environment rig's backdrop. A flow is a cased line
// (dark casing, light core), so it passes when either layer reaches 3:1 against the rig.
import { describe, expect, it } from "vitest";
import { ENVIRONMENT_BACKDROP, HIGHLIGHT_COLOR, INACTIVE_FLOW_COLOR, MARKER_COLOR, contrastRatio } from "@/lib/interactive-labs/v2/fidelity/palette";
import { FLOW_CASING_COLOR } from "@/lib/interactive-labs/v2/fidelity/flowTubes";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { LAB_REVIEW_SCENARIO_SETS } from "@/lib/interactive-labs/v2/review/referenceScenarios";

const flowColors = [...new Set([INACTIVE_FLOW_COLOR, ...Object.keys(LAB_REVIEW_SCENARIO_SETS).flatMap((id) => getInteractiveLabDefinition(id)?.fidelity?.flows.map((flow) => flow.color) ?? [])])];

describe("A10 environment rigs", () => {
  it("declares studio, outdoor daylight and dark field, each with one backdrop token", () => {
    expect(Object.keys(ENVIRONMENT_BACKDROP).sort()).toEqual(["DARK_FIELD", "DAYLIGHT", "STUDIO"]);
  });

  it.each(Object.entries(ENVIRONMENT_BACKDROP))("every cased flow line reaches 3:1 on the %s backdrop", (_rig, backdrop) => {
    for (const core of flowColors) expect(Math.max(contrastRatio(core, backdrop), contrastRatio(FLOW_CASING_COLOR, backdrop)), core).toBeGreaterThanOrEqual(3);
  });

  it.each(Object.entries(ENVIRONMENT_BACKDROP))("markers and highlights reach 3:1 on the %s backdrop, or carry the casing", (_rig, backdrop) => {
    for (const color of [MARKER_COLOR, HIGHLIGHT_COLOR]) expect(Math.max(contrastRatio(color, backdrop), contrastRatio(FLOW_CASING_COLOR, backdrop)), color).toBeGreaterThanOrEqual(3);
  });
});
