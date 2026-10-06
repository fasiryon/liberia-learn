// Every keyboard walkthrough step must name a control the lab really renders, so a CI pass is meaningful.
import { describe, expect, it } from "vitest";
import { LAB_WALKTHROUGHS } from "@/lib/interactive-labs/v2/review/walkthroughs";
import { getInteractiveLabDefinition } from "@/lib/interactive-labs/v2/registry";
import { getLabReviewScenarioSet } from "@/lib/interactive-labs/v2/review/referenceScenarios";

// Confirm is conditionally rendered after a learner picks a component and a target slot.
const FIXED_UI = ["Challenge", "Assessment", "Guided", "Explore", "Check my work", "Parts and traces", "Take the", "Confirm"];

describe("keyboard walkthroughs", () => {
  for (const walkthrough of Object.values(LAB_WALKTHROUGHS)) {
    it(`${walkthrough.labId}: every pressed control exists and the start scenario is registered`, () => {
      const definition = getInteractiveLabDefinition(walkthrough.labId)!;
      const spec = definition.fidelity!;
      expect(getLabReviewScenarioSet(walkthrough.labId)?.scenarios.some((scenario) => scenario.id === walkthrough.scenario)).toBe(true);
      const names = new Set<string>([
        ...FIXED_UI,
        ...spec.components.map((component) => component.label),
        ...spec.cutaways.map((cutaway) => cutaway.label),
        ...spec.flows.flatMap((flow) => flow.nodes.map((node) => node.label)),
        ...spec.assemblies.flatMap((assembly) => (assembly.slots ?? []).map((slot) => slot.label)),
        ...(spec.protection ? [spec.protection.resetLabel] : []),
      ]);
      for (const step of walkthrough.steps) {
        if (!("press" in step)) continue;
        const known = step.match === "prefix" ? [...names].some((name) => name.startsWith(step.press)) : names.has(step.press);
        expect(known, step.press).toBe(true);
      }
      // The walkthrough must assert the challenge and every check, not just press buttons.
      expect(walkthrough.steps.filter((step) => "expectStatus" in step && step.expectStatus === "Nice work")).toHaveLength(definition.checks.length);
      expect(walkthrough.steps.some((step) => "expectStatus" in step && step.expectStatus === "Challenge met")).toBe(true);
    });
  }
});
