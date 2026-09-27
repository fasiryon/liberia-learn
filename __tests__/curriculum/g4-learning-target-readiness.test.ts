import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { GRADE4_MATH_ONTOLOGY_RELEASE, deterministicReleaseIdentity } from "@/lib/learning-authority/governedGrade4Math";
import { governedInventoryForRelease } from "@/lib/learning-authority/governedInventoryRuntime";

const spec = JSON.parse(fs.readFileSync("curriculum/review/g4-math/live-readiness/lr-math-g4_6-02.target.json", "utf8")) as {
  lessonContentId: string;
  data: { code: string; verificationStatus: string; statement: string; curriculumRevisionId: string; moeObjectiveId: string | null; evidenceRefs: { id: string; kind: string; identity?: string }[] };
};
const structured = JSON.parse(fs.readFileSync("curriculum/structured/moe-structured-v1.json", "utf8")) as { items: { id: string }[] };
const refs = (kind: string) => spec.data.evidenceRefs.filter((ref) => ref.kind === kind);

describe("learning target LR-MATH-G4_6-02 readiness", () => {
  it("stays PARTIAL until the whole Grade 4 Math chain is reviewed and live-certified", () => {
    expect(spec.data.verificationStatus).toBe("PARTIAL");
    expect(spec.data.statement).toContain("no MOE approval claim");
  });

  it("binds the Standard, the released code, the exact release identity and a lesson that release binds", () => {
    const release = GRADE4_MATH_ONTOLOGY_RELEASE;
    expect(refs("STANDARD").map((ref) => ref.id)).toEqual([spec.data.code]);
    expect(new Set(release.bindings.flatMap((binding) => [binding.learningTargetCode, binding.standardCode]))).toEqual(new Set([spec.data.code]));
    expect(refs("ONTOLOGY_RELEASE")).toEqual([{ id: release.id, kind: "ONTOLOGY_RELEASE", identity: deterministicReleaseIdentity(release) }]);
    expect(release.contentBindings.map((binding) => binding.contentId)).toContain(spec.lessonContentId);
    expect(spec.data.curriculumRevisionId).toContain(spec.lessonContentId); // resolved from the published lesson at apply time
  });

  it("references exactly the structured MOE objectives the governed inventory grounds", () => {
    const ids = new Set(structured.items.map((item) => item.id));
    const objectiveRefs = refs("STRUCTURED_MOE_OBJECTIVE").map((ref) => ref.id);
    for (const id of objectiveRefs) expect(ids.has(id), id).toBe(true);
    const inventory = governedInventoryForRelease(GRADE4_MATH_ONTOLOGY_RELEASE);
    expect(objectiveRefs.sort()).toEqual(inventory.concepts.filter((concept) => concept.objectiveBasis === "MOE_OBJECTIVE").map((concept) => concept.objectiveId).sort());
    expect(refs("MOE_SOURCE_VERSION")).toHaveLength(1);
    expect(spec.data.moeObjectiveId).toBeNull();
  });
});
