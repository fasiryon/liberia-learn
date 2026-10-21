import fs from "fs";
import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { authoringInputSchema } from "@/lib/content-factory/v2/authoringInput";
import { resolveAuthoredRuntime, V021_CANONICAL_INPUTS } from "@/lib/content-factory/v2/runtimeBindings";
import { loadPinnedContractPolicy } from "@/lib/content-factory/v2/contractPolicySource";
import { assessmentAttribution, attributeEvidence } from "@/lib/content-factory/v2/assessmentAttribution";
import { commonDenominator, comparisonFeedback, fractionModel } from "@/lib/interactive-labs/v2/definitions/firstThree/models";

const root = "C:/restricted-authoring/completed-v021";
describe("V0.2.1 runtime correction", () => {
  it("shows F4 on an incorrect lock before any comparison choice", () => {
    const output = fractionModel.evaluate({ variables: { denA: 4, maskA: 7, denB: 3, maskB: 3, tickA: 8, tickB: 8, lockedA: 1, lockedB: 0, relation: 0, reason: 0 }, placements: {} });
    expect(output.explanation?.find(x => x.id === "compare")?.text).toMatch(/Count the jumps/);
  });
  it("supports the corrected 4/3 versus 6/5 pair exactly on fifteenths", () => {
    expect(commonDenominator(3, 5)).toBe(15);
    const a = { denominator: 3, mask: 15 }, b = { denominator: 5, mask: 63 };
    expect(comparisonFeedback(a, b, 3, true).rule).toBe("F1");
    expect(comparisonFeedback(a, b, 1, true).misconception).toBeNull();
    for (const relation of [1, 2, 3]) expect(comparisonFeedback({ denominator: 4, mask: 7 }, { denominator: 3, mask: 3 }, relation, true).message).toContain("9/12 and 8/12");
  });
});

describe.skipIf(!fs.existsSync(root))("exact restricted V0.2.1 authoring and C13 amendment", () => {
  const policy = loadPinnedContractPolicy("V0.2.1");
  it("retains FT-A001 and applies FT-A002 without altering the historical policy", () => {
    expect(policy.contract.designation).toBe("liberialearn-first-ten-modernization-contract/1.0.0+FT-A001+FT-A002");
    expect(loadPinnedContractPolicy().contract.designation).toBe("liberialearn-first-ten-modernization-contract/1.0.0+FT-A001");
    expect(JSON.stringify(policy.contract.contract)).toContain("Three items (ft01-a3-q1, ft01-a3-q2, ft01-a3-q4)");
    expect(JSON.stringify(policy.contract.contract)).toContain("Four items (ft04-a4-q1 through ft04-a4-q4)");
  });
  for (const id of Object.keys(V021_CANONICAL_INPUTS)) it(`${id}: exact pins, complete attribution, no mixed-task objective projection`, () => {
    const input = authoringInputSchema.parse(JSON.parse(fs.readFileSync(`${root}/${id}.authored.json`, "utf8")));
    expect(createHash("sha256").update(JSON.stringify(input)).digest("hex")).toBe(V021_CANONICAL_INPUTS[id]);
    expect(resolveAuthoredRuntime(input)?.authoredGeneration).toBe("V0.2.1");
    expect(resolveAuthoredRuntime({ ...input, cohortCommit: "0".repeat(40) })).toBeNull();
    const attribution = assessmentAttribution(input, policy.statedPrimary);
    expect(attribution.releaseBlockers).toEqual([]);
    expect(attribution.canonicalMasteryMutation).toBe(false);
    const mixed = attribution.tasks.filter(t => t.attribution === "TASK_ONLY");
    expect(mixed).toHaveLength(2);
    for (const task of mixed) for (const item of task.itemIds) {
      expect(() => attributeEvidence(attribution, item, { perObjective: true })).toThrow(/ITEM_LEVEL_MASTERY_PROHIBITED/);
      expect(attributeEvidence(attribution, item).objectiveIds).toBeNull();
    }
  });
});
