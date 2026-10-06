import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { hydropowerDefinition } from "@/lib/interactive-labs/v2/definitions/hydropower";
import { SceneHud } from "@/components/interactive-labs/v2/SceneHud";
import { acceptLabAction, initializeLab } from "@/lib/interactive-labs/v2/kernel";

describe("interactive lab mobile challenge shell", () => {
  it("keeps the challenge goal as a compact mobile chip under the scene HUD", () => {
    const result = acceptLabAction(hydropowerDefinition, initializeLab(hydropowerDefinition), { type: "mode", mode: "CHALLENGE" });
    if ("reason" in result) throw new Error(result.reason);
    const html = renderToStaticMarkup(<SceneHud definition={hydropowerDefinition} state={result.state} dispatch={() => {}} />);
    expect(html).toContain('data-lab-challenge-peek');
    expect(html).toContain('class="mt-1.5 truncate');
    expect(html).toContain(hydropowerDefinition.fidelity!.authoring.challenge);
  });

  it("does not add a challenge chip in other modes", () => {
    const html = renderToStaticMarkup(<SceneHud definition={hydropowerDefinition} state={initializeLab(hydropowerDefinition)} dispatch={() => {}} />);
    expect(html).not.toContain('data-lab-challenge-peek');
  });
});
