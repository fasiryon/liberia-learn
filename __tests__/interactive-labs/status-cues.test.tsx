// RX-005 A19 / G3: a status lamp carries a glyph and text, not colour alone, on every profile.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { buildRenderList, instructionalView } from "@/lib/interactive-labs/v2/fidelity/renderList";
import { UNIT_STATUS_COLORS, UNIT_STATUS_CUES } from "@/lib/interactive-labs/v2/fidelity/palette";
import { acceptLabAction, initializeLab } from "@/lib/interactive-labs/v2/kernel";
import { SceneHud } from "@/components/interactive-labs/v2/SceneHud";
import { Fallback2D } from "@/components/interactive-labs/v2/Fallback2D";

const stateAfter = (...actions: Parameters<typeof acceptLabAction>[2][]) => actions.reduce((state, action) => {
  const result = acceptLabAction(hydropowerDefinition, state, action);
  if ("reason" in result) throw new Error(result.reason);
  return result.state;
}, initializeLab(hydropowerDefinition));
// Unit 1 generating, unit 2 idle (the status-lamps reference state).
const mixed = () => stateAfter({ type: "set-variable", variableId: "homesBlocks", value: 0 }, { type: "set-variable", variableId: "shopsBlocks", value: 1 }, { type: "set-variable", variableId: "riverFlow", value: 49 });

describe("status lamps carry glyph and text", () => {
  it("every status colour has a distinct glyph and text", () => {
    expect(Object.keys(UNIT_STATUS_CUES).sort()).toEqual(Object.keys(UNIT_STATUS_COLORS).sort());
    const cues = Object.values(UNIT_STATUS_CUES);
    expect(new Set(cues.map((cue) => cue.glyph)).size).toBe(cues.length);
    expect(new Set(cues.map((cue) => cue.text)).size).toBe(cues.length);
  });

  it("the render list states each lamp's status identically on every profile", () => {
    const views = (["HIGH", "STANDARD", "LOW", "FALLBACK_2D"] as const).map((profile) => instructionalView(buildRenderList({ definition: hydropowerDefinition, state: mixed(), profile })).statuses);
    expect(views[0]).toMatchObject({ "unit-1": "Generating", "unit-2": "Idle" });
    for (const view of views) expect(view).toEqual(views[0]);
  });

  it("FALLBACK_2D draws the glyph and names the status in the part's accessible name", () => {
    const html = renderToStaticMarkup(<Fallback2D definition={hydropowerDefinition} state={mixed()} reducedMotion traceFlowId={null} dispatch={() => {}} onPick={() => {}} />);
    expect(html).toContain('data-lab-status="unit-1"');
    expect(html).toContain(`>${UNIT_STATUS_CUES.generating.glyph}</text>`);
    expect(html).toContain('aria-label="Unit 1 housing: Generating"');
    expect(html).toContain('aria-label="Unit 2 housing: Idle"');
  });

  it("the HUD lists every visible lamp in text (shared by all profiles)", () => {
    const html = renderToStaticMarkup(<SceneHud definition={hydropowerDefinition} state={mixed()} dispatch={() => {}} />);
    expect(html).toContain('aria-label="Status lamps"');
    expect(html).toContain("Unit 1 housing: Generating");
    expect(html).toContain("Unit 2 housing: Idle");
    // Internal section parts are not listed until revealed.
    expect(html).not.toContain("u3-runner");
  });
});
